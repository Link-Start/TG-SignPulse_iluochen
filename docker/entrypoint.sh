#!/bin/sh
set -eu

PORT_VALUE="${PORT:-8080}"
AUTO_FIX_PERMS="${APP_AUTO_FIX_DATA_PERMS:-1}"

# Default runtime identity (kept for compatibility with existing images).
DEFAULT_UID="${APP_UID:-10001}"
DEFAULT_GID="${APP_GID:-10001}"
TARGET_UID="$DEFAULT_UID"
TARGET_GID="$DEFAULT_GID"

# If /data is mounted, prefer running as its owner/group to avoid chmod 777.
if [ -d /data ]; then
  DATA_UID="$(stat -c '%u' /data 2>/dev/null || true)"
  DATA_GID="$(stat -c '%g' /data 2>/dev/null || true)"
  if [ -n "${DATA_UID}" ] && [ -n "${DATA_GID}" ]; then
    TARGET_UID="${DATA_UID}"
    TARGET_GID="${DATA_GID}"
  fi
fi

if [ "$(id -u)" -eq 0 ]; then
  if [ "${AUTO_FIX_PERMS}" != "0" ] && [ -d /data ]; then
    echo "INFO: fixing /data permissions for ${TARGET_UID}:${TARGET_GID} ..."
    # Ensure core paths exist first.
    mkdir -p /data/.signer /data/sessions /data/logs || true

    # Repair ownership and write bits for existing historical files.
    # This avoids readonly sqlite and permission denied after image upgrades.
    for p in /data /data/.signer /data/sessions /data/logs /data/db.sqlite /data/.tg_signpulse_data_dir; do
      if [ -e "${p}" ]; then
        chown -R "${TARGET_UID}:${TARGET_GID}" "${p}" 2>/dev/null || true
        chmod -R u+rwX "${p}" 2>/dev/null || true
        chmod -R g+rwX "${p}" 2>/dev/null || true
      fi
    done
  fi

  # If mounted volume is root-owned, keep root to preserve writability.
  if [ "${TARGET_UID}" = "0" ] || [ "${TARGET_GID}" = "0" ]; then
    exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT_VALUE}"
  fi

  # One-click update: gosu drops supplementary groups, so when a Docker socket
  # is mounted keep its group via setpriv (the socket is usually root:docker 660).
  case "${DOCKER_HOST:-}" in
    unix://*) DOCKER_SOCK="${DOCKER_HOST#unix://}" ;;
    "") DOCKER_SOCK="/var/run/docker.sock" ;;
    *) DOCKER_SOCK="" ;;
  esac
  if [ -n "${DOCKER_SOCK}" ] && [ -S "${DOCKER_SOCK}" ] && command -v setpriv >/dev/null 2>&1; then
    SOCK_GID="$(stat -c '%g' "${DOCKER_SOCK}" 2>/dev/null || true)"
    if [ -n "${SOCK_GID}" ] && [ "${SOCK_GID}" != "${TARGET_GID}" ]; then
      HOME="$(getent passwd "${TARGET_UID}" | cut -d: -f6)"
      export HOME="${HOME:-/}"
      exec setpriv --reuid="${TARGET_UID}" --regid="${TARGET_GID}" --groups="${TARGET_GID},${SOCK_GID}" \
        uvicorn backend.main:app --host 0.0.0.0 --port "${PORT_VALUE}"
    fi
  fi
  exec gosu "${TARGET_UID}:${TARGET_GID}" uvicorn backend.main:app --host 0.0.0.0 --port "${PORT_VALUE}"
fi

exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT_VALUE}"
