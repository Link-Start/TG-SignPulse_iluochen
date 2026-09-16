from __future__ import annotations

import asyncio
import copy
import json
import os
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

from backend.core.config import get_settings

_SESSION_MODE_ENV = "TG_SESSION_MODE"
_SESSION_MODE_FILE = "file"
_SESSION_MODE_STRING = "string"

_GLOBAL_SEMAPHORE: asyncio.Semaphore | None = None

# accounts.json 会被事件循环（任务、登录）和线程池中的同步路由同时读写：
# 写操作「读-改-写」整体加锁，避免互相覆盖；读操作按文件 mtime/size 复用解析结果，
# 列表页每个账号都要读 profile/status，缓存后不必每次重新解析整个文件
_ACCOUNT_STORE_LOCK = threading.RLock()
_ACCOUNT_STORE_CACHE: tuple[str, int, int, dict] | None = (
    None  # (path, mtime_ns, size, data)
)


def get_session_mode() -> str:
    mode = os.getenv(_SESSION_MODE_ENV, _SESSION_MODE_FILE).strip().lower()
    return _SESSION_MODE_STRING if mode == _SESSION_MODE_STRING else _SESSION_MODE_FILE


def is_string_session_mode() -> bool:
    return get_session_mode() == _SESSION_MODE_STRING


def get_no_updates_flag() -> bool:
    raw = os.getenv("TG_SESSION_NO_UPDATES") or os.getenv("TG_NO_UPDATES") or ""
    raw = raw.strip().lower()
    return raw in {"1", "true", "yes", "on"}


def get_global_semaphore() -> asyncio.Semaphore:
    global _GLOBAL_SEMAPHORE
    if _GLOBAL_SEMAPHORE is None:
        raw = (os.getenv("TG_GLOBAL_CONCURRENCY") or "1").strip()
        try:
            limit = int(raw)
        except ValueError:
            limit = 1
        limit = max(limit, 1)
        _GLOBAL_SEMAPHORE = asyncio.Semaphore(limit)
    return _GLOBAL_SEMAPHORE


def _account_store_path() -> Path:
    settings = get_settings()
    session_dir = settings.resolve_session_dir()
    session_dir.mkdir(parents=True, exist_ok=True)
    return session_dir / "accounts.json"


def _read_account_store_cached() -> dict:
    """只读访问：返回共享的解析结果，调用方不得修改"""
    global _ACCOUNT_STORE_CACHE
    path = _account_store_path()
    with _ACCOUNT_STORE_LOCK:
        try:
            stat = path.stat()
        except OSError:
            return {"accounts": {}}
        cache = _ACCOUNT_STORE_CACHE
        if (
            cache is not None
            and cache[0] == str(path)
            and cache[1] == stat.st_mtime_ns
            and cache[2] == stat.st_size
        ):
            return cache[3]
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {"accounts": {}}
        if not isinstance(data, dict):
            return {"accounts": {}}
        if not isinstance(data.get("accounts"), dict):
            data["accounts"] = {}
        _ACCOUNT_STORE_CACHE = (str(path), stat.st_mtime_ns, stat.st_size, data)
        return data


def _load_account_store() -> dict:
    """可修改的副本，供写操作使用（调用方需持有 _ACCOUNT_STORE_LOCK）"""
    return copy.deepcopy(_read_account_store_cached())


def _save_account_store(data: dict) -> None:
    global _ACCOUNT_STORE_CACHE
    path = _account_store_path()
    with _ACCOUNT_STORE_LOCK:
        # 临时文件名唯一，并发写不会互相踩到同一个 .tmp
        fd, tmp_name = tempfile.mkstemp(
            dir=path.parent, prefix=".accounts.", suffix=".tmp"
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp_name, path)
        except Exception:
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
            raise
        _ACCOUNT_STORE_CACHE = None


def list_account_names() -> list[str]:
    data = _read_account_store_cached()
    accounts = data.get("accounts", {})
    if not isinstance(accounts, dict):
        return []
    return sorted(accounts.keys())


def get_account_session_string(account_name: str) -> str | None:
    data = _read_account_store_cached()
    entry = data.get("accounts", {}).get(account_name)
    if not isinstance(entry, dict):
        return None
    session_string = entry.get("session_string")
    if isinstance(session_string, str) and session_string.strip():
        return session_string.strip()
    return None


def set_account_session_string(account_name: str, session_string: str) -> None:
    with _ACCOUNT_STORE_LOCK:
        data = _load_account_store()
        accounts = data.get("accounts")
        if not isinstance(accounts, dict):
            accounts = {}
            data["accounts"] = accounts
        entry = accounts.get(account_name)
        if not isinstance(entry, dict):
            entry = {}
        entry["session_string"] = session_string.strip()
        entry["updated_at"] = datetime.utcnow().isoformat()
        accounts[account_name] = entry
        _save_account_store(data)


