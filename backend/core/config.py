from __future__ import annotations

import logging
import os
import secrets
import tempfile
from functools import lru_cache
from pathlib import Path

from backend.utils.storage import get_initial_data_dir, get_writable_base_dir

try:
    from pydantic.v1 import BaseSettings
except ImportError:
    from pydantic import BaseSettings


SECRET_KEY_FILENAME = ".secret_key"

logger = logging.getLogger("backend.config")


def load_or_create_secret_key(base_dir: Path) -> str:
    """未设置 APP_SECRET_KEY 时，在数据目录生成随机密钥并持久化（权限 0600）"""
    path = base_dir / SECRET_KEY_FILENAME
    try:
        existing = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        existing = ""
    if existing:
        return existing

    key = secrets.token_urlsafe(48)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".secret_key.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fp:
            fp.write(key)
        # link 不覆盖已有文件：多个进程同时启动时只有一个写入成功，其余读取它的值
        os.link(tmp, path)
    except FileExistsError:
        return path.read_text(encoding="utf-8").strip()
    finally:
        os.unlink(tmp)
    logger.warning(
        "APP_SECRET_KEY 未设置，已生成随机密钥并保存到 %s；删除该文件会使所有登录失效",
        path,
    )
    return key


class Settings(BaseSettings):
    app_name: str = "tg-signer-panel"
    host: str = os.getenv("APP_HOST", "127.0.0.1")
    port: int = 3000

    # 留空时由 get_settings() 从数据目录读取或生成
    secret_key: str = ""
    access_token_expire_hours: int = 12

    timezone: str = os.getenv("TZ", "Asia/Hong_Kong")
    data_dir: Path = get_initial_data_dir()
    db_path: Path | None = None
    signer_workdir: Path | None = None
    session_dir: Path | None = None
    logs_dir: Path | None = None

    class Config:
        env_file = ".env"
        env_prefix = "APP_"
        case_sensitive = False

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.resolve_db_path()}?check_same_thread=False"

    def resolve_db_path(self) -> Path:
        return self.db_path or self.resolve_base_dir() / "db.sqlite"

    def resolve_workdir(self) -> Path:
        return self.signer_workdir or self.resolve_base_dir() / ".signer"

    def resolve_session_dir(self) -> Path:
        return self.session_dir or self.resolve_base_dir() / "sessions"

    def resolve_logs_dir(self) -> Path:
        return self.logs_dir or self.resolve_base_dir() / "logs"

    def resolve_base_dir(self) -> Path:
        if self.data_dir and str(self.data_dir) != "/data":
            return self.data_dir
        return get_writable_base_dir()


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.secret_key = settings.secret_key.strip()
    if not settings.secret_key:
        settings.secret_key = load_or_create_secret_key(settings.resolve_base_dir())
    elif len(settings.secret_key) < 16:
        logger.warning("APP_SECRET_KEY 过短（少于 16 个字符），建议换成随机长字符串")
    return settings
