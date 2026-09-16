from __future__ import annotations

import logging
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.core import auth as auth_core
from backend.core.auth import authenticate_user, create_access_token, verify_totp
from backend.core.database import get_db
from backend.models.user import User
from backend.schemas.auth import LoginRequest, TokenResponse, UserOut
from backend.services.users import is_default_password

router = APIRouter()
logger = logging.getLogger("backend.auth")


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    logger.info("Login attempt: user=%s", payload.username)
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        logger.warning("Authentication failed: user=%s", payload.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    logger.info("Authenticated: user=%s totp_enabled=%s", user.username, bool(user.totp_secret))
    if user.totp_secret and (not payload.totp_code or not verify_totp(
        user.totp_secret, payload.totp_code
    )):
        logger.warning("TOTP verification failed: user=%s", user.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="TOTP_REQUIRED_OR_INVALID",
        )
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(hours=12),
    )
    try:
        from backend.services.config import get_config_service
        from backend.services.push_notifications import send_login_notification

        forwarded_for = request.headers.get("x-forwarded-for", "")
        ip_address = (
            forwarded_for.split(",", 1)[0].strip()
            or request.headers.get("x-real-ip", "").strip()
            or (request.client.host if request.client else "")
        )
        settings = get_config_service().get_global_settings()
        background_tasks.add_task(
            send_login_notification,
            settings,
            username=user.username,
            ip_address=ip_address,
        )
    except Exception as exc:
        logger.warning("Failed to queue login notification: %s", exc)
    return TokenResponse(
        access_token=access_token,
        must_change_password=is_default_password(user),
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(auth_core.get_current_user)):
    return current_user
