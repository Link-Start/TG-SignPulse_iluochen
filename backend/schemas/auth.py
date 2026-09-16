from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str
    totp_code: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime

    class Config:
        orm_mode = True
