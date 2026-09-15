"""
第二轮稳定性回归测试：
- 关键词监控 watchdog 触发重启时不能取消自己
- 手机号登录放弃后超时释放账号锁，释放时不误放其他持有者的锁
- 全局设置按 mtime 缓存
- accounts.json 并发写不丢数据，读缓存能感知文件变化
- 修改调度时间后清除旧窗口已排好的随机执行
不需要真实 Telegram 连接。
"""

import asyncio
import contextlib
import json
import threading
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest
import pytest_asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger


class _FakeClient:
    def __init__(self, connected: bool = True):
        self.is_connected = connected
        self.exited = False
        self.disconnected = False

    def remove_handler(self, *args):
        pass

    async def __aexit__(self, *args):
        await asyncio.sleep(0)
        self.exited = True

    async def disconnect(self):
        self.disconnected = True


# ── 关键词监控 watchdog ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_watchdog_restart_does_not_cancel_itself():
    from backend.services.keyword_monitor import KeywordMonitorService

    svc = KeywordMonitorService()
    client = _FakeClient(connected=False)
    svc._handler_refs = [("acc", client, ("handler", 0))]
    svc._load_rules = list

    async def fake_watchdog_iteration():
        svc._watchdog_task = asyncio.current_task()
        await svc.restart_from_tasks()
        return "restarted"

    result = await asyncio.wait_for(fake_watchdog_iteration(), timeout=2)

    assert result == "restarted"
    assert client.exited
    assert svc._handler_refs == []


@pytest.mark.asyncio
async def test_stop_still_cancels_watchdog_from_outside():
    from backend.services.keyword_monitor import KeywordMonitorService

    svc = KeywordMonitorService()
    watchdog = asyncio.create_task(asyncio.sleep(3600))
    svc._watchdog_task = watchdog

    await svc.stop()
    await asyncio.sleep(0)

    assert watchdog.cancelled()
    assert svc._watchdog_task is None


# ── 手机号登录超时 ──────────────────────────────────────────────────────────


async def _held(lock: asyncio.Lock):
    import backend.services.telegram as tg

    hold = tg._LoginLockHold(lock)
    await hold.acquire()
    return hold


@pytest.mark.asyncio
async def test_abandoned_phone_login_releases_account_lock():
    import backend.services.telegram as tg

    lock = asyncio.Lock()
    client = _FakeClient()
    tg._login_sessions["acc_+1"] = {"client": client, "lock": await _held(lock)}

    await tg._expire_phone_login("acc_+1", client, 0)

    assert not lock.locked()
    assert "acc_+1" not in tg._login_sessions
    assert client.disconnected


@pytest.mark.asyncio
async def test_phone_login_expiry_ignores_replaced_session():
    import backend.services.telegram as tg

    lock = asyncio.Lock()
    new_client = _FakeClient()
    hold = await _held(lock)
    tg._login_sessions["acc_+1"] = {"client": new_client, "lock": hold}
    try:
        await tg._expire_phone_login("acc_+1", _FakeClient(), 0)

        assert lock.locked()
        assert tg._login_sessions["acc_+1"]["client"] is new_client
    finally:
        tg._login_sessions.pop("acc_+1", None)
        hold.release()


@pytest.mark.asyncio
async def test_login_lock_release_does_not_steal_other_holder():
    """登录已释放过锁、签到任务随后拿到锁时，重复释放不能把任务的锁放掉"""

    lock = asyncio.Lock()
    hold = await _held(lock)
    hold.release()
    await lock.acquire()  # 模拟签到任务持有

    hold.release()
    assert lock.locked()
    lock.release()


@pytest.mark.asyncio
async def test_phone_login_expiry_waits_for_in_progress_verify():
    import backend.services.telegram as tg

    lock = asyncio.Lock()
    client = _FakeClient()
    session = {"client": client, "lock": await _held(lock), "busy": True}
    tg._login_sessions["acc_+1"] = session

    expire = asyncio.create_task(tg._expire_phone_login("acc_+1", client, 0))
    await asyncio.sleep(0.05)
    assert not expire.done()
    assert lock.locked()

    session["busy"] = False
    await asyncio.wait_for(expire, timeout=3)
    assert not lock.locked()
    assert "acc_+1" not in tg._login_sessions


@pytest.mark.asyncio
async def test_verify_login_rejects_duplicate_submit():
    import backend.services.telegram as tg

    tg._login_sessions["acc_+1"] = {"client": _FakeClient(), "lock": None, "busy": True}
    try:
        svc = tg.TelegramService.__new__(tg.TelegramService)
        with pytest.raises(ValueError, match="重复提交"):
            await svc.verify_login("acc", "+1", "12345", "hash")
    finally:
        tg._login_sessions.pop("acc_+1", None)


# ── 全局设置缓存 ────────────────────────────────────────────────────────────


@pytest.fixture
def config_service(tmp_path):
    from backend.services.config import ConfigService

    svc = ConfigService.__new__(ConfigService)
    svc.workdir = tmp_path
    svc._global_settings_lock = threading.RLock()
    svc._global_settings_cache = None
    # 避免测试读写真实的数据目录覆盖配置
    with (
        patch("backend.services.config.load_data_dir_override", return_value=None),
        patch("backend.services.config.clear_data_dir_override"),
    ):
        yield svc


