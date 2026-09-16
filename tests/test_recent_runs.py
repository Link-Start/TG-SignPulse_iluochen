"""
批量近期执行结果接口（首页 30 天状态条）：
- 只返回窗口内的记录，且只含时间与成败
- 没有历史的任务也会出现在结果里
- 历史文件变化后缓存失效
- 路由不会被 /{task_name} 系列路由吞掉
"""

import json
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest


@pytest.fixture
def sign_service(tmp_path):
    from backend.services.sign_tasks import SignTaskService

    fake_settings = SimpleNamespace(resolve_workdir=lambda: tmp_path)
    with patch("backend.core.config.get_settings", return_value=fake_settings):
        svc = SignTaskService()

    for account, task in (("acc", "daily"), ("acc", "fresh")):
        task_dir = svc.signs_dir / account / task
        task_dir.mkdir(parents=True)
        (task_dir / "config.json").write_text(
            json.dumps({"account_name": account, "sign_at": "0 8 * * *"}),
            encoding="utf-8",
        )
    return svc


def _write_history(svc, account, task, entries):
    path = svc.run_history_dir / f"{account}__{task}.json"
    path.write_text(json.dumps(entries), encoding="utf-8")
    return path


def test_recent_runs_filters_window_and_strips_logs(sign_service):
    now = datetime.now()
    _write_history(
        sign_service,
        "acc",
        "daily",
        [
            {
                "time": now.isoformat(),
                "success": True,
                "account_name": "acc",
                "flow_logs": ["x" * 100],
            },
            {
                "time": (now - timedelta(days=3)).isoformat(),
                "success": False,
                "account_name": "acc",
            },
            {
                "time": (now - timedelta(days=45)).isoformat(),
                "success": True,
                "account_name": "acc",
            },
            {"time": "not-a-date", "success": True, "account_name": "acc"},
        ],
    )

    result = {item["task_name"]: item for item in sign_service.get_recent_runs(30)}

    assert set(result) == {"daily", "fresh"}
    assert result["fresh"]["runs"] == []
    runs = result["daily"]["runs"]
    assert [run["success"] for run in runs] == [True, False]
    assert all(set(run) == {"time", "success"} for run in runs)


def test_recent_runs_cache_follows_file_changes(sign_service):
    now = datetime.now().isoformat()
    path = _write_history(
        sign_service,
        "acc",
        "daily",
        [{"time": now, "success": True, "account_name": "acc"}],
    )
    first = sign_service.get_recent_runs(30)
    assert [r["success"] for r in first[0]["runs"]] == [True]

    path.write_text(
        json.dumps(
            [
                {"time": now, "success": False, "account_name": "acc"},
                {"time": now, "success": True, "account_name": "acc"},
            ]
        ),
        encoding="utf-8",
    )
    second = sign_service.get_recent_runs(30)
    assert [r["success"] for r in second[0]["runs"]] == [False, True]


def test_recent_runs_route_is_not_shadowed(sign_service):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    import backend.api.routes.sign_tasks as routes

    app = FastAPI()
    app.include_router(routes.router, prefix="/api/sign-tasks")
    app.dependency_overrides[routes.get_current_user] = lambda: object()
    with patch.object(routes, "get_sign_task_service", return_value=sign_service):
        client = TestClient(app)
        resp = client.get("/api/sign-tasks/history/recent?days=7")
        assert resp.status_code == 200
        assert {item["task_name"] for item in resp.json()} == {"daily", "fresh"}

        assert client.get("/api/sign-tasks/history/recent?days=0").status_code == 422
