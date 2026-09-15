from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from backend.core.database import get_session_local
from backend.models.task import Task
from backend.services.tasks import run_task_once

scheduler: AsyncIOScheduler | None = None
logger = logging.getLogger("backend.scheduler")

# 签到任务的一次性辅助 job（失败重试 / range 随机执行 / 窗口补执行）后缀，
# 它们的 id 与主 job 同样以 sign- 开头，同步时必须随主任务保留或清理，不能被当作过期 job 删除
_SIGN_AUX_JOB_SUFFIXES = ("-retry", "-range-run", "-catchup")


def _sign_job_id(account_name: str, task_name: str) -> str:
    return f"sign-{account_name}-{task_name}"


def _sign_aux_job_ids(account_name: str, task_name: str) -> list[str]:
    base = _sign_job_id(account_name, task_name)
    return [base + suffix for suffix in _SIGN_AUX_JOB_SUFFIXES]


def _remove_job_quietly(job_id: str) -> None:
    """移除 job；一次性 job 可能在期间已触发并被自动移除，忽略不存在的情况"""
    if not scheduler:
        return
    try:
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)
    except Exception as e:
        logger.debug("移除 job %s 失败（可能已执行完毕）: %s", job_id, e)


def _has_pending_job(job_id: str) -> bool:
    return bool(scheduler and scheduler.get_job(job_id))


def create_cron_trigger(cron_str: str) -> CronTrigger:
    """自动解析格式并创建 CronTrigger，支持 5位和6位 cron 表达式以及 HH:MM 或 HH:MM:SS"""
    if ":" in cron_str:
        parts = cron_str.split(":")
        try:
            if len(parts) == 2:
                hour, minute = parts
                cron_str = f"0 {int(minute)} {int(hour)} * * *"
            elif len(parts) == 3:
                hour, minute, second = parts
                cron_str = f"{int(second)} {int(minute)} {int(hour)} * * *"
        except ValueError:
            pass

    parts = cron_str.split()
    if len(parts) == 6:
        return CronTrigger(
            second=parts[0],
            minute=parts[1],
            hour=parts[2],
            day=parts[3],
            month=parts[4],
            day_of_week=parts[5]
        )
    return CronTrigger.from_crontab(cron_str)


async def _job_run_task(task_id: int) -> None:
    db: Session = get_session_local()()
    try:
        # 这里的查询是同步的，对于 SQLite 且任务量不大可以接受
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task or not task.enabled:
            return
        # run_task_once 将被改为 async
        await run_task_once(db, task)
    finally:
        db.close()


TASK_RETRY_DELAY_SECONDS = 600  # 失败后 10 分钟重试一次


def _schedule_task_retry(account_name: str, task_name: str) -> None:
    """失败后注册一次性重试 job，10 分钟后执行，不再产生新重试。"""
    if not scheduler:
        return
    from datetime import datetime, timedelta

    from apscheduler.triggers.date import DateTrigger

    retry_id = f"{_sign_job_id(account_name, task_name)}-retry"
    run_at = datetime.now() + timedelta(seconds=TASK_RETRY_DELAY_SECONDS)
    try:
        scheduler.add_job(
            _job_run_sign_task,
            trigger=DateTrigger(run_date=run_at),
            id=retry_id,
            args=[account_name, task_name, True],   # is_retry=True
            replace_existing=True,
        )
        logger.info(
            "任务 %s 执行失败，将在 %d 分钟后重试 (约 %s)",
            task_name,
            TASK_RETRY_DELAY_SECONDS // 60,
            run_at.strftime("%H:%M:%S"),
        )
    except Exception as e:
        logger.warning("注册重试任务 %s 失败: %s", task_name, e)


async def _job_run_sign_task(
    account_name: str, task_name: str, is_retry: bool = False
) -> None:
    """运行签到任务的 Job 包装器（直接执行，不含随机延迟）"""
    from backend.services.sign_tasks import get_sign_task_service

    prefix = "[重试] " if is_retry else ""
    try:
        sign_task_service = get_sign_task_service()
        task = sign_task_service.get_task(task_name, account_name=account_name)
        if not task or not task.get("enabled", True):
            # 任务已删除或停用时遗留的一次性 job，直接跳过，也不再注册重试
            logger.info("%s签到任务 %s (账号: %s) 不存在或已停用，跳过", prefix, task_name, account_name)
            return
        logger.info("%s开始执行签到任务 %s (账号: %s)", prefix, task_name, account_name)
        result = await sign_task_service.run_task_with_logs(account_name, task_name)
        if result.get("success"):
            logger.info("%s任务 %s 执行成功", prefix, task_name)
        else:
            logger.error("%s任务 %s 执行失败: %s", prefix, task_name, result.get("error"))
            # 账号失效不重试；已经是重试则不再重试
            if not is_retry and not result.get("account_invalid"):
                _schedule_task_retry(account_name, task_name)
    except Exception:
        logger.exception("%s运行签到任务 %s 异常", prefix, task_name)
        if not is_retry:
            _schedule_task_retry(account_name, task_name)


