#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/db/restore.sh — restore a pg_dump (-Fc) into a target database
#
#   restore.sh <dump-file> [--clean]
#
# Steps:
#   1. verify the dump's .sha256 sidecar (integrity) before touching the DB
#   2. confirm() — restore is DESTRUCTIVE to the target
#   3. pg_restore into RESTORE_DATABASE_URL (falls back to DATABASE_URL)
#
# --clean  → pg_restore --clean --if-exists (drop objects before recreating).
#            Without it, restore into a freshly-created empty database.
#
# Config (env):
#   RESTORE_DATABASE_URL    target DSN (preferred)   (default: $DATABASE_URL)
#   DATABASE_URL            fallback target DSN
#   PGRESTORE_JOBS          parallel restore jobs    (default: 1)
#   SKIP_CHECKSUM=1         skip sidecar verification (discouraged)
#   ASSUME_YES=1            skip the confirmation prompt
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "${SCRIPT_DIR}/../lib/common.sh"

PGRESTORE_JOBS="${PGRESTORE_JOBS:-1}"
SKIP_CHECKSUM="${SKIP_CHECKSUM:-0}"

usage() {
  cat <<'EOF'
restore.sh — verify checksum, then pg_restore a -Fc dump into the target DB.

Usage: restore.sh <dump-file> [--clean] [--help]

Key env: RESTORE_DATABASE_URL (or DATABASE_URL), PGRESTORE_JOBS,
         SKIP_CHECKSUM=1, ASSUME_YES=1.
EOF
}

DUMP=""
CLEAN=0
for a in "$@"; do
  case "${a}" in
    -h | --help) usage; exit 0 ;;
    --clean) CLEAN=1 ;;
    -*) die "unknown flag: ${a}" ;;
    *) DUMP="${a}" ;;
  esac
done

require_cmd pg_restore
[ -n "${DUMP}" ] || { usage; die "a dump file argument is required"; }
[ -f "${DUMP}" ] || die "dump file not found: ${DUMP}"

TARGET_DSN="${RESTORE_DATABASE_URL:-${DATABASE_URL:-}}"
[ -n "${TARGET_DSN}" ] || die "no target DSN — set RESTORE_DATABASE_URL or DATABASE_URL"

sha256_of() {
  if has_cmd sha256sum; then sha256sum "$1" | awk '{print $1}';
  elif has_cmd shasum; then shasum -a 256 "$1" | awk '{print $1}';
  else die "no sha256 tool found (need sha256sum or shasum)"; fi
}

# ── 1. checksum verification ─────────────────────────────────────────────────
SIDECAR="${DUMP}.sha256"
if [ "${SKIP_CHECKSUM}" = "1" ]; then
  warn "SKIP_CHECKSUM=1 — not verifying dump integrity"
elif [ -f "${SIDECAR}" ]; then
  want="$(awk '{print $1}' "${SIDECAR}")"
  got="$(sha256_of "${DUMP}")"
  if [ "${want}" = "${got}" ]; then
    log "checksum OK: ${got}"
  else
    die "checksum MISMATCH — dump may be corrupt (want ${want}, got ${got})"
  fi
else
  warn "no checksum sidecar at ${SIDECAR} — cannot verify integrity (set SKIP_CHECKSUM=1 to bypass this warning)"
fi

# ── 2. confirm (destructive) ─────────────────────────────────────────────────
mode="into existing DB (append)"; [ "${CLEAN}" -eq 1 ] && mode="with --clean (DROP + recreate objects)"
warn "about to restore '${DUMP}' into $(redact_dsn "${TARGET_DSN}") ${mode}"
confirm "This OVERWRITES data in the target database. Proceed?" || die "restore aborted by operator"

# ── 3. restore ───────────────────────────────────────────────────────────────
restore_args=(--dbname="${TARGET_DSN}" --no-owner --no-acl --jobs="${PGRESTORE_JOBS}")
[ "${CLEAN}" -eq 1 ] && restore_args+=(--clean --if-exists)

log "restoring…"
# pg_restore may emit non-fatal warnings (e.g. missing roles); --exit-on-error
# is intentionally NOT set so a benign ACL notice doesn't abort a good restore.
pg_restore "${restore_args[@]}" "${DUMP}"
log "restore complete into $(redact_dsn "${TARGET_DSN}")"
