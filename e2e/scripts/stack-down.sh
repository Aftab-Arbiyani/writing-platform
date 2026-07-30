#!/usr/bin/env bash
# Tear down the local E2E stack: stop the host backend (if we started it) and
# stop the infra containers. Pass --volumes to also drop data volumes.
#
#   pnpm e2e:down              # stop backend + containers (keep volumes)
#   pnpm e2e:down --volumes    # also remove data volumes
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="${ROOT}/e2e/.stack"
BACKEND_PID_FILE="${STATE_DIR}/backend.pid"
DROP_VOLUMES=0

for arg in "$@"; do
  [ "${arg}" = "--volumes" ] && DROP_VOLUMES=1
done

cd "${ROOT}"

if [ -f "${BACKEND_PID_FILE}" ]; then
  pid="$(cat "${BACKEND_PID_FILE}")"
  if kill -0 "${pid}" 2>/dev/null; then
    echo "→ Stopping backend (pid ${pid})…"
    # Kill the process group so the nest child dies too.
    kill -- "-${pid}" 2>/dev/null || kill "${pid}" 2>/dev/null || true
  fi
  rm -f "${BACKEND_PID_FILE}"
fi

if [ "${DROP_VOLUMES}" -eq 1 ]; then
  echo "→ Stopping infra + removing volumes…"
  docker compose down -v
else
  echo "→ Stopping infra…"
  docker compose down
fi

echo "✓ Stack is down."
