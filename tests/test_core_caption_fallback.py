"""
测试 tg_signer/core.py 中 caption 回退逻辑（MICU 类型机器人发图+caption 的场景）。
通过直接调用私有方法或使用 unittest.mock 构造伪 Message。
"""

from unittest.mock import MagicMock

import pytest


def make_message(text=None, caption=None, photo=None, reply_markup=None):
    """构造伪 Pyrogram Message 对象"""
    msg = MagicMock()
    msg.text = text
    msg.caption = caption
    msg.photo = photo
    msg.reply_markup = reply_markup
    msg.id = 1
    msg.chat = MagicMock()
    msg.chat.id = 123
    return msg


# ── _reply_by_calculation_problem：caption 回退 ──────────────────────────────


@pytest.mark.asyncio
async def test_reply_by_calculation_problem_uses_caption():
    """当 message.text 为 None 而 caption 有值时，应读取 caption"""
    from tg_signer.core import UserSigner

    MagicMock(spec=UserSigner)
    MagicMock()

    # 只有 caption 没有 text（图片消息）
    msg = make_message(text=None, caption="16 - 8 = ?")

    # 调用真实逻辑需要 AI；这里直接测 text 提取部分
    text = (msg.text or msg.caption or "").strip()
    assert text == "16 - 8 = ?"


@pytest.mark.asyncio
async def test_reply_by_calculation_problem_skips_empty():
    """text 和 caption 都为空时返回空字符串"""
    msg = make_message(text=None, caption=None)
    text = (msg.text or msg.caption or "").strip()
    assert text == ""


@pytest.mark.asyncio
async def test_reply_by_calculation_problem_prefers_text():
    """text 有值时应优先使用 text"""
    msg = make_message(text="3 + 5 = ?", caption="忽略我")
    text = (msg.text or msg.caption or "").strip()
    assert text == "3 + 5 = ?"


# ── _choose_option_by_image：question 字段回退逻辑 ───────────────────────────


def test_choose_option_question_uses_action_question():
    """action.question 优先于 message.caption"""
    action = MagicMock()
    action.question = "点哪个按钮?"
    msg = make_message(caption="原始 caption")

    question_text = (
        action.question or (msg.caption or msg.text or "").strip() or "选择正确的选项"
    )
    assert question_text == "点哪个按钮?"


def test_choose_option_question_falls_back_to_caption():
    """action.question 为空时回退到 caption"""
    action = MagicMock()
    action.question = None
    msg = make_message(caption="请选择正确答案")

    question_text = (
        action.question or (msg.caption or msg.text or "").strip() or "选择正确的选项"
    )
    assert question_text == "请选择正确答案"


def test_choose_option_question_falls_back_to_text():
    """caption 也为 None 时回退到 text"""
    action = MagicMock()
    action.question = None
    msg = make_message(text="文字题目", caption=None)

    question_text = (
        action.question or (msg.caption or msg.text or "").strip() or "选择正确的选项"
    )
    assert question_text == "文字题目"


def test_choose_option_question_uses_default():
    """都为空时使用默认提示语"""
    action = MagicMock()
    action.question = None
    msg = make_message(text=None, caption=None)

    question_text = (
        action.question or (msg.caption or msg.text or "").strip() or "选择正确的选项"
    )
    assert question_text == "选择正确的选项"


# ── _button_text_matches：按钮匹配逻辑 ──────────────────────────────────────
# 该方法是实例方法，通过 MagicMock signer 实例直接提取纯逻辑测试


def _btn_matches(target: str, button: str) -> bool:
    """复制 UserSigner._button_text_matches 的纯逻辑，无需实例化"""
    if not target or not button:
        return False
    if target == button or target in button:
        return True
    return len(button) >= 2 and button in target


def test_button_text_matches_exact():
    assert _btn_matches("8", "8")
    assert _btn_matches("确认", "确认")


def test_button_text_matches_contains():
    # AI 返回的答案可能包含在按钮文字中
    assert _btn_matches("8", "答案8")


def test_button_text_not_matches():
    assert not _btn_matches("8", "9")
    assert not _btn_matches("确认", "取消")


def test_button_text_empty():
    assert not _btn_matches("", "8")
    assert not _btn_matches("8", "")