def _schedule_range_random_run(account_name: str, task_name: str, st: dict) -> None:
    """
    range 模式 CRON 触发时调用：在剩余窗口内随机选一个时刻用 DateTrigger 执行。
    相比 asyncio.sleep，DateTrigger 注册到 APScheduler 后进程重启仍可通过
    sync_jobs / schedule_range_catchup 补回，不会因重启丢失当天执行。
    """
    if not scheduler:
        return

    import random
    from datetime import datetime, timedelta

    from apscheduler.triggers.date import DateTrigger

    range_start_str = st.get("range_start", "")
    range_end_str = st.get("range_end", "")
    if not range_start_str or not range_end_str:
        return

    try:
        fmt = "%H:%M"
        now = datetime.now()
        start_t = datetime.strptime(range_start_str, fmt).time()
        end_t = datetime.strptime(range_end_str, fmt).time()

        start_dt = now.replace(hour=start_t.hour, minute=start_t.minute, second=0, microsecond=0)
        end_dt = now.replace(hour=end_t.hour, minute=end_t.minute, second=0, microsecond=0)
        if end_dt <= start_dt:
            end_dt += timedelta(days=1)

        # 在当前时刻到窗口结束之间随机选取
        remaining = (end_dt - now).total_seconds()
        if remaining <= 0:
            logger.warning("任务 %s 窗口已结束，跳过本次随机调度", task_name)
            return

        delay = random.uniform(0, remaining)
        run_at = now + timedelta(seconds=delay)
        # 使用独立 job_id，避免与 schedule_range_catchup 的补执行任务互相覆盖
        job_id = f"{_sign_job_id(account_name, task_name)}-range-run"

        scheduler.add_job(
            _job_run_sign_task,
            trigger=DateTrigger(run_date=run_at),
            id=job_id,
            args=[account_name, task_name],
            replace_existing=True,
        )
        logger.info(
            "任务 %s range 模式，将在 %ds (%.1f 分钟) 后执行 (约 %s)",
            task_name, int(delay), delay / 60, run_at.strftime("%H:%M:%S"),
        )
    except Exception as e:
        logger.warning("range 随机调度失败 %s: %s", task_name, e)


async def _job_health_check_accounts() -> None:
    """定期巡检所有账号 session 是否有效，发现失效立即推送通知。"""
    from backend.services.sign_tasks import get_sign_task_service
    from backend.services.telegram import get_telegram_service

    telegram_service = get_telegram_service()
    sign_task_service = get_sign_task_service()

    accounts = telegram_service.list_accounts()
    if not accounts:
        return

    logger.info("开始账号健康巡检，共 %d 个账号", len(accounts))
    invalid_count = 0
    for account in accounts:
        account_name = account.get("name")
        if not account_name:
            continue
        if account.get("status") == "invalid" and account.get("needs_relogin"):
            invalid_count += 1
            logger.debug("账号 %s 已标记失效，跳过网络巡检", account_name)
            continue
        try:
            result = await telegram_service.check_account_status(account_name)
            if result.get("ok"):
                logger.debug("账号 %s 巡检正常", account_name)
            elif result.get("needs_relogin"):
                invalid_count += 1
                await sign_task_service._mark_account_invalid(
                    account_name,
                    "定期巡检",
                    result.get("message") or "Session 已失效，请重新登录",
                )
                logger.warning("账号 %s 巡检发现 session 失效，已发送通知", account_name)
            else:
                logger.info(
                    "账号 %s 巡检状态: %s (非失效，忽略)", account_name, result.get("status")
                )
        except Exception:
            logger.exception("巡检账号 %s 时发生异常", account_name)

    logger.info("账号健康巡检完成，发现 %d 个失效账号", invalid_count)


async def _job_maintenance() -> None:
    """每日维护任务：清理旧日志等"""
    db: Session = get_session_local()()
    try:
        from backend.services.sign_tasks import get_sign_task_service
        from backend.services.tasks import cleanup_old_logs

        count = cleanup_old_logs(db, days=3)
        logger.info("Maintenance: 已清理 %d 条数据库任务日志", count)
        get_sign_task_service()._cleanup_old_logs()
    finally:
        db.close()


