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

# `--wait` covers only the LONG-RUNNING services. `minio-init` is deliberately excluded:
# it is a one-shot `mc` container that creates the bucket and exits 0, and current Compose
# (tested on Docker 29.7.2 / Compose v5.4.0) treats an exited dependency as a `--wait`
# FAILURE — it prints "container qalam-minio-init-1 exited (0)" and returns 1. With
# `set -e` that killed this script before the migrations ran, so `pnpm e2e:up` never
# produced a usable stack on a current Docker and every step after this line was
# unreachable. That is very plausibly why five rows of specs were written and never run
# locally.
#
# It is still STARTED, just not waited on: `up -d` brings it up, and it only has to finish
# before something reads the bucket, which nothing does during bring-up. Older Compose,
# which tolerated the exited container, is unaffected — the service list is simply shorter.
#
# The alternative, `depends_on: { minio-init: { condition: service_completed_successfully } }`,
# was not taken: it would make the bucket a hard gate for every `docker compose up` in the
# repo, including plain local dev, for a step that is idempotent and fast.
echo "→ Starting infra (postgres, redis, minio, minio-init, mailpit)…"
docker compose up -d postgres redis minio minio-init mailpit
docker compose up -d --wait postgres redis minio mailpit

# The bucket-creation container is not waited on above, so report what it did rather than
# leaving a silent failure to surface later as a broken media upload.
# `ps -aq`, not `ps -q`: this container has already exited by now, and `-q` lists only running
# ones — which is the same distinction that broke `--wait` above.
INIT_CID="$(docker compose ps -aq minio-init 2>/dev/null || true)"
if [ -n "${INIT_CID}" ]; then
  INIT_EXIT="$(docker inspect -f '{{.State.ExitCode}}' "${INIT_CID}" 2>/dev/null || echo '?')"
  if [ "${INIT_EXIT}" = "0" ]; then
    echo "  ✓ minio-init completed (bucket qalam-media ready)."
  else
    echo "  ! minio-init exited ${INIT_EXIT} — media uploads may fail. Logs:"
    docker compose logs --no-log-prefix --tail 20 minio-init || true
  fi
fi

echo "→ Running migrations…"
pnpm --filter backend migration:run

echo "→ Seeding baseline (roles/permissions/taxonomy/super-admin)…"
pnpm --filter backend seed

echo "→ Seeding E2E fixtures (writer + sample pieces)…"
pnpm --filter backend seed:e2e

# The suite mints a fresh login per test, which exhausts the auth tier's hourly
# bucket and 429s (docs/e2e/06 §6); `web-e2e.yml` sets this and local runs must too.
export RATE_LIMIT_ENABLED=false

# The `manual` payment provider (ManualAdapter) — settles a charge without a processor, so the af5
# row can assert subscribe → payment → entitlement end to end. Every real adapter is key-gated and
# this stack holds no processor credentials, so without this nothing can complete a checkout
# (docs/e2e/06 §6, 48 §3.6 W4-4). Off by default everywhere else: it books revenue nobody collected.
export PAYMENTS_MANUAL_ENABLED=true

# The `stub` AI provider (StubAdapter) — streams a fixed passage with no vendor behind it, so the af2
# row can assert a generated suggestion arriving in the editor. Every real AI adapter is credential-
# gated and this stack holds no vendor key, so without this the AI module refuses rather than no-ops
# (docs/e2e/06 §6). `AI_DEFAULT_PROVIDER` is the other half: the default is `openai`, so the
# orchestrator would resolve a provider whose adapter has no key. Test stacks only — with these set,
# every writer's "suggestion" is the same canned paragraph.
export AI_STUB_ENABLED=true
export AI_DEFAULT_PROVIDER=stub

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
