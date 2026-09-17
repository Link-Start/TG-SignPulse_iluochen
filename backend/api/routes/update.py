"""检查更新与一键更新"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from backend.core.auth import get_current_user
from backend.models.user import User
from backend.services.self_update import (
    UpdateInProgress,
    UpdateUnavailable,
    get_self_update_service,
)

router = APIRouter()


@router.get("/status")
def update_status(
    refresh: bool = False, current_user: User = Depends(get_current_user)
):
    return get_self_update_service().status(refresh=refresh)


@router.post("/apply", status_code=status.HTTP_202_ACCEPTED)
def apply_update(current_user: User = Depends(get_current_user)):
    from backend.services.sign_tasks import get_sign_task_service

    if get_sign_task_service().has_running_tasks():
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "有任务正在运行，请稍后再更新", "code": "TASKS_RUNNING"},
        )
    try:
        return get_self_update_service().apply()
    except UpdateInProgress:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "更新已在进行中", "code": "UPDATE_IN_PROGRESS"},
        )
    except UpdateUnavailable as exc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "detail": "当前部署方式不支持一键更新",
                "code": f"UPDATE_{exc.reason.upper()}",
            },
        )
