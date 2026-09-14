"""
账号管理 API 路由（重构版）
基于原项目逻辑，使用手机号登录
"""

from __future__ import annotations

import asyncio
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.models.user import User
from backend.services.telegram import get_telegram_service

router = APIRouter()
logger = logging.getLogger("backend.qr_login")


# ============ Schemas ============


class LoginStartRequest(BaseModel):
    """开始登录请求"""

    account_name: str
    phone_number: str
    proxy: str | None = None


class LoginStartResponse(BaseModel):
    """开始登录响应"""

    phone_code_hash: str
    phone_number: str
    account_name: str
    message: str = "验证码已发送到您的手机"


class LoginVerifyRequest(BaseModel):
    """验证登录请求"""

    account_name: str
    phone_number: str
    phone_code: str
    phone_code_hash: str
    password: str | None = None  # 2FA 密码
    proxy: str | None = None


class LoginVerifyResponse(BaseModel):
    """验证登录响应"""

    success: bool
    user_id: int | None = None
    first_name: str | None = None
    username: str | None = None
    message: str


class QrLoginStartRequest(BaseModel):
    """扫码登录请求"""

    account_name: str
    proxy: str | None = None


class QrLoginStartResponse(BaseModel):
    """扫码登录开始响应"""

    login_id: str
    qr_uri: str
    qr_image: str | None = None
    expires_at: str


class AccountInfo(BaseModel):
    """账号信息"""

    name: str
    session_file: str
    exists: bool
    size: int
    remark: str | None = None
    proxy: str | None = None
    status: str = "connected"
    status_message: str | None = None
    status_code: str | None = None
    status_checked_at: str | None = None
    needs_relogin: bool = False


class QrLoginStatusResponse(BaseModel):
    """扫码登录状态响应"""

    status: str
    expires_at: str | None = None
    message: str | None = None
    account: AccountInfo | None = None
    user_id: int | None = None
    first_name: str | None = None
    username: str | None = None


class QrLoginCancelRequest(BaseModel):
    """扫码登录取消请求"""

    login_id: str


class QrLoginCancelResponse(BaseModel):
    """扫码登录取消响应"""

    success: bool
    message: str


class QrLoginPasswordRequest(BaseModel):
    """扫码登录 2FA 密码请求"""

    login_id: str
    password: str


class QrLoginPasswordResponse(BaseModel):
    """扫码登录 2FA 密码响应"""

    success: bool
    message: str
    account: AccountInfo | None = None
    user_id: int | None = None
    first_name: str | None = None
    username: str | None = None


class AccountListResponse(BaseModel):
    """账号列表响应"""

    accounts: list[AccountInfo]
    total: int


class DeleteAccountResponse(BaseModel):
    """删除账号响应"""

    success: bool
    message: str


class AccountUpdateRequest(BaseModel):
    """更新账号备注/代理"""

    remark: str | None = None
    proxy: str | None = None


class AccountUpdateResponse(BaseModel):
    """更新账号响应"""

    success: bool
    message: str
    account: AccountInfo | None = None


class AccountStatusCheckRequest(BaseModel):
    """批量账号状态检测请求"""

    account_names: list[str] | None = None
    timeout_seconds: float = 6.0


class AccountStatusItem(BaseModel):
    """账号状态检测结果"""

    account_name: str
    ok: bool
    status: str
    message: str = ""
    code: str | None = None
    checked_at: str | None = None
    needs_relogin: bool = False
    user_id: int | None = None


class AccountStatusCheckResponse(BaseModel):
    """批量账号状态检测响应"""

    results: list[AccountStatusItem]


# ============ API Routes ============


@router.post("/login/start", response_model=LoginStartResponse)
async def start_account_login(
    request: LoginStartRequest, current_user: User = Depends(get_current_user)
):
    """
    开始账号登录流程（发送验证码）

    1. 用户输入账号名和手机号
    2. 系统发送验证码到手机
    3. 返回 phone_code_hash 用于后续验证
    """
    try:
        result = await get_telegram_service().start_login(
            account_name=request.account_name,
            phone_number=request.phone_number,
            proxy=request.proxy,
        )

        return LoginStartResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"发送验证码失败: {e!s}",
        )


