#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/db/migrate-verify.sh — migration reversibility check (up→down→up)
#
# Mirrors the CI gate: proves the newest migration is reversible by running
#   1. up    (apply)
#   2. down  (revert one step)
#   3. up    (re-apply)
# and asserting each step exits 0. If any step fails, the migration is not
# safely reversible — fix its down() before it reaches production.
#
# DESTRUCTIVE (it reverts schema). Point it at a SCRATCH / CI database, never
# production. Guarded by confirm() (ASSUME_YES=1 in CI).
#
# All connection + command config is delegated to migrate.sh — set the same
# env you would there (PSQL_DSN or USE_COMPOSE_PSQL, MIGRATE_CMD_*), pointed at
# the target/scratch DB.
#
# Config (env):
#   PSQL_DSN / DATABASE_URL   scratch DB DSN (see migrate.sh)
#   MIGRATE_CMD_UP/DOWN       migrate commands (see migrate.sh)
#   ASSUME_YES=1              skip the confirmation prompt
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "${SCRIPT_DIR}/../lib/common.sh"

usage() {
  cat <<'EOF'
migrate-verify.sh — reversibility check: up → down → up (each must exit 0).

Usage: migrate-verify.sh [--help]

Point PSQL_DSN/DATABASE_URL (or USE_COMPOSE_PSQL=1) at a SCRATCH DB — this
reverts schema. Delegates all migrate config to migrate.sh.
EOF
}
case "${1:-}" in -h | --help) usage; exit 0 ;; esac

MIGRATE="${SCRIPT_DIR}/migrate.sh"
[ -x "${MIGRATE}" ] || die "migrate.sh not found/executable at ${MIGRATE}"

TARGET="$(redact_dsn "${PSQL_DSN:-${DATABASE_URL:-<compose-psql>}}")"
warn "reversibility check will apply+revert+re-apply migrations against: ${TARGET}"
confirm "Proceed? This MUST be a scratch/CI database, not production." \
  || die "migrate-verify aborted by operator"

step() {
  local label="${1}" dir="${2}"
  log "── step: ${label} (migrate ${dir}) ──"
  if "${MIGRATE}" "${dir}"; then
    log "step OK: ${label}"
  else
    die "step FAILED: ${label} — migration is not safely reversible"
  fi
}

log "migration reversibility check starting"
step "1/3 apply"     up
step "2/3 revert"    down
step "3/3 re-apply"  up
log "migrate-verify: PASS — up→down→up all succeeded"