def delete_account_session_string(account_name: str) -> None:
    with _ACCOUNT_STORE_LOCK:
        data = _load_account_store()
        accounts = data.get("accounts")
        if isinstance(accounts, dict) and account_name in accounts:
            accounts.pop(account_name, None)
            _save_account_store(data)


def get_account_profile(account_name: str) -> dict[str, Any]:
    data = _read_account_store_cached()
    entry = data.get("accounts", {}).get(account_name)
    if not isinstance(entry, dict):
        return {}
    return {
        "remark": entry.get("remark"),
        "proxy": entry.get("proxy"),
        "status": entry.get("status"),
        "status_message": entry.get("status_message"),
        "status_code": entry.get("status_code"),
        "status_checked_at": entry.get("status_checked_at"),
        "needs_relogin": bool(entry.get("needs_relogin", False)),
        "invalid_notified_at": entry.get("invalid_notified_at"),
    }


def get_account_proxy(account_name: str) -> str | None:
    profile = get_account_profile(account_name)
    proxy = profile.get("proxy")
    if isinstance(proxy, str) and proxy.strip():
        return proxy.strip()
    return None


def get_account_remark(account_name: str) -> str | None:
    profile = get_account_profile(account_name)
    remark = profile.get("remark")
    if isinstance(remark, str) and remark.strip():
        return remark.strip()
    return None


def set_account_profile(
    account_name: str, *, remark: str | None = None, proxy: str | None = None
) -> None:
    with _ACCOUNT_STORE_LOCK:
        data = _load_account_store()
        accounts = data.get("accounts")
        if not isinstance(accounts, dict):
            accounts = {}
            data["accounts"] = accounts
        entry = accounts.get(account_name)
        if not isinstance(entry, dict):
            entry = {}
        if remark is not None:
            entry["remark"] = remark.strip() if isinstance(remark, str) else remark
        if proxy is not None:
            entry["proxy"] = proxy.strip() if isinstance(proxy, str) else proxy
        entry["updated_at"] = datetime.utcnow().isoformat()
        accounts[account_name] = entry
        _save_account_store(data)


def get_account_status(account_name: str) -> dict[str, Any]:
    profile = get_account_profile(account_name)
    status = profile.get("status")
    return {
        "status": status if isinstance(status, str) and status else "connected",
        "message": profile.get("status_message") or "",
        "code": profile.get("status_code"),
        "checked_at": profile.get("status_checked_at"),
        "needs_relogin": bool(profile.get("needs_relogin", False)),
        "invalid_notified_at": profile.get("invalid_notified_at"),
    }


def set_account_status(
    account_name: str,
    *,
    status: str,
    message: str = "",
    code: str | None = None,
    needs_relogin: bool = False,
    invalid_notified_at: str | None = None,
) -> None:
    with _ACCOUNT_STORE_LOCK:
        data = _load_account_store()
        accounts = data.get("accounts")
        if not isinstance(accounts, dict):
            accounts = {}
            data["accounts"] = accounts
        entry = accounts.get(account_name)
        if not isinstance(entry, dict):
            entry = {}
        entry["status"] = status
        entry["status_message"] = message or ""
        entry["status_code"] = code
        entry["status_checked_at"] = datetime.utcnow().isoformat()
        entry["needs_relogin"] = bool(needs_relogin)
        if invalid_notified_at is not None:
            entry["invalid_notified_at"] = invalid_notified_at
        if status != "invalid":
            entry.pop("invalid_notified_at", None)
        entry["updated_at"] = datetime.utcnow().isoformat()
        accounts[account_name] = entry
        _save_account_store(data)


def session_string_file_path(session_dir: Path, account_name: str) -> Path:
    return session_dir / f"{account_name}.session_string"


def load_session_string_file(session_dir: Path, account_name: str) -> str | None:
    path = session_string_file_path(session_dir, account_name)
    if not path.exists():
        return None
    try:
        content = path.read_text(encoding="utf-8").strip()
    except Exception:
        return None
    return content or None


def save_session_string_file(
    session_dir: Path, account_name: str, session_string: str
) -> None:
    path = session_string_file_path(session_dir, account_name)
    path.write_text(session_string.strip(), encoding="utf-8")


def delete_session_string_file(session_dir: Path, account_name: str) -> None:
    path = session_string_file_path(session_dir, account_name)
    if path.exists():
        try:
            path.unlink()
        except Exception:
            pass
