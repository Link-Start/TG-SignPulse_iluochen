"""
调度同步与任务收尾时序的回归测试：
- sync_jobs 不能误删启用任务的重试 / range 随机执行 / 补执行 job
- 任务结束时先写结果再清运行标记，Bot 通知不阻塞收尾
不需要真实 Telegram 连接。
"""

import asyncio
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger


async def _noop(*args, **kwargs):
    return None


def _fake_session_local():
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    return lambda: db


@pytest_asyncio.fixture
async def scheduler_module():
    import backend.scheduler as sched

    scheduler = AsyncIOScheduler()
    scheduler.start(paused=True)
    old = sched.scheduler
    sched.scheduler = scheduler
    try:
        yield sched
    finally:
        scheduler.shutdown(wait=False)
        sched.scheduler = old


def _add_date_job(sched, job_id: str) -> None:
    from datetime import datetime, timedelta

    sched.scheduler.add_job(
        _noop,
        trigger=DateTrigger(run_date=datetime.now() + timedelta(hours=1)),
        id=job_id,
    )


async def _run_sync(sched, tasks: list[dict]) -> set[str]:
    service = MagicMock()
    service.list_tasks.return_value = tasks
    with (
        patch.object(sched, "get_session_local", return_value=_fake_session_local()),
        patch(
            "backend.services.sign_tasks.get_sign_task_service", return_value=service
        ),
    ):
        await sched.sync_jobs()
    return {job.id for job in sched.scheduler.get_jobs()}


@pytest.mark.asyncio
async def test_sync_jobs_keeps_aux_jobs_of_enabled_tasks(scheduler_module):
    sched = scheduler_module
    for suffix in ("-retry", "-range-run", "-catchup"):
        _add_date_job(sched, f"sign-acc-daily{suffix}")

    ids = await _run_sync(
        sched,
        [
            {
                "account_name": "acc",
                "name": "daily",
                "enabled": True,
                "sign_at": "0 8 * * *",
            }
        ],
    )

    assert "sign-acc-daily" in ids
    assert {
        "sign-acc-daily-retry",
        "sign-acc-daily-range-run",
        "sign-acc-daily-catchup",
    } <= ids


@pytest.mark.asyncio
async def test_sync_jobs_removes_aux_jobs_of_deleted_and_disabled_tasks(
    scheduler_module,
):
    sched = scheduler_module
    _add_date_job(sched, "sign-acc-gone-retry")
    _add_date_job(sched, "sign-acc-off")
    _add_date_job(sched, "sign-acc-off-range-run")

    ids = await _run_sync(
        sched,
        [
            {
                "account_name": "acc",
                "name": "off",
                "enabled": False,
                "sign_at": "0 8 * * *",
            }
        ],
    )

    assert ids == set()


@pytest.mark.asyncio
async def test_remove_sign_task_job_clears_aux_jobs(scheduler_module):
    sched = scheduler_module
    _add_date_job(sched, "sign-acc-daily")
    _add_date_job(sched, "sign-acc-daily-retry")

    sched.remove_sign_task_job("acc", "daily")

    assert sched.scheduler.get_jobs() == []


@pytest.mark.asyncio
async def test_range_catchup_skips_when_run_already_pending(scheduler_module):
    sched = scheduler_module
    _add_date_job(sched, "sign-acc-daily-range-run")
    st = {"range_start": "00:00", "range_end": "23:59"}

    sched.schedule_range_catchup("acc", "daily", st)

    assert sched.scheduler.get_job("sign-acc-daily-catchup") is None


@pytest.mark.asyncio
async def test_job_skips_deleted_task_without_retry(scheduler_module):
    sched = scheduler_module
    service = MagicMock()
    service.get_task.return_value = None
    with patch(
        "backend.services.sign_tasks.get_sign_task_service", return_value=service
    ):
        await sched._job_run_sign_task("acc", "gone")

    service.run_task_with_logs.assert_not_called()
    assert sched.scheduler.get_job("sign-acc-gone-retry") is None


# ── 任务收尾时序 ────────────────────────────────────────────────────────────


@pytest.fixture
def sign_service(tmp_path):
    from backend.services.sign_tasks import SignTaskService

    fake_settings = SimpleNamespace(resolve_workdir=lambda: tmp_path)
    with patch("backend.core.config.get_settings", return_value=fake_settings):
        return SignTaskService()


@pytest.mark.asyncio
async def test_result_is_written_before_running_flag_is_cleared(sign_service):
    svc = sign_service
    key = ("acc", "daily")
    observed = {}
    notify_started = asyncio.Event()
    release_notify = asyncio.Event()

    def fake_save(*args, **kwargs):
        observed["running_during_save"] = svc.is_task_running("daily", "acc")

    async def slow_notify(*args, **kwargs):
        notify_started.set()
        await release_notify.wait()

    svc._save_run_info = fake_save
    svc._send_failure_notification = slow_notify
    # 任务配置不存在 → 走普通失败路径（会发送失败通知）
    svc.get_task = lambda *a, **k: None

    result = await asyncio.wait_for(svc.run_task_with_logs("acc", "daily"), timeout=5)

    assert result["success"] is False
    # 保存历史时仍处于运行中，此时 WebSocket 不会提前判定结束
    assert observed["running_during_save"] is True
    # 返回时（通知仍卡在后台）结果已可读、运行标记已清除
    assert not svc.is_task_running("daily", "acc")
    assert svc.get_last_run_result("daily", "acc")["success"] is False
    await asyncio.wait_for(notify_started.wait(), timeout=1)

    release_notify.set()
    for job in list(svc._background_jobs):
        await job
    svc._cleanup_tasks[key].cancel()


def test_list_tasks_returns_copies(sign_service):
    svc = sign_service
    svc._tasks_cache = [{"name": "daily", "account_name": "acc"}]

    tasks = svc.list_tasks()
    tasks[0]["next_run_time"] = "x"

    assert "next_run_time" not in svc._tasks_cache[0]
    assert svc.list_tasks(account_name="other") == []
