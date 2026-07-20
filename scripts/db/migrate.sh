#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/db/migrate.sh — safe, locked, audited migration runner
#
#   migrate.sh [up|down]        (default: up)
#
# Guarantees:
#   * MUTUAL EXCLUSION — holds a Postgres session-level advisory lock for the
#     WHOLE migration (a background psql session keeps it; the lock is released
#     the instant that session ends), so two concurrent runners can't collide.
#   * AUDIT — ensures schema_migration_audit exists and appends one row per run
#     (ran_at, git_sha, app_version, direction, operator, host).
#   * TRAP-BASED RELEASE — the lock is released on success, failure, or Ctrl-C.
#
# This script runs the migration by shelling out to MIGRATE_CMD (no backend
# code is imported). It only uses `psql` for the lock + audit bookkeeping.
#
# ── MIGRATE_CMD caveat (READ THIS) ──────────────────────────────────────────
# Default up/down commands run TypeORM in a one-off compose container:
#     docker compose ... run --rm -T backend pnpm --filter backend migration:run
# BUT the production image is a pruned, prod-only deploy (see
# infrastructure/docker/backend.Dockerfile → `pnpm deploy --filter backend --prod`),
# and `migration:run` uses typeorm-ts-node-commonjs (a dev dep). If ts-node is
# not in the image, override with whatever the image actually ships, e.g.:
#     MIGRATE_CMD_UP='dc run --rm -T backend node dist/database/migrate.js up'
# or add a compiled migration entrypoint / ts-node to prod deps. Kept as an env
# override so ops can correct it without editing this script.
#
# Config (env):
#   DIRECTION arg           up | down                              (default: up)
#   MIGRATE_CMD             override for BOTH directions (alias of MIGRATE_CMD_UP)
#   MIGRATE_CMD_UP          command to apply migrations  (default: dc run … migration:run)
#   MIGRATE_CMD_DOWN        command to revert one step   (default: dc run … migration:revert)
#   MIGRATION_LOCK_KEY      advisory lock key int        (default: 4815162342)
#   MIGRATION_LOCK_WAIT     seconds to wait for the lock (default: 120)
#   USE_COMPOSE_PSQL=1      route psql through `dc exec -T postgres` (on-VM; stack up)
#   PSQL_DSN                host-reachable DSN for psql  (default: $DATABASE_URL)
#   POSTGRES_USER/DB        used in compose-psql mode    (default: qalam / qalam)
#   APP_VERSION             recorded in the audit row    (optional)
#   DEPLOY_OPERATOR         operator recorded in audit   (default: $USER)
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "${SCRIPT_DIR}/../lib/common.sh"

MIGRATE_CMD_UP="${MIGRATE_CMD_UP:-${MIGRATE_CMD:-}}"
MIGRATE_CMD_DOWN="${MIGRATE_CMD_DOWN:-}"
MIGRATION_LOCK_KEY="${MIGRATION_LOCK_KEY:-4815162342}"
MIGRATION_LOCK_WAIT="${MIGRATION_LOCK_WAIT:-120}"
USE_COMPOSE_PSQL="${USE_COMPOSE_PSQL:-0}"
PSQL_DSN="${PSQL_DSN:-${DATABASE_URL:-}}"

usage() {
  cat <<'EOF'
migrate.sh — advisory-locked, audited TypeORM migration runner.

Usage: migrate.sh [up|down] [--help]     (default: up)

Key env: MIGRATE_CMD / MIGRATE_CMD_UP / MIGRATE_CMD_DOWN, MIGRATION_LOCK_KEY,
         MIGRATION_LOCK_WAIT, USE_COMPOSE_PSQL=1, PSQL_DSN, APP_VERSION.
See the script header for the important MIGRATE_CMD caveat.
EOF
}

DIRECTION="up"
case "${1:-up}" in
  -h | --help) usage; exit 0 ;;
  up | down) DIRECTION="${1:-up}" ;;
  *) die "invalid direction '${1}' (want: up | down)" ;;
esac

require_cmd docker
[ "${USE_COMPOSE_PSQL}" = "1" ] || require_cmd psql
if [ "${USE_COMPOSE_PSQL}" != "1" ] && [ -z "${PSQL_DSN}" ]; then
  die "no PSQL_DSN/DATABASE_URL set and USE_COMPOSE_PSQL!=1 — psql cannot connect for lock/audit"
fi

# ── psql invocation (host DSN vs compose exec) ──────────────────────────────
psql_cmd() {
  if [ "${USE_COMPOSE_PSQL}" = "1" ]; then
    dc exec -T postgres psql -U "${POSTGRES_USER:-qalam}" -d "${POSTGRES_DB:-qalam}" \
      -v ON_ERROR_STOP=1 -qtA "$@"
  else
    psql "${PSQL_DSN}" -v ON_ERROR_STOP=1 -qtA "$@"
  fi
}

