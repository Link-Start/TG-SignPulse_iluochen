"""
测试 tg_signer.config 中的动作解析与 SignChatV3 属性逻辑。
无需 Telegram 连接，纯单元测试。
"""

from tg_signer.config import (
    ChooseOptionByImageAction,
    ClickKeyboardByTextAction,
    KeywordNotifyAction,
    SendDiceAction,
    SendTextAction,
    SignChatV3,
    SupportAction,
)

# ── SignChatV3 解析 ──────────────────────────────────────────────────────────


def make_chat(actions: list) -> SignChatV3:
    return SignChatV3.parse_obj(
        {"chat_id": 123, "actions": actions, "action_interval": 1}
    )


def test_send_text_action():
    chat = make_chat([{"action": 1, "text": "/checkin"}])
    assert len(chat.actions) == 1
    act = chat.actions[0]
    assert isinstance(act, SendTextAction)
    assert act.text == "/checkin"
    assert act.action == SupportAction.SEND_TEXT


def test_send_dice_action():
    chat = make_chat([{"action": 2, "dice": "🎯"}])
    act = chat.actions[0]
    assert isinstance(act, SendDiceAction)
    assert act.dice == "🎯"


def test_click_keyboard_action():
    chat = make_chat([{"action": 1, "text": "go"}, {"action": 3, "text": "确认"}])
    assert isinstance(chat.actions[1], ClickKeyboardByTextAction)


def test_choose_option_by_image_question_field():
    chat = make_chat(
        [{"action": 1, "text": "go"}, {"action": 4, "question": "点哪个按钮?"}]
    )
    act = chat.actions[1]
    assert isinstance(act, ChooseOptionByImageAction)
    assert act.question == "点哪个按钮?"


def test_choose_option_by_image_no_question():
    chat = make_chat([{"action": 1, "text": "go"}, {"action": 4}])
    act = chat.actions[1]
    assert act.question is None


def test_keyword_notify_action():
    chat = make_chat(
        [
            {"action": 1, "text": "go"},
            {
                "action": 8,
                "keywords": ["签到成功", "已签到"],
                "match_mode": "contains",
                "ignore_case": True,
                "push_channel": "telegram",
            },
        ]
    )
    act = chat.actions[1]
    assert isinstance(act, KeywordNotifyAction)
    assert "签到成功" in act.keywords
    assert act.push_channel == "telegram"


# ── requires_ai / requires_updates ──────────────────────────────────────────


def test_requires_ai_false_for_text_only():
    chat = make_chat([{"action": 1, "text": "/sign"}])
    assert not chat.requires_ai


def test_requires_ai_true_for_image_action():
    chat = make_chat([{"action": 1, "text": "go"}, {"action": 4}])
    assert chat.requires_ai


def test_requires_ai_true_for_calculation_reply():
    chat = make_chat([{"action": 1, "text": "go"}, {"action": 5}])
    assert chat.requires_ai


def test_requires_updates_false_for_send_only():
    chat = make_chat([{"action": 1, "text": "/sign"}, {"action": 2, "dice": "🎲"}])
    assert not chat.requires_updates


def test_requires_updates_true_for_click_keyboard():
    chat = make_chat([{"action": 1, "text": "go"}, {"action": 3, "text": "ok"}])
    assert chat.requires_updates


def test_requires_updates_true_for_keyword_notify():
    chat = make_chat(
        [
            {"action": 1, "text": "go"},
            {
                "action": 8,
                "keywords": ["ok"],
                "match_mode": "contains",
                "ignore_case": False,
                "push_channel": "telegram",
            },
        ]
    )
    assert chat.requires_updates


# ── SignChatV3 字段默认值 ────────────────────────────────────────────────────


def test_default_action_interval():
    chat = make_chat([{"action": 1, "text": "/sign"}])
    assert chat.action_interval == 1


def test_optional_fields_default_none():
    chat = make_chat([{"action": 1, "text": "/sign"}])
    assert chat.message_thread_id is None
    assert chat.delete_after is None
    assert chat.name is None