@router.post("/login/verify", response_model=LoginVerifyResponse)
async def verify_account_login(
    request: LoginVerifyRequest, current_user: User = Depends(get_current_user)
):
    """
    验证账号登录（输入验证码和可选的2FA密码）

    1. 用户输入验证码
    2. 如果启用了2FA，还需要输入2FA密码
    3. 验证成功后，生成 session 文件
    """
    try:
        result = await get_telegram_service().verify_login(
            account_name=request.account_name,
            phone_number=request.phone_number,
            phone_code=request.phone_code,
            phone_code_hash=request.phone_code_hash,
            password=request.password,
            proxy=request.proxy,
        )

        return LoginVerifyResponse(
            success=True,
            user_id=result.get("user_id"),
            first_name=result.get("first_name"),
            username=result.get("username"),
            message="登录成功",
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"登录验证失败: {e!s}",
        )


@router.post("/qr/start", response_model=QrLoginStartResponse)
async def start_qr_login(
    request: QrLoginStartRequest, current_user: User = Depends(get_current_user)
):
    """开始扫码登录流程"""
    try:
        result = await get_telegram_service().start_qr_login(
            account_name=request.account_name, proxy=request.proxy
        )

        qr_image = None
        try:
            import base64
            from io import BytesIO

            import qrcode

            qr = qrcode.QRCode(version=1, box_size=8, border=2)
            qr.add_data(result["qr_uri"])
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buf = BytesIO()
            img.save(buf, format="PNG")
            qr_image = "data:image/png;base64," + base64.b64encode(
                buf.getvalue()
            ).decode("utf-8")
        except Exception:
            qr_image = None

        return QrLoginStartResponse(
            login_id=result["login_id"],
            qr_uri=result["qr_uri"],
            qr_image=qr_image,
            expires_at=result["expires_at"],
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"开始扫码登录失败: {e!s}",
        )


@router.get("/qr/status", response_model=QrLoginStatusResponse)
async def get_qr_login_status(
    login_id: str, current_user: User = Depends(get_current_user)
):
    """获取扫码登录状态"""
    try:
        result = await get_telegram_service().get_qr_login_status(login_id)
        account = result.get("account")
        if account:
            account = AccountInfo(**account)
        return QrLoginStatusResponse(
            status=result.get("status"),
            expires_at=result.get("expires_at"),
            message=result.get("message"),
            account=account,
            user_id=result.get("user_id"),
            first_name=result.get("first_name"),
            username=result.get("username"),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取扫码状态失败: {e!s}",
        )


@router.post("/qr/password", response_model=QrLoginPasswordResponse)
async def submit_qr_login_password(
    request: QrLoginPasswordRequest, current_user: User = Depends(get_current_user)
):
    """提交扫码登录 2FA 密码"""
    try:
        result = await get_telegram_service().submit_qr_password(
            request.login_id, request.password
        )
        account = result.get("account")
        if account:
            account = AccountInfo(**account)
        return QrLoginPasswordResponse(
            success=True,
            message=result.get("message", "登录成功"),
            account=account,
            user_id=result.get("user_id"),
            first_name=result.get("first_name"),
            username=result.get("username"),
        )
    except ValueError as e:
        logger.warning("qr_password_failed login_id=%s error=%s", request.login_id, e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"提交 2FA 密码失败: {e!s}",
        )


@router.post("/qr/cancel", response_model=QrLoginCancelResponse)
async def cancel_qr_login(
    request: QrLoginCancelRequest, current_user: User = Depends(get_current_user)
):
    """取消扫码登录"""
    try:
        success = await get_telegram_service().cancel_qr_login(request.login_id)
        return QrLoginCancelResponse(
            success=success,
            message="已取消" if success else "登录已失效",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"取消扫码登录失败: {e!s}",
        )


@router.get("", response_model=AccountListResponse)
def list_accounts(current_user: User = Depends(get_current_user)):
    """
    获取所有账号列表

    返回所有 session 文件对应的账号
    """
    try:
        accounts = get_telegram_service().list_accounts()

        return AccountListResponse(
            accounts=[AccountInfo(**acc) for acc in accounts], total=len(accounts)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取账号列表失败: {e!s}",
        )


