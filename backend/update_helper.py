"""一键更新的助手：在一次性容器里运行，替面板完成「停旧容器 → 用新镜像重建 → 确认启动」。

面板不能在自己的容器里重建自己，所以由面板创建这个容器（镜像是刚拉下来的新镜像）：
    python -m backend.update_helper <面板容器 ID> <镜像>
这个调用约定要保持不变，旧版面板会按它来启动新镜像里的助手。
可选的环境变量 UPDATE_OLD_IMAGE_CONFIG 是面板在拉取前记下的旧镜像配置（JSON，
结构同 docker_api.image_defaults）。containerd 镜像存储里，标签指向新镜像后旧镜像就查不到了，
没有这份配置就分不清容器里哪些环境变量是从旧镜像继承来的。

新容器启动失败或健康检查不通过时，删掉新容器，把旧容器改回原名并重新启动。
退出码 0 表示更新成功或无需更新，面板下次启动后会读取本容器的日志和退出码。
"""

from __future__ import annotations

import json
import os
import sys
import time
from collections.abc import Callable

from backend.utils.docker_api import DockerClient, DockerError, build_recreate_spec

Log = Callable[[str], None]


def _log(message: str) -> None:
    print(message, flush=True)


def wait_until_ready(
    client: DockerClient,
    container_id: str,
    timeout: float = 180,
    settle: float = 10,
    poll: float = 2,
) -> None:
    """有健康检查就等到 healthy；没有就要求稳定运行 settle 秒"""
    deadline = time.monotonic() + timeout
    running_since: float | None = None
    while True:
        state = client.inspect_container(container_id).get("State") or {}
        if state.get("Restarting") or not state.get("Running"):
            raise RuntimeError(f"新容器已退出（退出码 {state.get('ExitCode')}）")
        health = (state.get("Health") or {}).get("Status")
        if health == "healthy":
            return
        if health == "unhealthy":
            raise RuntimeError("新容器健康检查未通过")
        if health is None:
            running_since = running_since or time.monotonic()
            if time.monotonic() - running_since >= settle:
                return
        if time.monotonic() > deadline:
            raise RuntimeError("等待新容器就绪超时")
        time.sleep(poll)


def recreate(
    client: DockerClient,
    target: str,
    image_ref: str,
    log: Log = _log,
    cleanup: bool = True,
    ready: Callable[[DockerClient, str], None] = wait_until_ready,
    old_image: dict | None = None,
) -> bool:
    """用 image_ref 重建 target；返回是否真的换了镜像"""
    old = client.inspect_container(target)
    old_id = old["Id"]
    name = old["Name"].lstrip("/")
    new_image = client.inspect_image(image_ref)
    if new_image["Id"] == old["Image"]:
        log("镜像没有变化，无需重建")
        return False
    if old_image is None:
        try:
            old_image = client.inspect_image(old["Image"])
        except DockerError:
            # 旧镜像已经查不到：退而用新镜像的配置，至少与新镜像相同的值会交给镜像决定
            log("找不到旧镜像的配置，按新镜像处理")
            old_image = new_image

    body, extra_networks = build_recreate_spec(old, old_image, image_ref)
    stop_timeout = int((old.get("Config") or {}).get("StopTimeout") or 30)

    log(f"停止旧容器 {name}")
    client.stop(old_id, stop_timeout)
    backup_name = f"{name}-old-{int(time.time())}"
    client.rename(old_id, backup_name)

    new_id = None
    try:
        log(f"用 {image_ref} 创建新容器")
        new_id = client.create_container(body, name)
        for network, endpoint in extra_networks.items():
            client.connect_network(network, new_id, endpoint)
        client.start(new_id)
        log("等待新容器就绪")
        ready(client, new_id)
    except Exception as exc:
        log(f"新容器没有正常启动：{exc}")
        log("正在恢复旧容器")
        if new_id:
            try:
                client.remove_container(new_id, force=True)
            except DockerError as cleanup_exc:
                log(f"删除新容器失败：{cleanup_exc}")
        client.rename(old_id, name)
        client.start(old_id)
        log("已恢复旧容器")
        raise

    client.remove_container(old_id)
    if cleanup:
        try:
            client.remove_image(old["Image"])
        except DockerError:
            # 旧镜像还有其它标签或仍被使用时保留
            pass
    log("更新完成")
    return True


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 2:
        _log("用法：python -m backend.update_helper <容器> <镜像>")
        return 2
    target, image_ref = args
    # 给面板留出返回响应的时间
    time.sleep(float(os.getenv("UPDATE_HELPER_DELAY", "3")))
    cleanup = os.getenv("APP_UPDATE_CLEANUP", "1") != "0"
    old_image = None
    try:
        old_image = json.loads(os.getenv("UPDATE_OLD_IMAGE_CONFIG") or "null")
    except ValueError:
        pass
    client = DockerClient(timeout=60)
    try:
        recreate(
            client,
            target,
            image_ref,
            cleanup=cleanup,
            old_image=old_image if isinstance(old_image, dict) else None,
        )
    except Exception as exc:
        _log(f"更新失败：{exc}")
        return 1
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
