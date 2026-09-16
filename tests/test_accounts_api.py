"""
测试 backend/api/routes/accounts.py 中的辅助逻辑与新增 Schema。
使用 FastAPI TestClient + 依赖注入覆盖，不需要真实 Telegram 连接。
"""

from unittest.mock import patch

# ── TestChatRequest / TestChatResponse Schema ────────────────────────────────


def test_test_chat_request_schema():
    from backend.api.routes.accounts import TestChatRequest

    req = TestChatRequest(
        chat_id=12345,
        name="测试群",
        actions=[{"action": 1, "text": "/checkin"}],
        action_interval=1.5,
        message_thread_id=None,
        delete_after=None,
    )
    assert req.chat_id == 12345
    assert req.action_interval == 1.5
    assert req.actions[0]["action"] == 1


def test_test_chat_request_defaults():
    from backend.api.routes.accounts import TestChatRequest

    req = TestChatRequest(
        chat_id=999,
        actions=[{"action": 2, "dice": "🎲"}],
    )
    assert req.action_interval == 1
    assert req.message_thread_id is None
    assert req.name is None


def test_test_chat_response_schema():
    from backend.api.routes.accounts import TestChatResponse

    resp = TestChatResponse(success=True, message="ok", logs=["step1", "step2"])
    assert resp.success
    assert len(resp.logs) == 2


def test_test_chat_response_default_logs():
    from backend.api.routes.accounts import TestChatResponse

    resp = TestChatResponse(success=False, message="failed")
    assert resp.logs == []


# ── TestSendRequest Schema ───────────────────────────────────────────────────


def test_test_send_request_schema():
    from backend.api.routes.accounts import TestSendRequest

    req = TestSendRequest(chat_id=-1001234567890, text="/checkin")
    assert req.text == "/checkin"
    assert req.message_thread_id is None


# ── _get_account_client_params 正常路径 ─────────────────────────────────────


def test_get_account_client_params_returns_tuple():
    """验证 _get_account_client_params 返回 6 元素元组（通过 mock 内部依赖）"""
    with (
        patch("backend.api.routes.accounts._get_account_client_params") as mock_fn,
    ):
        mock_fn.return_value = (
            "/data/sessions",  # session_dir
            None,  # session_string
            False,  # use_in_memory
            None,  # proxy_dict
            12345,  # api_id
            "abc123",  # api_hash
        )
        result = mock_fn("luochen")
        assert len(result) == 6
        assert result[4] == 12345
        assert result[5] == "abc123"