@router.post("/status/check", response_model=AccountStatusCheckResponse)
async def check_accounts_status(
    request: AccountStatusCheckRequest, current_user: User = Depends(get_current_user)
):
    """
    批量检测账号状态。

    说明：
    - 默认按当前账号列表检测；
    - 顺序检测并做轻微节流，避免刷新页面时触发请求洪峰。
    """
    service = get_telegram_service()
    try:
        if request.account_names:
            names = []
            seen = set()
            for name in request.account_names:
                normalized = (name or "").strip()
                if not normalized or normalized in seen:
                    continue
                seen.add(normalized)
                names.append(normalized)
        else:
            names = [item.get("name", "") for item in service.list_accounts()]
            names = [n for n in names if n]

        timeout_seconds = max(1.0, min(float(request.timeout_seconds or 8.0), 20.0))
        results: list[AccountStatusItem] = []
        for idx, name in enumerate(names):
            try:
                item = await service.check_account_status(
                    name, timeout_seconds=timeout_seconds
                )
            except Exception as exc:
                item = {
                    "account_name": name,
                    "ok": False,
                    "status": "error",
                    "message": str(exc) or "status check failed",
                    "code": "STATUS_CHECK_FAILED",
                    "checked_at": None,
                    "needs_relogin": False,
                }
            results.append(AccountStatusItem(**item))
            if idx < len(names) - 1:
                await asyncio.sleep(0.15)

        return AccountStatusCheckResponse(results=results)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"账号状态检测失败: {e!s}",
        )


@router.delete("/{account_name}", response_model=DeleteAccountResponse)
async def delete_account(
    account_name: str, current_user: User = Depends(get_current_user)
):
    """
    删除账号（删除 session 文件）

    注意：删除后无法恢复，需要重新登录
    """
    try:
        success = await get_telegram_service().delete_account(account_name)

        if success:
            return DeleteAccountResponse(
                success=True, message=f"账号 {account_name} 已删除"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"账号 {account_name} 不存在",
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除账号失败: {e!s}",
        )


@router.get("/{account_name}/exists")
def check_account_exists(
    account_name: str, current_user: User = Depends(get_current_user)
):
    """检查账号是否存在"""
    exists = get_telegram_service().account_exists(account_name)
    return {"exists": exists, "account_name": account_name}


class TestSendRequest(BaseModel):
    chat_id: int
    text: str
    message_thread_id: int | None = None


class TestSendResponse(BaseModel):
    success: bool
    message: str


class TestChatRequest(BaseModel):
    chat_id: int
    name: str | None = None
    actions: list
    action_interval: float = 1
    message_thread_id: int | None = None
    delete_after: int | None = None


class TestChatResponse(BaseModel):
    success: bool
    message: str
    logs: list[str] = []


def _get_account_client_params(account_name: str):
    """返回 (session_dir, session_string, use_in_memory, proxy_dict, api_id, api_hash)"""
    import os

    from backend.core.config import get_settings
    from backend.services.config import get_config_service
    from backend.utils.account_locks import get_account_lock  # noqa: F401 (re-exported)
    from backend.utils.proxy import build_proxy_dict
    from backend.utils.tg_session import (
        get_account_proxy,
        get_account_session_string,
        get_session_mode,
        load_session_string_file,
    )

    settings = get_settings()
    session_dir = settings.resolve_session_dir()

    proxy_value = get_account_proxy(account_name)
    if not proxy_value:
        try:
            proxy_value = get_config_service().get_global_settings().get("global_proxy")
        except Exception:
            proxy_value = None
    proxy_dict = build_proxy_dict(proxy_value) if proxy_value else None

    session_mode = get_session_mode()
    session_string = None
    use_in_memory = False
    if session_mode == "string":
        session_string = (
            get_account_session_string(account_name)
            or load_session_string_file(session_dir, account_name)
        )
        use_in_memory = bool(session_string)

    tg_config = get_config_service().get_telegram_config()
    api_id = os.getenv("TG_API_ID") or tg_config.get("api_id")
    api_hash = os.getenv("TG_API_HASH") or tg_config.get("api_hash")
    try:
        api_id = int(api_id) if api_id is not None else None
    except (TypeError, ValueError):
        api_id = None
    if isinstance(api_hash, str):
        api_hash = api_hash.strip()

    return session_dir, session_string, use_in_memory, proxy_dict, api_id, api_hash


@router.post("/{account_name}/test-send", response_model=TestSendResponse)
async def test_send_message(
    account_name: str,
    request: TestSendRequest,
    current_user: User = Depends(get_current_user),
):
    """向指定 Chat 发送一条测试消息"""
    from backend.utils.account_locks import get_account_lock
    from tg_signer.core import get_client

    service = get_telegram_service()
    if not service.account_exists(account_name):
        raise HTTPException(status_code=404, detail="账号不存在")

    session_dir, session_string, in_memory, proxy_dict, _api_id, _api_hash = (
        _get_account_client_params(account_name)
    )
    if in_memory and not session_string:
        raise HTTPException(status_code=400, detail="账号 session 不存在或已失效")

    try:
        client = get_client(
            account_name,
            proxy=proxy_dict,
            workdir=str(session_dir),
            session_string=session_string,
            in_memory=in_memory,
            no_updates=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"初始化客户端失败: {e}")

    try:
        lock = get_account_lock(account_name)
        async with lock:
            if not getattr(client, "is_connected", False):
                await client.connect()
            kwargs = {}
            if request.message_thread_id:
                kwargs["message_thread_id"] = request.message_thread_id
            await asyncio.wait_for(
                client.send_message(request.chat_id, request.text, **kwargs),
                timeout=15.0,
            )
        return TestSendResponse(success=True, message="发送成功")
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="发送超时")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"发送失败: {e}")


