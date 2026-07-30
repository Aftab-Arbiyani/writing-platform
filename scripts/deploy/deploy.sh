#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/deploy/deploy.sh — health-gated compose deploy (single-VM, Phase 1)
#
# Flow:
#   1. pull BACKEND_IMAGE
#   2. run DB migrations via the safe runner (db/migrate.sh up) unless skipped
#   3. `docker compose up -d` (recreates the backend; postgres/redis untouched)
#   4. HEALTH GATE: wait for GET /health/ready == 200 within DEPLOY_HEALTH_TIMEOUT
#   5. smoke test (deploy/smoke.sh)
#   6. append a deploy-audit line (ts, image, version, git-sha, operator, host)
#
# On a failed health gate the script exits non-zero WITHOUT tearing anything
# down — it surfaces the failure so an operator can run rollback.sh with the
# previous immutable image (compose has already recreated the container, so
# there is no old container to "keep"; deterministic rollback is the recovery).
#
# Config (env):
#   BACKEND_IMAGE            image to deploy (default: ghcr.io/qalam/qalam-backend:latest)
#   DEPLOY_HEALTH_TIMEOUT    seconds to wait for /health/ready (default: 60, docs 15 §6)
#   DEPLOY_HEALTH_INTERVAL   poll interval seconds (default: 3)
#   SMOKE_BASE_URL           API base URL (default: http://localhost:4000)
#   EXPECTED_VERSION         if set, smoke asserts running /version matches
#   SKIP_MIGRATIONS=1        skip the migration step (schema already current)
#   SKIP_SMOKE=1             skip the post-up smoke test
#   MIGRATE_CMD              override migrate command (see db/migrate.sh header)
#   DEPLOY_OPERATOR          operator name for the audit line (default: $USER)
#
# ── EXTENSION POINTS (NOT implemented — single-VM Phase 1 is single-color) ──
# Blue/green: template a second compose project (COMPOSE_PROJECT_NAME=qalam-green
#   with backend published on an alternate host port), bring "green" up, health-gate
#   + smoke it, then flip the nginx upstream (infrastructure/nginx) from blue→green
#   and stop blue. Rollback = flip the upstream back. Keep migrations expand-contract
#   so both colors run against one schema (docs 15 §5).
# Canary: publish green on a second upstream and shift weight in nginx
#   (e.g. 95/5 → 50/50 → 0/100), watching error-rate/latency (docs 14) between steps;
#   abort = weight back to 0 on green. Both live at the edge, not in this script.
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "${SCRIPT_DIR}/../lib/common.sh"

BACKEND_IMAGE="${BACKEND_IMAGE:-ghcr.io/qalam/qalam-backend:latest}"
DEPLOY_HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-60}"
DEPLOY_HEALTH_INTERVAL="${DEPLOY_HEALTH_INTERVAL:-3}"
SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://localhost:4000}"
EXPECTED_VERSION="${EXPECTED_VERSION:-}"
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-0}"
SKIP_SMOKE="${SKIP_SMOKE:-0}"

usage() {
  cat <<'EOF'
deploy.sh — health-gated single-VM compose deploy.

Usage: BACKEND_IMAGE=ghcr.io/qalam/qalam-backend:sha-abc123 deploy.sh [--help]

Key env: BACKEND_IMAGE, DEPLOY_HEALTH_TIMEOUT, EXPECTED_VERSION,
         SKIP_MIGRATIONS=1, SKIP_SMOKE=1, MIGRATE_CMD, DEPLOY_OPERATOR.
EOF
}
case "${1:-}" in -h | --help) usage; exit 0 ;; esac

require_cmd docker curl
[ -f "${COMPOSE_FILE}" ] || die "compose file missing: ${COMPOSE_FILE}"
[ -f "${ENV_FILE}" ] || die "env file missing: ${ENV_FILE}"

export BACKEND_IMAGE  # compose interpolates ${BACKEND_IMAGE}
SHA="$(git_sha)"

# wait_ready — poll /health/ready until 200 or timeout. Returns non-zero on timeout.
wait_ready() {
  local url="${SMOKE_BASE_URL%/}/health/ready" waited=0 code
  log "health gate: waiting for ${url} == 200 (timeout ${DEPLOY_HEALTH_TIMEOUT}s)"
  while [ "${waited}" -lt "${DEPLOY_HEALTH_TIMEOUT}" ]; do
    code="$(http_code "${url}" 5)"
    if [ "${code}" = "200" ]; then
      log "health gate: READY after ${waited}s"
      return 0
    fi
    sleep "${DEPLOY_HEALTH_INTERVAL}"
    waited=$((waited + DEPLOY_HEALTH_INTERVAL))
  done
  return 1
}

main() {
  log "deploy start: image=${BACKEND_IMAGE} sha=${SHA}"
  record_deploy deploy "${BACKEND_IMAGE}" "${EXPECTED_VERSION}" "${SHA}" started

  # 1. Pull the target image.
  log "pulling image"
  dc pull backend

  # 2. Migrations (safe runner: advisory-locked + audited). Expand-contract only.
  if [ "${SKIP_MIGRATIONS}" = "1" ]; then
    warn "SKIP_MIGRATIONS=1 — not running migrations"
  else
    log "running database migrations (up)"
    "${SCRIPT_DIR}/../db/migrate.sh" up
  fi

  # 3. Recreate the backend with the new image (data stores are left running).
  #    --no-deps: don't touch postgres/redis; they are stateful and healthy.
  log "recreating backend container"
  dc up -d --no-deps backend

  # 4. Health gate — the deploy is not "done" until readiness is green.
  if ! wait_ready; then
    err "health gate FAILED within ${DEPLOY_HEALTH_TIMEOUT}s — service is NOT healthy"
    err "recent backend logs:"
    dc logs --tail 50 backend >&2 2>/dev/null || true
    record_deploy deploy "${BACKEND_IMAGE}" "${EXPECTED_VERSION}" "${SHA}" failed
    die "deploy failed at health gate — run rollback.sh ROLLBACK_IMAGE=<previous-sha-tag>"
  fi

  # 5. Smoke test.
  if [ "${SKIP_SMOKE}" = "1" ]; then
    warn "SKIP_SMOKE=1 — not running smoke test"
  else
    log "running smoke test"
    EXPECTED_VERSION="${EXPECTED_VERSION}" SMOKE_BASE_URL="${SMOKE_BASE_URL}" \
      "${SCRIPT_DIR}/smoke.sh" || {
      record_deploy deploy "${BACKEND_IMAGE}" "${EXPECTED_VERSION}" "${SHA}" smoke-failed
      die "deploy failed at smoke — run rollback.sh ROLLBACK_IMAGE=<previous-sha-tag>"
    }
  fi

  # 6. Record success.
  record_deploy deploy "${BACKEND_IMAGE}" "${EXPECTED_VERSION}" "${SHA}" success
  log "deploy SUCCESS: ${BACKEND_IMAGE}"
}

main "$@"