# ── Advisory lock held for the whole migration ──────────────────────────────
# A background psql session acquires pg_advisory_lock and then simply reads its
# command stream from a FIFO. We keep the FIFO's write end open (FD 9); the lock
# lives exactly as long as that session. Closing FD 9 (EOF) — or killing the
# session — ends it and releases the lock. This is how a *session* lock can span
# an external command (the migration) run in a separate process.
_LOCK_FIFO=""
_LOCK_STATUS=""
_LOCK_PID=""

_cleanup_lock_files() {
  [ -n "${_LOCK_FIFO}" ] && rm -f "${_LOCK_FIFO}"
  [ -n "${_LOCK_STATUS}" ] && rm -f "${_LOCK_STATUS}"
}

release_lock() {
  if [ -n "${_LOCK_PID}" ]; then
    exec 9>&- 2>/dev/null || true       # EOF → held session exits → lock released
    kill "${_LOCK_PID}" 2>/dev/null || true
    wait "${_LOCK_PID}" 2>/dev/null || true
    log "advisory lock ${MIGRATION_LOCK_KEY} released"
    _LOCK_PID=""
  fi
  _cleanup_lock_files
}

acquire_lock() {
  _LOCK_FIFO="$(mktemp -u "${TMPDIR:-/tmp}/qalam-miglock.XXXXXX")"
  _LOCK_STATUS="$(mktemp "${TMPDIR:-/tmp}/qalam-migstat.XXXXXX")"
  mkfifo "${_LOCK_FIFO}"
  trap release_lock EXIT INT TERM

  # Keep a writer open first (RW open never blocks), then start the reader.
  exec 9<>"${_LOCK_FIFO}"
  psql_cmd <"${_LOCK_FIFO}" >"${_LOCK_STATUS}" 2>&1 &
  _LOCK_PID=$!

  log "acquiring advisory lock ${MIGRATION_LOCK_KEY} (waiting up to ${MIGRATION_LOCK_WAIT}s)"
  printf 'SELECT pg_advisory_lock(%s);\n\\echo QALAM_LOCK_ACQUIRED\n' "${MIGRATION_LOCK_KEY}" >&9

  local waited=0
  until grep -q 'QALAM_LOCK_ACQUIRED' "${_LOCK_STATUS}" 2>/dev/null; do
    if ! kill -0 "${_LOCK_PID}" 2>/dev/null; then
      err "lock session exited before acquiring the lock:"
      cat "${_LOCK_STATUS}" >&2 2>/dev/null || true
      die "failed to acquire advisory lock ${MIGRATION_LOCK_KEY}"
    fi
    if [ "${waited}" -ge "${MIGRATION_LOCK_WAIT}" ]; then
      die "timed out (${MIGRATION_LOCK_WAIT}s) waiting for advisory lock ${MIGRATION_LOCK_KEY} — another migration in progress?"
    fi
    sleep 1
    waited=$((waited + 1))
  done
  log "advisory lock ${MIGRATION_LOCK_KEY} acquired"
}

ensure_audit_table() {
  log "ensuring schema_migration_audit table exists"
  psql_cmd <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migration_audit (
  id          bigserial PRIMARY KEY,
  ran_at      timestamptz NOT NULL DEFAULT now(),
  git_sha     text,
  app_version text,
  direction   text NOT NULL,
  operator    text,
  host        text
);
SQL
}

record_audit_row() {
  local direction="${1}" op host
  op="${DEPLOY_OPERATOR:-${SUDO_USER:-${USER:-unknown}}}"
  host="$(hostname 2>/dev/null || printf 'unknown')"
  psql_cmd -v sha="$(git_sha)" -v ver="${APP_VERSION:-}" -v dir="${direction}" \
    -v op="${op}" -v host="${host}" <<'SQL'
INSERT INTO schema_migration_audit (git_sha, app_version, direction, operator, host)
VALUES (:'sha', :'ver', :'dir', :'op', :'host');
SQL
}

run_migration() {
  local direction="${1}"
  if [ "${direction}" = "up" ]; then
    if [ -n "${MIGRATE_CMD_UP}" ]; then
      log "running migration UP via override: ${MIGRATE_CMD_UP}"
      bash -c "${MIGRATE_CMD_UP}"
    else
      # Default targets the compiled entrypoint that ships in the pruned prod
      # image (dist/database/migrate.js) — no ts-node/dev deps required.
      log "running migration UP (default: compose one-off container, compiled runner)"
      dc run --rm -T backend node dist/database/migrate.js up
    fi
  else
    if [ -n "${MIGRATE_CMD_DOWN}" ]; then
      log "running migration DOWN via override: ${MIGRATE_CMD_DOWN}"
      bash -c "${MIGRATE_CMD_DOWN}"
    else
      log "running migration DOWN (default: compose one-off container, reverts one step)"
      dc run --rm -T backend node dist/database/migrate.js down
    fi
  fi
}

main() {
  log "migrate: direction=${DIRECTION}"
  acquire_lock
  ensure_audit_table
  run_migration "${DIRECTION}"
  record_audit_row "${DIRECTION}"
  log "migrate: ${DIRECTION} complete"
  # release_lock runs via the EXIT trap
}

main "$@"