def schedule_range_catchup(account_name: str, task_name: str, st: dict) -> None:
    """
    如果当前时刻处于 range 窗口内且今日尚未执行，添加一次性立即任务。
    用于解决"窗口已开始后才创建/启动任务，当天不执行"的问题。
    """
    if not scheduler:
        return

    import random
    from datetime import datetime, timedelta

    from apscheduler.triggers.date import DateTrigger

    range_start_str = st.get("range_start", "")
    range_end_str = st.get("range_end", "")
    if not range_start_str or not range_end_str:
        return

    try:
        fmt = "%H:%M"
        now = datetime.now()
        start_t = datetime.strptime(range_start_str, fmt).time()
        end_t = datetime.strptime(range_end_str, fmt).time()

        start_dt = now.replace(hour=start_t.hour, minute=start_t.minute, second=0, microsecond=0)
        end_dt = now.replace(hour=end_t.hour, minute=end_t.minute, second=0, microsecond=0)
        if end_dt <= start_dt:
            end_dt += timedelta(days=1)

        if not (start_dt <= now <= end_dt):
            return  # 当前不在窗口内

        # 今日是否已执行过
        last_run = st.get("last_run")
        if isinstance(last_run, dict):
            try:
                last_dt = datetime.fromisoformat(last_run.get("time", ""))
                if last_dt.date() == now.date():
                    logger.debug("任务 %s 今日已执行，跳过窗口补执行", task_name)
                    return
            except Exception:
                pass

        remaining = (end_dt - now).total_seconds()
        if remaining <= 0:
            return

        # 今日已排好随机执行或补执行时不重复安排，避免同一天跑两次、或每次同步都重新随机时间
        base_id = _sign_job_id(account_name, task_name)
        if _has_pending_job(f"{base_id}-range-run") or _has_pending_job(f"{base_id}-catchup"):
            return

        delay = random.uniform(0, remaining)
        run_at = now + timedelta(seconds=delay)
        catchup_id = f"{base_id}-catchup"

        scheduler.add_job(
            _job_run_sign_task,
            trigger=DateTrigger(run_date=run_at),
            id=catchup_id,
            args=[account_name, task_name],
            replace_existing=True,
        )
        logger.info(
            "任务 %s 处于时间窗口 (%s-%s)，将在 %d 秒后执行",
            task_name, range_start_str, range_end_str, int(delay),
        )
    except Exception as e:
        logger.warning("计划窗口补执行任务 %s 失败: %s", task_name, e)


async def sync_jobs() -> None:
    """
    Sync APScheduler jobs from DB tasks table and file-based sign tasks.
    """
    if scheduler is None:
        return

    from backend.services.sign_tasks import get_sign_task_service

    db: Session = get_session_local()()
    try:
        # 1. 同步数据库任务
        tasks = db.query(Task).filter(Task.enabled).all()
        existing_ids = {
            job.id
            for job in scheduler.get_jobs()
            if job.id.startswith("db-") or job.id.startswith("sign-")
        }
        desired_ids = set()

        for task in tasks:
            job_id = f"db-{task.id}"
            desired_ids.add(job_id)

            try:
                trigger = create_cron_trigger(task.cron)
                if job_id in existing_ids:
                    scheduler.reschedule_job(job_id, trigger=trigger)
                else:
                    scheduler.add_job(
                        _job_run_task,
                        trigger=trigger,
                        id=job_id,
                        args=[task.id],
                        replace_existing=True,
                    )
            except Exception as e:
                logger.error("Error scheduling DB task %s: %s", task.id, e)

        # 2. 同步签到任务 (SignTask)
        # 使用缓存的任务列表，减少 I/O
        sign_task_service = get_sign_task_service()
        sign_tasks = sign_task_service.list_tasks(force_refresh=False)
        for st in sign_tasks:
            account_name = str(st.get("account_name") or "").strip()
            task_name = str(st.get("name") or "").strip()
            if not account_name or not task_name:
                logger.warning("Skip scheduling sign task with missing account/name: %s", st)
                continue

            job_id = _sign_job_id(account_name, task_name)
            aux_ids = _sign_aux_job_ids(account_name, task_name)

            if not st.get("enabled", True):
                # 停用：主 job 与待执行的重试/随机执行一并移除（交给下方统一清理）
                continue

            desired_ids.add(job_id)
            # 启用中的任务保留已排队的重试/随机执行/补执行
            desired_ids.update(aux_ids)

            try:
                is_range = st.get("execution_mode") == "range" and st.get("range_start")
                trigger = create_cron_trigger(st["range_start"] if is_range else st["sign_at"])

                # range 模式：CRON 触发时只负责安排随机 DateTrigger，不直接执行
                cron_callback = _schedule_range_random_run if is_range else _job_run_sign_task
                if is_range:
                    # 传轻量副本，防止 job 长期持有可变的大 dict 引用
                    cron_args = [account_name, task_name, {
                        "range_start": st.get("range_start"),
                        "range_end": st.get("range_end"),
                    }]
                else:
                    cron_args = [account_name, task_name]

                scheduler.add_job(
                    cron_callback,
                    trigger=trigger,
                    id=job_id,
                    args=cron_args,
                    replace_existing=True,
                )

                # 若 range 模式且当前处于窗口内、今日未执行，补一次立即执行
                if is_range:
                    schedule_range_catchup(account_name, task_name, st)
            except Exception as e:
                logger.error("Error scheduling sign task %s: %s", task_name, e)

        # remove obsolete jobs（已删除/停用任务的主 job 与辅助 job）
        for job_id in existing_ids - desired_ids:
            _remove_job_quietly(job_id)
    finally:
        db.close()


