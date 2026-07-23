#!/usr/bin/env bash
# Bring up the E2E backing stack for local runs (docs/e2e/01 §3, 08 §8):
#   infra (Postgres/Redis/MinIO/Mailpit) → migrate → seed → seed:e2e → backend.
# The two Vite apps are started separately by Playwright's webServer block.
#
#   pnpm e2e:up            # start / ensure the stack
#   pnpm e2e:up --reset    # drop volumes first (fresh DB — infra provisioning,
#                          # NOT a data delete; see docs/e2e/09 §4)
#
# GUARD RAIL: never point this at a shared/staging/prod DB (docs/e2e/04 §7).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="${ROOT}/e2e/.stack"
BACKEND_PID_FILE="${STATE_DIR}/backend.pid"
BACKEND_LOG="${STATE_DIR}/backend.log"
HEALTH_URL="${E2E_HEALTH_URL:-http://localhost:4000/health}"
RESET=0

for arg in "$@"; do
  [ "${arg}" = "--reset" ] && RESET=1
done

cd "${ROOT}"
mkdir -p "${STATE_DIR}"

if [ "${RESET}" -eq 1 ]; then
  echo "→ Resetting infra (docker compose down -v)…"
  docker compose down -v
fi

echo "→ Starting infra (postgres, redis, minio, minio-init, mailpit)…"
docker compose up -d --wait postgres redis minio minio-init mailpit

echo "→ Running migrations…"
pnpm --filter backend migration:run

echo "→ Seeding baseline (roles/permissions/taxonomy/super-admin)…"
pnpm --filter backend seed

echo "→ Seeding E2E fixtures (writer + sample pieces)…"
pnpm --filter backend seed:e2e

# Start the backend on the host (dev mode → NODE_ENV!=production so dev seeds and
# non-secure cookies work), unless it is already answering health checks.
if curl -sf -o /dev/null "${HEALTH_URL}"; then
  echo "→ Backend already healthy at ${HEALTH_URL}."
else
  echo "→ Starting backend (pnpm --filter backend dev)…"
  nohup pnpm --filter backend dev >"${BACKEND_LOG}" 2>&1 &
  echo $! >"${BACKEND_PID_FILE}"
  "${ROOT}/e2e/scripts/wait-health.sh" "${HEALTH_URL}" 120
fi

echo "✓ Stack is up. Run 'pnpm e2e' or 'pnpm e2e:ui'. Tear down with 'pnpm e2e:down'."
