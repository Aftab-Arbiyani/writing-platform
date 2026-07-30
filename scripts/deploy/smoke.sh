#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/deploy/smoke.sh — post-deploy verification
#
# Curls the root-mounted health/version endpoints (no /api prefix) with
# retry + exponential backoff, and — when EXPECTED_VERSION is set — asserts
# the running /version.version matches the release being deployed.
#
# Endpoints (docs 14 §3): GET /health/ready, /health/startup, /version
#   /version JSON: { service, version, commit, environment, releaseChannel }
#
# Config (env):
#   SMOKE_BASE_URL     base URL of the API            (default: http://localhost:4000)
#   SMOKE_RETRIES      max attempts per endpoint      (default: 10)
#   SMOKE_BACKOFF      initial backoff seconds        (default: 2, doubles, capped 30)
#   SMOKE_TIMEOUT      per-request curl timeout (s)   (default: 5)
#   EXPECTED_VERSION   if set, running version must equal it (else the run fails)
#
# Exit 0 = all checks green. Non-zero = a check failed.
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "${SCRIPT_DIR}/../lib/common.sh"

SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://localhost:4000}"
SMOKE_RETRIES="${SMOKE_RETRIES:-10}"
SMOKE_BACKOFF="${SMOKE_BACKOFF:-2}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-5}"
EXPECTED_VERSION="${EXPECTED_VERSION:-}"

usage() {
  cat <<'EOF'
smoke.sh — post-deploy health/version verification (retry + backoff).

Usage: smoke.sh [--help]

Config via env:
  SMOKE_BASE_URL   API base URL          (default: http://localhost:4000)
  SMOKE_RETRIES    attempts per endpoint (default: 10)
  SMOKE_BACKOFF    initial backoff (s)   (default: 2, doubles, capped 30)
  SMOKE_TIMEOUT    per-request timeout   (default: 5)
  EXPECTED_VERSION assert /version.version == this value (optional)
EOF
}
case "${1:-}" in -h | --help) usage; exit 0 ;; esac

require_cmd curl

# wait_endpoint <path> <expected_http_code> — retry with exponential backoff.
wait_endpoint() {
  local path="${1}" want="${2}" url="${SMOKE_BASE_URL%/}${path}"
  local attempt=1 backoff="${SMOKE_BACKOFF}" code
  while true; do
    code="$(http_code "${url}" "${SMOKE_TIMEOUT}")"
    if [ "${code}" = "${want}" ]; then
      log "OK   ${path} -> ${code}"
      return 0
    fi
    if [ "${attempt}" -ge "${SMOKE_RETRIES}" ]; then
      err "FAIL ${path} -> ${code} (wanted ${want}) after ${SMOKE_RETRIES} attempts"
      return 1
    fi
    warn "wait ${path} -> ${code} (want ${want}); attempt ${attempt}/${SMOKE_RETRIES}, sleeping ${backoff}s"
    sleep "${backoff}"
    backoff=$((backoff * 2))
    [ "${backoff}" -gt 30 ] && backoff=30
    attempt=$((attempt + 1))
  done
}

main() {
  log "smoke test against ${SMOKE_BASE_URL}"
  local rc=0

  # Readiness gates traffic — it must return 200.
  wait_endpoint '/health/ready' '200' || rc=1
  # Startup probe — 200 once bootstrap/migrations checks have completed.
  wait_endpoint '/health/startup' '200' || rc=1
  # Version endpoint must be reachable.
  wait_endpoint '/version' '200' || rc=1

  # Version assertion (release-gate): the deployed build must be running.
  if [ -n "${EXPECTED_VERSION}" ]; then
    local body running
    body="$(http_body "${SMOKE_BASE_URL%/}/version" "${SMOKE_TIMEOUT}")"
    running="$(json_field version "${body}")"
    if [ -z "${running}" ]; then
      err "could not read /version.version from response"
      rc=1
    elif [ "${running}" != "${EXPECTED_VERSION}" ]; then
      err "version mismatch: running='${running}' expected='${EXPECTED_VERSION}'"
      rc=1
    else
      log "OK   /version.version == ${running}"
    fi
  fi

  if [ "${rc}" -eq 0 ]; then
    log "smoke: PASS"
  else
    err "smoke: FAIL"
  fi
  return "${rc}"
}

main "$@"
