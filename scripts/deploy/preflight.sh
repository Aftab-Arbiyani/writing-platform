#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/deploy/preflight.sh — pre-deploy Go/No-Go checks
#
# Runs BEFORE deploy.sh. Fails fast (non-zero) on any HARD problem so a bad
# release never starts. Soft problems are logged as warnings.
#
# Checks:
#   [hard]  compose file + .env.production present
#   [hard]  required env vars present & non-empty (REQUIRED_ENV_VARS)
#   [hard]  target backend image resolvable (manifest inspect / local / pull)
#   [hard]  enough free disk on the backup + docker data paths (MIN_FREE_MB)
#   [soft]  Postgres reachable (via compose network) — hard with DB_STRICT=1
#   [info]  current running /version (if the API is up)
#
# Config (env):
#   ENV_FILE            env file            (default: <repo>/.env.production)
#   COMPOSE_FILE        compose file        (default: <repo>/docker-compose.prod.yml)
#   BACKEND_IMAGE       image to deploy     (default: from compose / ghcr latest)
#   REQUIRED_ENV_VARS   space list          (default: "POSTGRES_PASSWORD DATABASE_URL")
#   IMAGE_CHECK         manifest|pull|skip  (default: manifest)
#   MIN_FREE_MB         min free disk (MB)  (default: 2048)
#   CHECK_PATHS         space list of dirs to disk-check (default: repo + BACKUP_DIR)
#   DB_STRICT=1         treat DB unreachable as a hard failure (default: soft)
#   SMOKE_BASE_URL      API base URL for the /version probe (default: http://localhost:4000)
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "${SCRIPT_DIR}/../lib/common.sh"

BACKEND_IMAGE="${BACKEND_IMAGE:-ghcr.io/qalam/qalam-backend:latest}"
REQUIRED_ENV_VARS="${REQUIRED_ENV_VARS:-POSTGRES_PASSWORD DATABASE_URL}"
IMAGE_CHECK="${IMAGE_CHECK:-manifest}"
MIN_FREE_MB="${MIN_FREE_MB:-2048}"
DB_STRICT="${DB_STRICT:-0}"
SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://localhost:4000}"

usage() {
  cat <<'EOF'
preflight.sh — pre-deploy Go/No-Go checks (fails fast on hard problems).

Usage: preflight.sh [--help]

Key env: BACKEND_IMAGE, REQUIRED_ENV_VARS, IMAGE_CHECK(manifest|pull|skip),
         MIN_FREE_MB, CHECK_PATHS, DB_STRICT=1, ENV_FILE, COMPOSE_FILE.
EOF
}
case "${1:-}" in -h | --help) usage; exit 0 ;; esac

FAILURES=0
hard_fail() { err "HARD: $*"; FAILURES=$((FAILURES + 1)); }

require_cmd docker curl df

# ── 1. compose file + env file present ──────────────────────────────────────
log "checking deploy artifacts"
[ -f "${COMPOSE_FILE}" ] || hard_fail "compose file missing: ${COMPOSE_FILE}"
if [ -f "${ENV_FILE}" ]; then
  load_env "${ENV_FILE}"
else
  hard_fail "env file missing: ${ENV_FILE} (copy from backend/.env.example and fill secrets)"
fi

# ── 2. required env vars present ─────────────────────────────────────────────
log "checking required env vars: ${REQUIRED_ENV_VARS}"
for v in ${REQUIRED_ENV_VARS}; do
  if [ -z "${!v:-}" ]; then
    hard_fail "required env var not set: ${v}"
  else
    log "present: ${v}"   # value is never printed
  fi
done

# ── 3. target image resolvable ───────────────────────────────────────────────
log "checking backend image: ${BACKEND_IMAGE} (mode=${IMAGE_CHECK})"
case "${IMAGE_CHECK}" in
  skip)
    warn "IMAGE_CHECK=skip — not verifying image availability"
    ;;
  manifest)
    if docker manifest inspect "${BACKEND_IMAGE}" >/dev/null 2>&1; then
      log "image manifest resolvable in registry"
    elif docker image inspect "${BACKEND_IMAGE}" >/dev/null 2>&1; then
      warn "manifest not resolvable, but image exists locally — will deploy the local copy"
    else
      hard_fail "image not resolvable (registry manifest + local both missing): ${BACKEND_IMAGE}"
    fi
    ;;
  pull)
    if docker pull "${BACKEND_IMAGE}" >/dev/null 2>&1; then
      log "image pulled successfully"
    else
      hard_fail "docker pull failed: ${BACKEND_IMAGE}"
    fi
    ;;
  *)
    hard_fail "invalid IMAGE_CHECK=${IMAGE_CHECK} (want manifest|pull|skip)"
    ;;
esac

if [ "${BACKEND_IMAGE}" = "${BACKEND_IMAGE%%:*}:latest" ] || [ "${BACKEND_IMAGE##*:}" = "latest" ]; then
  warn "BACKEND_IMAGE uses the ':latest' tag — prefer an immutable sha-/v- tag so rollback is deterministic"
fi

# ── 4. disk space ────────────────────────────────────────────────────────────
CHECK_PATHS="${CHECK_PATHS:-${REPO_ROOT} ${BACKUP_DIR:-${REPO_ROOT}/backups}}"
log "checking free disk (>= ${MIN_FREE_MB} MB) on: ${CHECK_PATHS}"
for p in ${CHECK_PATHS}; do
  # Walk up to the nearest existing parent so df has something to report on.
  probe="${p}"
  while [ ! -e "${probe}" ] && [ "${probe}" != "/" ]; do probe="$(dirname "${probe}")"; done
  free_mb="$(df -Pm "${probe}" 2>/dev/null | awk 'NR==2 {print $4}')"
  if [ -z "${free_mb:-}" ]; then
    warn "could not determine free space for ${p} (probed ${probe})"
  elif [ "${free_mb}" -lt "${MIN_FREE_MB}" ]; then
    hard_fail "low disk on ${p}: ${free_mb} MB free (< ${MIN_FREE_MB} MB)"
  else
    log "disk OK ${p}: ${free_mb} MB free"
  fi
done

# ── 5. Postgres reachable (via compose network) ──────────────────────────────
log "checking Postgres reachability (compose service 'postgres')"
if dc ps postgres >/dev/null 2>&1 && dc exec -T postgres pg_isready >/dev/null 2>&1; then
  log "Postgres is accepting connections"
else
  msg="Postgres not reachable via compose (stack may be down — expected on a first deploy)"
  if [ "${DB_STRICT}" = "1" ]; then hard_fail "${msg}"; else warn "${msg}"; fi
fi

# ── 6. current running version (informational) ───────────────────────────────
cur_ver="$(json_field version "$(http_body "${SMOKE_BASE_URL%/}/version" 3)")"
if [ -n "${cur_ver}" ]; then
  log "currently running version: ${cur_ver}"
else
  log "no running version reported (API down or first deploy)"
fi

# ── Verdict ──────────────────────────────────────────────────────────────────
if [ "${FAILURES}" -gt 0 ]; then
  die "preflight: NO-GO (${FAILURES} hard failure(s))"
fi
log "preflight: GO"