def test_global_settings_cache_returns_copies_and_sees_changes(config_service):
    svc = config_service
    assert svc.get_global_settings()["log_retention_days"] == 7

    assert svc.save_global_settings({"global_proxy": "socks5://a:1"})
    first = svc.get_global_settings()
    assert first["global_proxy"] == "socks5://a:1"
    first["global_proxy"] = "mutated"
    assert svc.get_global_settings()["global_proxy"] == "socks5://a:1"

    path = svc._get_global_settings_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    data["global_proxy"] = "http://changed-outside:2"
    path.write_text(json.dumps(data), encoding="utf-8")
    assert svc.get_global_settings()["global_proxy"] == "http://changed-outside:2"


def test_global_settings_cache_avoids_reparsing(config_service):
    svc = config_service
    svc.save_global_settings({"sign_interval": 5})
    svc.get_global_settings()
    with patch(
        "backend.services.config.json.load", side_effect=AssertionError("reparsed")
    ):
        assert svc.get_global_settings()["sign_interval"] == 5


# ── accounts.json ───────────────────────────────────────────────────────────


@pytest.fixture
def account_store(tmp_path):
    import backend.utils.tg_session as ts

    path = tmp_path / "accounts.json"
    with patch.object(ts, "_account_store_path", return_value=path):
        ts._ACCOUNT_STORE_CACHE = None
        yield ts, path
        ts._ACCOUNT_STORE_CACHE = None


def test_concurrent_account_writes_do_not_lose_updates(account_store):
    ts, path = account_store
    errors: list[BaseException] = []

    def worker(idx: int) -> None:
        try:
            for j in range(20):
                ts.set_account_profile(f"acc{idx}", remark=f"r{j}")
                ts.set_account_status(f"acc{idx}", status="connected")
        except BaseException as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert errors == []
    data = json.loads(path.read_text(encoding="utf-8"))
    assert sorted(data["accounts"]) == [f"acc{i}" for i in range(8)]
    assert all(entry["remark"] == "r19" for entry in data["accounts"].values())


def test_account_store_cache_sees_external_changes(account_store):
    ts, path = account_store
    ts.set_account_profile("acc", remark="old")
    assert ts.get_account_remark("acc") == "old"

    data = json.loads(path.read_text(encoding="utf-8"))
    data["accounts"]["acc"]["remark"] = "changed-outside"
    path.write_text(json.dumps(data), encoding="utf-8")

    assert ts.get_account_remark("acc") == "changed-outside"


# ── 修改调度时间清除旧的随机执行 ────────────────────────────────────────────


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


@pytest.mark.asyncio
async def test_update_task_schedule_clears_stale_range_run(tmp_path, scheduler_module):
    from backend.services.sign_tasks import SignTaskService

    sched = scheduler_module
    fake_settings = SimpleNamespace(resolve_workdir=lambda: tmp_path)
    with patch("backend.core.config.get_settings", return_value=fake_settings):
        svc = SignTaskService()
    svc._append_scheduler_log = lambda *a, **k: None

    task_dir = svc.signs_dir / "acc" / "daily"
    task_dir.mkdir(parents=True)
    (task_dir / "config.json").write_text(
        json.dumps(
            {
                "account_name": "acc",
                "sign_at": "0 8 * * *",
                "chats": [],
                "execution_mode": "range",
                "range_start": "08:00",
                "range_end": "09:00",
                "last_run": {"time": datetime.now().isoformat()},
            }
        ),
        encoding="utf-8",
    )
    sched.scheduler.add_job(
        lambda: None,
        trigger=DateTrigger(run_date=datetime.now() + timedelta(hours=1)),
        id="sign-acc-daily-range-run",
    )

    svc.update_task("daily", account_name="acc", random_seconds=5)
    assert sched.scheduler.get_job("sign-acc-daily-range-run") is not None

    svc.update_task("daily", account_name="acc", range_start="20:00", range_end="21:00")
    assert sched.scheduler.get_job("sign-acc-daily-range-run") is None


# ── WebSocket 登录失效 ──────────────────────────────────────────────────────


def test_sign_task_ws_closes_with_4401_on_invalid_token():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect

    import backend.api.routes.sign_tasks as routes

    app = FastAPI()
    app.include_router(routes.router, prefix="/api/sign-tasks")
    with (
        patch.object(
            routes,
            "get_session_local",
            return_value=lambda: contextlib.nullcontext(None),
        ),
        patch.object(routes, "verify_token", return_value=None),
    ):
        client = TestClient(app)
        url = "/api/sign-tasks/ws/daily?account_name=acc&token=bad"
        with (
            pytest.raises(WebSocketDisconnect) as exc,
            client.websocket_connect(url) as ws,
        ):
            ws.receive_json()
    assert exc.value.code == routes.WS_CLOSE_UNAUTHORIZED == 4401
