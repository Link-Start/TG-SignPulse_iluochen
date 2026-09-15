"""
签到任务 API 路由
提供签到任务的 REST API
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

from backend.core.auth import get_current_user, verify_token
from backend.core.database import get_session_local
from backend.services.sign_tasks import get_sign_task_service

router = APIRouter()
logger = logging.getLogger("backend.api.sign_tasks")

# 持有后台运行任务的强引用，防止被 GC 提前回收
_background_runs: set[asyncio.Task] = set()
_WS_WAIT_START_SECONDS = 5.0
_WS_POLL_INTERVAL = 0.5
_WS_PING_INTERVAL = 10.0


def _on_background_run_done(task: asyncio.Task) -> None:
    _background_runs.discard(task)
    if not task.cancelled() and task.exception() is not None:
        logger.error("后台运行签到任务异常", exc_info=task.exception())


async def _restart_keyword_monitors() -> None:
    try:
        from backend.services.keyword_monitor import get_keyword_monitor_service

        await get_keyword_monitor_service().restart_from_tasks()
    except Exception:
        pass


# Pydantic 模型定义


class ActionBase(BaseModel):
    """动作基类"""

    action: int = Field(..., description="动作类型")


class SendTextAction(ActionBase):
    """发送文本动作"""

    action: int = Field(1, description="动作类型：1=发送文本")
    text: str = Field(..., description="要发送的文本")


class SendDiceAction(ActionBase):
    """发送骰子动作"""

    action: int = Field(2, description="动作类型：2=发送骰子")
    dice: str = Field(..., description="骰子表情")


class ClickKeyboardAction(ActionBase):
    """点击键盘按钮动作"""

    action: int = Field(3, description="动作类型：3=点击按钮")
    text: str = Field(..., description="按钮文本")


class ChooseOptionByImageAction(ActionBase):
    """AI 图片识别动作"""

    action: int = Field(4, description="动作类型：4=AI 图片识别")


class ReplyByCalculationAction(ActionBase):
    """AI 计算题动作"""

    action: int = Field(5, description="动作类型：5=AI 计算题")


class ChatConfig(BaseModel):
    """Chat 配置"""

    chat_id: int = Field(..., description="Chat ID")
    name: str = Field("", description="Chat 名称")
    actions: list[dict[str, Any]] = Field(..., description="动作列表")
    delete_after: int | None = Field(None, description="删除延迟（秒）")
    action_interval: int = Field(1, description="动作间隔（秒）")
    message_thread_id: int | None = Field(None, description="群组话题 Thread ID")


class SignTaskCreate(BaseModel):
    """创建签到任务请求"""

    name: str = Field(..., description="任务名称")
    account_name: str = Field(..., description="关联的账号名称")
    sign_at: str = Field(..., description="签到时间（CRON 表达式）")
    chats: list[ChatConfig] = Field(..., description="Chat 配置列表")
    random_seconds: int = Field(0, description="随机延迟秒数")
    sign_interval: int | None = Field(
        None, description="签到间隔秒数，留空使用全局配置或随机 1-120 秒"
    )
    execution_mode: str | None = Field("fixed", description="执行模式: fixed/range")
    range_start: str | None = Field(None, description="随机范围开始时间")
    range_end: str | None = Field(None, description="随机范围结束时间")

    @validator("name")
    def name_must_be_valid_filename(cls, v):
        import re

        if not v or not v.strip():
            raise ValueError("任务名称不能为空")
        # Windows 文件名非法字符检查
        invalid_chars = r'[<>:"/\\|?*]'
        if re.search(invalid_chars, v):
            raise ValueError('任务名称不能包含特殊字符: < > : " / \\ | ? *')
        return v


class SignTaskUpdate(BaseModel):
    """更新签到任务请求"""

    sign_at: str | None = Field(None, description="签到时间（CRON 表达式）")
    chats: list[ChatConfig] | None = Field(None, description="Chat 配置列表")
    random_seconds: int | None = Field(None, description="随机延迟秒数")
    sign_interval: int | None = Field(None, description="签到间隔秒数")
    execution_mode: str | None = Field(None, description="执行模式: fixed/range")
    range_start: str | None = Field(None, description="随机范围开始时间")
    range_end: str | None = Field(None, description="随机范围结束时间")


class LastRunInfo(BaseModel):
    """最后执行信息"""

    time: str
    success: bool
    message: str = ""


class SignTaskOut(BaseModel):
    """签到任务输出"""

    name: str
    account_name: str = ""
    sign_at: str
    chats: list[dict[str, Any]]
    random_seconds: int
    sign_interval: int
    enabled: bool
    last_run: LastRunInfo | None = None
    execution_mode: str | None = "fixed"
    range_start: str | None = None
    range_end: str | None = None
    next_run_time: str | None = None  # APScheduler 下次触发时间（ISO 8601）


class ChatOut(BaseModel):
    """Chat 输出"""

    id: int
    title: str | None = None
    username: str | None = None
    type: str
    first_name: str | None = None


class ChatSearchResponse(BaseModel):
    """Chat 搜索结果"""

    items: list[ChatOut]
    total: int
    limit: int
    offset: int


class RunTaskResult(BaseModel):
    """运行任务结果"""

    success: bool
    output: str
    error: str


class TaskHistoryItem(BaseModel):
    time: str
    success: bool
    message: str = ""
    flow_logs: list[str] = Field(default_factory=list)
    flow_truncated: bool = False
    flow_line_count: int = 0


# API 路由


def _inject_next_run_times(tasks: list[dict]) -> list[dict]:
    """向任务列表注入 APScheduler 的下次触发时间"""
    try:
        from backend.scheduler import scheduler as _scheduler
        if not _scheduler:
            return tasks
        for task in tasks:
            account = task.get("account_name", "")
            name = task.get("name", "")
            job_id = f"sign-{account}-{name}"
            job = _scheduler.get_job(job_id)
            if job and job.next_run_time:
                task["next_run_time"] = job.next_run_time.isoformat()
    except Exception:
        pass
    return tasks


@router.get("", response_model=list[SignTaskOut])
def list_sign_tasks(
    account_name: str | None = None, current_user=Depends(get_current_user)
):
    """获取所有签到任务列表"""
    tasks = get_sign_task_service().list_tasks(account_name=account_name)
    _inject_next_run_times(tasks)
    return tasks


@router.post("", response_model=SignTaskOut, status_code=status.HTTP_201_CREATED)
async def create_sign_task(
    payload: SignTaskCreate,
    current_user=Depends(get_current_user),
):
    """创建新的签到任务"""
    try:
        # 转换 chats 为字典列表
        chats_dict = [chat.dict() for chat in payload.chats]

        task = get_sign_task_service().create_task(
            task_name=payload.name,
            account_name=payload.account_name,
            sign_at=payload.sign_at,
            chats=chats_dict,
            random_seconds=payload.random_seconds,
            sign_interval=payload.sign_interval,
            execution_mode=payload.execution_mode,
            range_start=payload.range_start,
            range_end=payload.range_end,
        )

        # 同步调度器
        from backend.scheduler import sync_jobs

        await sync_jobs()
        await _restart_keyword_monitors()

        return task
    except Exception as e:
        logger.exception("创建任务失败")
        raise HTTPException(status_code=500, detail=f"创建任务失败: {e!s}")


@router.get("/{task_name}", response_model=SignTaskOut)
def get_sign_task(
    task_name: str,
    account_name: str | None = None,
    current_user=Depends(get_current_user),
):
    """获取单个签到任务的详细信息"""
    task = get_sign_task_service().get_task(task_name, account_name=account_name)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_name} 不存在")
    return task


@router.put("/{task_name}", response_model=SignTaskOut)
async def update_sign_task(
    task_name: str,
    payload: SignTaskUpdate,
    account_name: str | None = None,
    current_user=Depends(get_current_user),
):
    """更新签到任务"""
    try:
        # 检查任务是否存在
        existing = get_sign_task_service().get_task(task_name, account_name=account_name)
        if not existing:
            raise HTTPException(status_code=404, detail=f"任务 {task_name} 不存在")

        # 转换 chats 为字典列表
        chats_dict = None
        if payload.chats is not None:
            chats_dict = [chat.dict() for chat in payload.chats]

        task = get_sign_task_service().update_task(
            task_name=task_name,
            sign_at=payload.sign_at,
            chats=chats_dict,
            random_seconds=payload.random_seconds,
            sign_interval=payload.sign_interval,
            account_name=account_name or existing.get("account_name"),
            execution_mode=payload.execution_mode,
            range_start=payload.range_start,
            range_end=payload.range_end,
        )

        # 同步调度器
        from backend.scheduler import sync_jobs

        await sync_jobs()
        await _restart_keyword_monitors()

        return task
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("更新任务失败")
        raise HTTPException(status_code=500, detail=f"更新任务失败: {e!s}")


@router.delete("/{task_name}", status_code=status.HTTP_200_OK)
async def delete_sign_task(
    task_name: str,
    account_name: str | None = None,
    current_user=Depends(get_current_user),
):
    """删除签到任务"""
    success = get_sign_task_service().delete_task(task_name, account_name=account_name)
    if not success:
        raise HTTPException(status_code=404, detail=f"任务 {task_name} 不存在")

    # 同步调度器
    from backend.scheduler import sync_jobs

    await sync_jobs()
    await _restart_keyword_monitors()

    return {"ok": True}


class SetEnabledRequest(BaseModel):
    enabled: bool


@router.patch("/{task_name}/enabled", response_model=SignTaskOut)
async def set_sign_task_enabled(
    task_name: str,
    payload: SetEnabledRequest,
    account_name: str | None = None,
    current_user=Depends(get_current_user),
):
    """启用 / 停用定时签到任务（不立即执行）"""
    try:
        task = get_sign_task_service().set_task_enabled(
            task_name, account_name, payload.enabled
        )
        # 同步调度器（双保险）
        from backend.scheduler import sync_jobs

        await sync_jobs()
        return task
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"切换任务状态失败: {e}")


@router.post("/{task_name}/run", response_model=RunTaskResult)
async def run_sign_task(
    task_name: str,
    account_name: str,
    current_user=Depends(get_current_user),
):
    """手动运行签到任务：后台启动后立即返回，执行过程与结果通过 WebSocket 获取"""
    service = get_sign_task_service()
    task = service.get_task(task_name, account_name=account_name)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_name} 不存在")

    if service.is_task_running(task_name, account_name=account_name):
        return {"success": False, "output": "", "error": "任务已经在运行中"}

    bg = asyncio.create_task(service.run_task_with_logs(account_name, task_name))
    _background_runs.add(bg)
    bg.add_done_callback(_on_background_run_done)

    # 让出事件循环直到任务完成"运行中"占位，保证前端随后建立的 WebSocket 能看到任务
    for _ in range(20):
        if bg.done() or service.is_task_running(task_name, account_name=account_name):
            break
        await asyncio.sleep(0)

    return {"success": True, "output": "", "error": ""}


@router.get("/{task_name}/logs", response_model=list[str])
def get_sign_task_logs(
    task_name: str,
    account_name: str | None = None,
    current_user=Depends(get_current_user),
):
    """获取正在运行任务的实时日志"""
    logs = get_sign_task_service().get_active_logs(task_name, account_name=account_name)
    return logs


@router.get("/{task_name}/history", response_model=list[TaskHistoryItem])
def get_sign_task_history(
    task_name: str,
    account_name: str,
    limit: int = Query(20, ge=1, le=200),
    current_user=Depends(get_current_user),
):
    task = get_sign_task_service().get_task(task_name, account_name=account_name)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_name} 不存在")

    return get_sign_task_service().get_task_history_logs(
        task_name=task_name,
        account_name=account_name,
        limit=limit,
    )


@router.get("/chats/{account_name}", response_model=list[ChatOut])
async def get_account_chats(
    account_name: str,
    force_refresh: bool = False,
    current_user=Depends(get_current_user),
):
    """获取账号的 Chat 列表"""
    try:
        return await get_sign_task_service().get_account_chats(
            account_name, force_refresh=force_refresh
        )
    except ValueError as e:
        detail = str(e)
        if (
            "登录已失效" in detail
            or "session_string" in detail
            or "Session 文件不存在" in detail
        ):
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={"detail": detail, "code": "ACCOUNT_SESSION_INVALID"},
            )
        raise HTTPException(status_code=404, detail=detail)
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"获取对话列表失败: {e!s}")


@router.get("/chats/{account_name}/search", response_model=ChatSearchResponse)
def search_account_chats(
    account_name: str,
    q: str = "",
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(get_current_user),
):
    """搜索账号的 Chat 列表（使用缓存）"""
    try:
        return get_sign_task_service().search_account_chats(
            account_name, q, limit=limit, offset=offset
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索对话列表失败: {e!s}")


@router.websocket("/ws/{task_name}")
async def sign_task_logs_ws(
    websocket: WebSocket,
    task_name: str,
    account_name: str = Query(...),
    token: str = Query(...),
):
    """WebSocket 实时推送签到任务日志（按累计序号增量推送，不受缓冲滚动影响）"""
    # 鉴权用短生命周期会话，避免长连接期间一直占用数据库连接
    try:
        with get_session_local()() as db:
            user = verify_token(token, db)
    except Exception:
        user = None
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()

    service = get_sign_task_service()
    try:
        from backend.services.keyword_monitor import get_keyword_monitor_service

        monitor_service = get_keyword_monitor_service()
    except Exception:
        monitor_service = None

    loop = asyncio.get_running_loop()
    started_at = loop.time()
    last_send = started_at
    run_id: int | None = None
    cursor = 0
    monitor_cursor = 0
    monitor_header_sent = False

    try:
        while True:
            snapshot = service.get_run_logs_since(task_name, account_name, run_id, cursor)
            run_id, cursor = snapshot["run_id"], snapshot["cursor"]
            lines: list[str] = list(snapshot["lines"])

            if monitor_service is not None:
                try:
                    monitor_lines, monitor_cursor = monitor_service.get_task_logs_since(
                        task_name, account_name, monitor_cursor
                    )
                except Exception:
                    monitor_lines = []
                if monitor_lines:
                    if not monitor_header_sent and (cursor > 0 or lines):
                        lines.append("---- 关键词后台监听日志 ----")
                        monitor_header_sent = True
                    lines.extend(monitor_lines)

            running = service.is_task_running(task_name, account_name=account_name)
            now = loop.time()

            if lines:
                await websocket.send_json(
                    {"type": "logs", "data": lines, "is_running": running}
                )
                last_send = now

            # 任务结束且日志已推完；尚无运行记录时给任务留出启动时间
            waiting_start = not snapshot["exists"] and now - started_at < _WS_WAIT_START_SECONDS
            if not running and not waiting_start:
                result = service.get_last_run_result(task_name, account_name) or {}
                await websocket.send_json(
                    {
                        "type": "done",
                        "is_running": False,
                        "success": result.get("success"),
                        "error": result.get("error", ""),
                    }
                )
                break

            if now - last_send >= _WS_PING_INTERVAL:
                await websocket.send_json({"type": "ping"})
                last_send = now

            await asyncio.sleep(_WS_POLL_INTERVAL)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WebSocket 日志推送异常: %s", e)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
