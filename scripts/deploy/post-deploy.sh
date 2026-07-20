#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/deploy/post-deploy.sh — post-deploy verification + soak window
#
# Runs AFTER deploy.sh has reported success. Confirms the release is stable:
#   1. smoke test (deploy/smoke.sh)
#   2. a short monitoring/soak window — poll /health/ready repeatedly and
#      require it to STAY green for MONITOR_WINDOW seconds (catches a service
#      that comes up green then crash-loops or degrades)
#   3. record the observed outcome in the deploy history
#
# Config (env):
#   SMOKE_BASE_URL     API base URL              (default: http://localhost:4000)
#   EXPECTED_VERSION   passed through to smoke    (optional)
#   MONITOR_WINDOW     soak duration seconds      (default: 120)
#   MONITOR_INTERVAL   poll interval seconds      (default: 10)
#   MONITOR_TOLERATE   consecutive failures tolerated before abort (default: 0)
#   BACKEND_IMAGE      image (for the audit line) (default: from compose)
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "${SCRIPT_DIR}/../lib/common.sh"

SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://localhost:4000}"
EXPECTED_VERSION="${EXPECTED_VERSION:-}"
MONITOR_WINDOW="${MONITOR_WINDOW:-120}"
MONITOR_INTERVAL="${MONITOR_INTERVAL:-10}"
MONITOR_TOLERATE="${MONITOR_TOLERATE:-0}"
BACKEND_IMAGE="${BACKEND_IMAGE:-unknown}"

usage() {
  cat <<'EOF'
post-deploy.sh — smoke + soak window, then record the outcome.

Usage: post-deploy.sh [--help]

Key env: SMOKE_BASE_URL, EXPECTED_VERSION, MONITOR_WINDOW (s),
         MONITOR_INTERVAL (s), MONITOR_TOLERATE (consecutive failures).
EOF
}
case "${1:-}" in -h | --help) usage; exit 0 ;; esac

require_cmd curl
SHA="$(git_sha)"

log "post-deploy verification against ${SMOKE_BASE_URL}"

# 1. Smoke.
EXPECTED_VERSION="${EXPECTED_VERSION}" SMOKE_BASE_URL="${SMOKE_BASE_URL}" \
  "${SCRIPT_DIR}/smoke.sh" || {
  record_deploy post-deploy "${BACKEND_IMAGE}" "${EXPECTED_VERSION}" "${SHA}" smoke-failed
  die "post-deploy: smoke failed"
}

# 2. Soak — readiness must stay green for the whole window.
log "soak: monitoring /health/ready for ${MONITOR_WINDOW}s (interval ${MONITOR_INTERVAL}s, tolerate ${MONITOR_TOLERATE} misses)"
url="${SMOKE_BASE_URL%/}/health/ready"
waited=0
failures=0
while [ "${waited}" -lt "${MONITOR_WINDOW}" ]; do
  code="$(http_code "${url}" 5)"
  if [ "${code}" = "200" ]; then
    log "soak +${waited}s: ready (200)"
  else
    failures=$((failures + 1))
    warn "soak +${waited}s: NOT ready (${code}) — miss ${failures}/${MONITOR_TOLERATE}"
    if [ "${failures}" -gt "${MONITOR_TOLERATE}" ]; then
      record_deploy post-deploy "${BACKEND_IMAGE}" "${EXPECTED_VERSION}" "${SHA}" soak-failed
      die "post-deploy: service degraded during soak (code ${code}) — investigate / consider rollback"
    fi
  fi
  sleep "${MONITOR_INTERVAL}"
  waited=$((waited + MONITOR_INTERVAL))
done

# 3. Record success.
record_deploy post-deploy "${BACKEND_IMAGE}" "${EXPECTED_VERSION}" "${SHA}" success
log "post-deploy: PASS — release stable over ${MONITOR_WINDOW}s soak"
