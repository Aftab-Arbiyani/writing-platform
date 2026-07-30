#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/deploy/rollback.sh — deterministic app rollback
#
# Re-deploys a KNOWN-GOOD immutable image tag (sha-… / v…). This is the
# "app rollback" from the docs 15 §5 playbook — safe because the expand-contract
# migration rule guarantees the previous code runs on the current schema.
# (A *schema* rollback is a different tool — restore + PITR, see scripts/db.)
#
# Idempotent: re-running with the same ROLLBACK_IMAGE converges to the same
# state. Guarded by confirm() (set ASSUME_YES=1 for automation).
#
# Config (env):
#   ROLLBACK_IMAGE           REQUIRED — immutable image tag to roll back to
#   DEPLOY_HEALTH_TIMEOUT    seconds to wait for /health/ready (default: 60)
#   DEPLOY_HEALTH_INTERVAL   poll interval seconds (default: 3)
#   SMOKE_BASE_URL           API base URL (default: http://localhost:4000)
#   EXPECTED_VERSION         if set, smoke asserts running /version matches
#   ALLOW_MUTABLE_TAG=1      permit a non-immutable tag (e.g. :latest) — discouraged
#   ASSUME_YES=1             skip the confirmation prompt
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "${SCRIPT_DIR}/../lib/common.sh"

ROLLBACK_IMAGE="${ROLLBACK_IMAGE:-}"
DEPLOY_HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-60}"
DEPLOY_HEALTH_INTERVAL="${DEPLOY_HEALTH_INTERVAL:-3}"
SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://localhost:4000}"
EXPECTED_VERSION="${EXPECTED_VERSION:-}"
ALLOW_MUTABLE_TAG="${ALLOW_MUTABLE_TAG:-0}"

usage() {
  cat <<'EOF'
rollback.sh — re-deploy a known-good immutable image tag.

Usage: ROLLBACK_IMAGE=ghcr.io/qalam/qalam-backend:sha-abc123 rollback.sh [--help]

Key env: ROLLBACK_IMAGE (required), DEPLOY_HEALTH_TIMEOUT, EXPECTED_VERSION,
         ALLOW_MUTABLE_TAG=1, ASSUME_YES=1.
EOF
}
case "${1:-}" in -h | --help) usage; exit 0 ;; esac

require_cmd docker curl
[ -n "${ROLLBACK_IMAGE}" ] || die "ROLLBACK_IMAGE is required (an immutable sha-/v- tag)"
[ -f "${COMPOSE_FILE}" ] || die "compose file missing: ${COMPOSE_FILE}"

TAG="${ROLLBACK_IMAGE##*:}"
if [ "${TAG}" = "latest" ] || [ "${TAG}" = "${ROLLBACK_IMAGE}" ]; then
  if [ "${ALLOW_MUTABLE_TAG}" = "1" ]; then
    warn "rolling back to a non-immutable tag (${ROLLBACK_IMAGE}) — ALLOW_MUTABLE_TAG=1"
  else
    die "refusing to roll back to a mutable tag '${ROLLBACK_IMAGE}' — use an immutable sha-/v- tag (or ALLOW_MUTABLE_TAG=1)"
  fi
fi

SHA="$(git_sha)"
export BACKEND_IMAGE="${ROLLBACK_IMAGE}"

wait_ready() {
  local url="${SMOKE_BASE_URL%/}/health/ready" waited=0 code
  log "health gate: waiting for ${url} == 200 (timeout ${DEPLOY_HEALTH_TIMEOUT}s)"
  while [ "${waited}" -lt "${DEPLOY_HEALTH_TIMEOUT}" ]; do
    code="$(http_code "${url}" 5)"
    [ "${code}" = "200" ] && { log "health gate: READY after ${waited}s"; return 0; }
    sleep "${DEPLOY_HEALTH_INTERVAL}"
    waited=$((waited + DEPLOY_HEALTH_INTERVAL))
  done
  return 1
}

confirm "Roll back backend to '${ROLLBACK_IMAGE}'?" || die "rollback aborted by operator"

log "rollback start: image=${ROLLBACK_IMAGE} sha=${SHA}"
record_deploy rollback "${ROLLBACK_IMAGE}" "${EXPECTED_VERSION}" "${SHA}" started

log "pulling rollback image"
dc pull backend

log "recreating backend container on the rollback image"
dc up -d --no-deps backend

if ! wait_ready; then
  err "rollback health gate FAILED — recent logs:"
  dc logs --tail 50 backend >&2 2>/dev/null || true
  record_deploy rollback "${ROLLBACK_IMAGE}" "${EXPECTED_VERSION}" "${SHA}" failed
  die "rollback failed at health gate — manual intervention required"
fi

log "running smoke test"
EXPECTED_VERSION="${EXPECTED_VERSION}" SMOKE_BASE_URL="${SMOKE_BASE_URL}" \
  "${SCRIPT_DIR}/smoke.sh" || {
  record_deploy rollback "${ROLLBACK_IMAGE}" "${EXPECTED_VERSION}" "${SHA}" smoke-failed
  die "rollback smoke test failed — manual intervention required"
}

record_deploy rollback "${ROLLBACK_IMAGE}" "${EXPECTED_VERSION}" "${SHA}" success
log "rollback SUCCESS: ${ROLLBACK_IMAGE}"