async def init_scheduler(sync_on_startup: bool = True) -> AsyncIOScheduler:
    global scheduler
    if scheduler is None:
        from backend.core.config import get_settings

        settings = get_settings()
        scheduler = AsyncIOScheduler(
            timezone=settings.timezone,
            job_defaults={
                "misfire_grace_time": 3600,  # 允许任务延迟 1 小时执行
                "coalesce": True,  # 合并积压的执行
                "max_instances": 10,  # 增加并发实例数，避免多账号任务相互阻塞
            },
        )
        scheduler.start()

        # 添加每日凌晨 3 点执行的维护任务
        scheduler.add_job(
            _job_maintenance,
            trigger=CronTrigger.from_crontab("0 3 * * *"),
            id="system-maintenance",
            replace_existing=True,
        )

        # 添加每日 9 点执行的账号健康巡检
        scheduler.add_job(
            _job_health_check_accounts,
            trigger=CronTrigger.from_crontab("0 9 * * *"),
            id="system-health-check",
            replace_existing=True,
        )

        if sync_on_startup:
            await sync_jobs()
    return scheduler


def shutdown_scheduler() -> None:
    global scheduler
    if scheduler:
        scheduler.shutdown(wait=False)
        scheduler = None


def add_or_update_sign_task_job(
    account_name: str,
    task_name: str,
    cron_expression: str,
    enabled: bool = True,
    task_config: dict | None = None,
) -> None:
    """动态添加或更新签到任务 Job"""
    if not scheduler:
        return

    job_id = _sign_job_id(account_name, task_name)

    if not enabled:
        remove_sign_task_job(account_name, task_name)
        return

    try:
        trigger = create_cron_trigger(cron_expression)

        # range 模式：CRON 触发时安排随机 DateTrigger，不直接执行
        is_range = task_config and task_config.get("execution_mode") == "range"
        if is_range:
            callback = _schedule_range_random_run
            args = [account_name, task_name, {
                "range_start": task_config.get("range_start"),
                "range_end": task_config.get("range_end"),
            }]
        else:
            callback = _job_run_sign_task
            args = [account_name, task_name]

        scheduler.add_job(
            callback,
            trigger=trigger,
            id=job_id,
            args=args,
            replace_existing=True,
        )
        logger.info("已添加/更新任务 %s -> %s", job_id, cron_expression)
    except Exception as e:
        logger.error("添加任务 %s 失败: %s", job_id, e)


def clear_pending_range_runs(account_name: str, task_name: str) -> None:
    """清除已排好的 range 随机执行 / 补执行（调度时间变更后按新窗口重新安排）"""
    base_id = _sign_job_id(account_name, task_name)
    _remove_job_quietly(f"{base_id}-range-run")
    _remove_job_quietly(f"{base_id}-catchup")


def remove_sign_task_job(account_name: str, task_name: str) -> None:
    """动态移除签到任务 Job"""
    if not scheduler:
        return

    job_id = _sign_job_id(account_name, task_name)
    try:
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)
            logger.info("已移除任务 %s", job_id)
    except Exception as e:
        logger.error("移除任务 %s 失败: %s", job_id, e)
    for aux_id in _sign_aux_job_ids(account_name, task_name):
        _remove_job_quietly(aux_id)
