"""丢失验证器时离线清除面板用户的两步验证。

需要能进入服务器或容器才能执行，因此不暴露为 HTTP 接口。
在容器中以数据目录属主身份运行，避免数据库附属文件变成 root 所有：
    docker exec tg-signpulse sh -c \
      'gosu "$(stat -c %u:%g /data)" python -m backend.cli.reset_totp admin'
"""

from __future__ import annotations

import sys

from backend.core.database import get_session_local
from backend.models.user import User


def reset_totp(username: str) -> str:
    with get_session_local()() as db:
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            raise LookupError(f"用户不存在：{username}")
        if not user.totp_secret:
            return f"用户 {username} 未启用两步验证，无需重置"
        user.totp_secret = None
        db.commit()
    return f"已清除用户 {username} 的两步验证，现在可以只用密码登录"


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("用法：python -m backend.cli.reset_totp <用户名>", file=sys.stderr)
        return 2
    try:
        print(reset_totp(argv[0]))
    except LookupError as exc:
        print(exc, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
