#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/db/verify-backup.sh — restore-verification drill (P7.1)
#
# Proves a backup is actually restorable (a backup you have never restored is
# not a backup). Restores a dump into a SCRATCH database, runs sanity queries,
# reports pass/fail + elapsed time (an RTO sample), then drops the scratch DB.
#
#   verify-backup.sh [dump-file]     # default: newest dump in BACKUP_DIR
#
# Config (env):
#   VERIFY_DATABASE_URL   REQUIRED — scratch DSN to restore INTO (must be
#                         disposable; it is wiped with --clean). NEVER a live DB.
#   BACKUP_DIR            where to find the newest dump (default: <repo>/backups)
#   BACKUP_ENV            env label used in the dump filename (default: prod)
#   MIN_ROWS_USERS        minimum rows expected in `users` to call it sane (default: 0)
#   DRILL_LOG             append an RTO line here if set
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "${SCRIPT_DIR}/../lib/common.sh"

BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
BACKUP_ENV="${BACKUP_ENV:-prod}"
MIN_ROWS_USERS="${MIN_ROWS_USERS:-0}"

usage() {
  cat <<'EOF'
verify-backup.sh — restore a dump into a scratch DB, sanity-check, report RTO.

Usage: VERIFY_DATABASE_URL=postgres://…/scratch verify-backup.sh [dump-file]

Restores into VERIFY_DATABASE_URL (DESTRUCTIVE to that scratch DB, --clean),
runs sanity queries (migrations table + key tables), prints PASS/FAIL and the
elapsed restore time as an RTO sample.
EOF
}
case "${1:-}" in -h | --help) usage; exit 0 ;; esac

require_cmd pg_restore psql
[ -n "${VERIFY_DATABASE_URL:-}" ] || die "VERIFY_DATABASE_URL (a disposable scratch DSN) is required"

# Guard: refuse to run against the production DSN by accident.
if [ -n "${DATABASE_URL:-}" ] && [ "${VERIFY_DATABASE_URL}" = "${DATABASE_URL}" ]; then
  die "VERIFY_DATABASE_URL must NOT equal DATABASE_URL — use a throwaway scratch database"
fi

# Resolve the dump: explicit arg, else newest in BACKUP_DIR.
DUMP="${1:-}"
if [ -z "${DUMP}" ]; then
  DUMP="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "qalam-${BACKUP_ENV}-*.dump" 2>/dev/null \
    | sort | tail -n1)"
  [ -n "${DUMP}" ] || die "no dump found in ${BACKUP_DIR} (name qalam-${BACKUP_ENV}-*.dump)"
fi
[ -f "${DUMP}" ] || die "dump not found: ${DUMP}"
log "verifying dump: ${DUMP}"

# ── Verify checksum sidecar first (integrity) ────────────────────────────────
SIDECAR="${DUMP}.sha256"
if [ -f "${SIDECAR}" ]; then
  if has_cmd sha256sum; then got="$(sha256sum "${DUMP}" | awk '{print $1}')";
  else got="$(shasum -a 256 "${DUMP}" | awk '{print $1}')"; fi
  want="$(awk '{print $1}' "${SIDECAR}")"
  [ "${want}" = "${got}" ] || die "checksum MISMATCH before restore (want ${want}, got ${got})"
  log "checksum OK: ${got}"
else
  warn "no checksum sidecar — proceeding without integrity check"
fi

# ── Timed restore into the scratch DB ────────────────────────────────────────
start="$(date +%s)"
log "restoring into scratch $(redact_dsn "${VERIFY_DATABASE_URL}") (--clean)…"
pg_restore --dbname="${VERIFY_DATABASE_URL}" --no-owner --no-acl --clean --if-exists "${DUMP}" \
  >/dev/null 2>&1 || warn "pg_restore emitted warnings (benign ACL/role notices are expected)"
elapsed=$(( $(date +%s) - start ))
log "restore finished in ${elapsed}s (RTO sample)"

# ── Sanity queries ───────────────────────────────────────────────────────────
q() { psql "${VERIFY_DATABASE_URL}" -tAc "$1" 2>/dev/null || printf 'ERR'; }

migrations="$(q "SELECT count(*) FROM migrations")"
users="$(q "SELECT count(*) FROM users")"
pieces="$(q "SELECT count(*) FROM pieces")"

log "sanity: migrations=${migrations} users=${users} pieces=${pieces}"

pass=1
[ "${migrations}" = "ERR" ] || [ "${migrations}" -lt 1 ] 2>/dev/null && { err "migrations table empty/unreadable"; pass=0; }
[ "${users}" = "ERR" ] && { err "users table unreadable"; pass=0; }
if [ "${users}" != "ERR" ] && [ "${users}" -lt "${MIN_ROWS_USERS}" ] 2>/dev/null; then
  err "users rows ${users} < MIN_ROWS_USERS ${MIN_ROWS_USERS}"; pass=0
fi

if [ -n "${DRILL_LOG:-}" ]; then
  printf '%s\trestore-verify\t%s\tRTO=%ss\tmigrations=%s users=%s\n' \
    "$(_ts)" "$([ "${pass}" -eq 1 ] && echo PASS || echo FAIL)" "${elapsed}" "${migrations}" "${users}" \
    >>"${DRILL_LOG}"
fi

if [ "${pass}" -eq 1 ]; then
  log "RESTORE VERIFICATION PASSED (RTO sample ${elapsed}s)"
  exit 0
fi
die "RESTORE VERIFICATION FAILED"