@router.post("/{account_name}/test-chat", response_model=TestChatResponse)
async def test_run_chat(
    account_name: str,
    request: TestChatRequest,
    current_user: User = Depends(get_current_user),
):
    """执行目标聊天配置的实际动作序列（测试用）"""
    import logging

    from pyrogram import filters as tg_filters
    from pyrogram.handlers import EditedMessageHandler, MessageHandler

    from backend.services.sign_tasks import BackendUserSigner, TaskLogHandler
    from backend.utils.account_locks import get_account_lock
    from backend.utils.tg_session import get_global_semaphore
    from tg_signer.config import SignChatV3

    service = get_telegram_service()
    if not service.account_exists(account_name):
        raise HTTPException(status_code=404, detail="账号不存在")

    try:
        chat = SignChatV3.parse_obj({
            "chat_id": request.chat_id,
            "name": request.name,
            "actions": request.actions,
            "action_interval": request.action_interval,
            "message_thread_id": request.message_thread_id,
            "delete_after": request.delete_after,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"动作配置解析失败: {e}")

    session_dir, session_string, use_in_memory, proxy_dict, api_id, api_hash = (
        _get_account_client_params(account_name)
    )
    if use_in_memory and not session_string:
        raise HTTPException(status_code=400, detail="账号 session 不存在或已失效")
    if not api_id or not api_hash:
        raise HTTPException(status_code=400, detail="未配置 Telegram API ID 或 API Hash")

    logs: list[str] = []
    tg_logger = logging.getLogger("tg-signer")
    log_handler = TaskLogHandler(logs)
    log_handler.setLevel(logging.INFO)
    log_handler.setFormatter(logging.Formatter("%(asctime)s - %(message)s"))
    tg_logger.addHandler(log_handler)

    try:
        from backend.core.config import get_settings as _get_settings
        _settings = _get_settings()

        signer = BackendUserSigner(
            task_name="__test__",
            session_dir=str(session_dir),
            account=account_name,
            workdir=str(_settings.resolve_workdir()),
            proxy=proxy_dict,
            session_string=session_string,
            in_memory=use_in_memory,
            api_id=api_id,
            api_hash=api_hash,
            no_updates=not chat.requires_updates,
        )

        if chat.requires_ai:
            signer.ensure_ai_cfg()

        lock = get_account_lock(account_name)
        async with lock:
            started_here = False
            if not getattr(signer.app, "is_connected", False):
                await signer.app.start()
                started_here = True

            message_handler_ref = None
            edited_handler_ref = None
            try:
                signer.context = signer.ensure_ctx()
                signer.context.sign_chats[chat.chat_id].append(chat)

                if chat.requires_updates:
                    message_handler_ref = signer.app.add_handler(
                        MessageHandler(
                            signer.on_message,
                            tg_filters.chat([chat.chat_id]),
                        )
                    )
                    edited_handler_ref = signer.app.add_handler(
                        EditedMessageHandler(
                            signer.on_edited_message,
                            tg_filters.chat([chat.chat_id]),
                        )
                    )

                async with get_global_semaphore():
                    await asyncio.wait_for(
                        signer.sign_a_chat(chat),
                        timeout=120.0,
                    )

            finally:
                for ref in (message_handler_ref, edited_handler_ref):
                    if ref:
                        try:
                            signer.app.remove_handler(*ref)
                        except Exception:
                            pass
                if started_here:
                    try:
                        await signer.app.stop()
                    except Exception:
                        pass

        return TestChatResponse(success=True, message="测试执行完成", logs=logs)
    except asyncio.TimeoutError:
        return TestChatResponse(success=False, message="执行超时", logs=logs)
    except Exception as e:
        return TestChatResponse(success=False, message=f"执行失败: {e}", logs=logs)
    finally:
        tg_logger.removeHandler(log_handler)


@router.patch("/{account_name}", response_model=AccountUpdateResponse)
def update_account(
    account_name: str,
    request: AccountUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    """
    更新账号备注/代理（不影响登录状态）
    """
    if not get_telegram_service().account_exists(account_name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"账号 {account_name} 不存在",
        )
    try:
        from backend.utils.tg_session import set_account_profile

        set_account_profile(
            account_name,
            remark=request.remark,
            proxy=request.proxy,
        )

        # 刷新缓存并返回更新后的账号信息
        service = get_telegram_service()
        updated = None
        try:
            accounts = service.list_accounts(force_refresh=True)
            updated = next(
                (acc for acc in accounts if acc.get("name") == account_name), None
            )
        except Exception:
            updated = None

        if not updated:
            raise ValueError("账号信息更新后未找到对应账号")

        return AccountUpdateResponse(
            success=True,
            message="账号信息已更新",
            account=AccountInfo(**updated),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新账号信息失败: {e!s}",
        )


class AccountLogItem(BaseModel):
    """账号日志项"""

    id: int
    account_name: str
    task_name: str
    message: str
    summary: str | None = None
    bot_message: str | None = None
    success: bool
    created_at: str


def _extract_last_bot_message(item: dict) -> str:
    flow_logs = item.get("flow_logs")
    if not isinstance(flow_logs, list):
        return ""

    lines: list[str] = []
    for raw in flow_logs:
        if raw is None:
            continue
        text = str(raw).strip()
        if not text:
            continue
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            line = re.sub(r"^\d{4}-\d{2}-\d{2}[^-]*-\s*", "", line)
            if line:
                lines.append(line)

    if not lines:
        return ""

    for line in reversed(lines):
        lower = line.lower()
        if "text:" in lower:
            idx = lower.find("text:")
            value = line[idx + 5 :].strip()
            if value:
                return value

    keywords = ("sign", "success", "failed", "reward", "points", "checkin")
    for line in reversed(lines):
        low = line.lower()
        if any(keyword in low for keyword in keywords):
            return line

    return ""


class ClearAccountLogsResponse(BaseModel):
    """清理账号日志响应"""

    success: bool
    cleared: int
    message: str
    code: str | None = None


@router.get("/{account_name}/logs", response_model=list[AccountLogItem])
def get_account_logs(
    account_name: str, limit: int = 100, current_user: User = Depends(get_current_user)
):
    """获取账号的任务执行历史日志"""
    from backend.services.sign_tasks import get_sign_task_service

    history = get_sign_task_service().get_account_history_logs(account_name)

    logs = []
    for i, item in enumerate(history[:limit]):
        logs.append(
            AccountLogItem(
                id=i + 1,
                account_name=account_name,
                task_name=item.get("task_name", "未知任务"),
                message=item.get("message")
                or ("执行成功" if item.get("success") else "执行失败"),
                success=item.get("success", False),
                created_at=item.get("time", ""),
            )
        )

    for idx, item in enumerate(history[:limit]):
        if idx >= len(logs):
            break
        task_name = logs[idx].task_name or "Unknown Task"
        success = bool(logs[idx].success)
        logs[idx].summary = f"Task: {task_name} {'success' if success else 'failed'}"
        logs[idx].bot_message = _extract_last_bot_message(item) or None

    return logs


@router.post("/{account_name}/logs/clear", response_model=ClearAccountLogsResponse)
def clear_account_logs(
    account_name: str, current_user: User = Depends(get_current_user)
):
    """清理账号的历史日志"""
    if not get_telegram_service().account_exists(account_name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ACCOUNT_NOT_FOUND",
        )
    try:
        from backend.services.sign_tasks import get_sign_task_service

        result = get_sign_task_service().clear_account_history_logs(account_name)
        return ClearAccountLogsResponse(
            success=True,
            cleared=result.get("removed_entries", 0),
            message="Logs cleared",
            code="LOGS_CLEARED",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CLEAR_LOGS_FAILED",
        )


@router.get("/{account_name}/logs/export")
def export_account_logs(
    account_name: str, current_user: User = Depends(get_current_user)
):
    """导出账号日志为 txt 文件"""
    from fastapi.responses import Response

    from backend.services.sign_tasks import get_sign_task_service

    history = get_sign_task_service().get_account_history_logs(account_name)

    content = f"Account Logs for: {account_name}\n"
    content += "=" * 40 + "\n\n"

    for item in history:
        time_str = item.get("time", "").replace("T", " ")[:19]
        status = "SUCCESS" if item.get("success") else "FAILED"
        content += f"[{time_str}] Task: {item.get('task_name')} | Status: {status}\n"
        if item.get("message"):
            content += f"Message: {item.get('message')}\n"
        content += "-" * 20 + "\n"

    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="account_logs.txt"'
        },
    )
