#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/dr/drill.sh — disaster-recovery drill (P7.1)
#
# End-to-end rehearsal of the recovery path, recording RTO/RPO against the
# targets in docs 21 (RPO ≤ 5 min, RTO ≤ 4 h, 30-day PITR):
#   1. take a fresh logical backup                (backup.sh)
#   2. restore it into a scratch DB + sanity-check (verify-backup.sh)
#   3. append the measured RTO to scripts/dr/DRILL_LOG.md
#
# This exercises the LOGICAL-dump recovery path (portable, self-contained). The
# production RPO target is met by continuous WAL archiving (pgBackRest/wal-g),
# which is infra-provisioned; rehearse that separately per docs 21 §3b (PITR).
#
# Config (env):
#   DATABASE_URL          REQUIRED — source DB to back up
#   VERIFY_DATABASE_URL   REQUIRED — disposable scratch DB to restore into
#   BACKUP_DIR            (default: <repo>/backups)
#   RTO_TARGET_SECONDS    alert if the drill RTO exceeds this (default: 14400 = 4h)
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "${SCRIPT_DIR}/../lib/common.sh"

DRILL_LOG="${SCRIPT_DIR}/DRILL_LOG.md"
export DRILL_LOG
RTO_TARGET_SECONDS="${RTO_TARGET_SECONDS:-14400}"

usage() {
  cat <<'EOF'
drill.sh — backup → restore-into-scratch → verify, recording RTO/RPO.

Usage: DATABASE_URL=… VERIFY_DATABASE_URL=…/scratch drill.sh [--help]
EOF
}
case "${1:-}" in -h | --help) usage; exit 0 ;; esac

[ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL is required"
[ -n "${VERIFY_DATABASE_URL:-}" ] || die "VERIFY_DATABASE_URL (scratch DSN) is required"

log "=== DR DRILL START ==="
drill_start="$(date +%s)"

# 1. Backup (RPO proxy = age of this fresh dump ≈ 0 at drill time).
log "step 1/2 — taking a fresh backup"
DUMP="$(BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}" "${SCRIPT_DIR}/../db/backup.sh")"
log "backup produced: ${DUMP}"

# 2. Restore + verify (this is the timed recovery).
log "step 2/2 — restoring into scratch and verifying"
"${SCRIPT_DIR}/../db/verify-backup.sh" "${DUMP}"

drill_elapsed=$(( $(date +%s) - drill_start ))
result="PASS"
if [ "${drill_elapsed}" -gt "${RTO_TARGET_SECONDS}" ]; then
  warn "drill RTO ${drill_elapsed}s EXCEEDS target ${RTO_TARGET_SECONDS}s"
  result="SLOW"
fi

# 3. Record to the drill log (create with a header the first time).
if [ ! -f "${DRILL_LOG}" ]; then
  cat >"${DRILL_LOG}" <<'HDR'
# Disaster-Recovery Drill Log

Targets (docs 21): **RPO ≤ 5 min**, **RTO ≤ 4 h**, **PITR 30 days**.
Each row = one `scripts/dr/drill.sh` run (backup → restore-into-scratch → verify).

| Timestamp (UTC) | Result | RTO (s) | Dump |
| --------------- | ------ | ------- | ---- |
HDR
fi
printf '| %s | %s | %s | %s |\n' "$(_ts)" "${result}" "${drill_elapsed}" "$(basename "${DUMP}")" \
  >>"${DRILL_LOG}"

log "=== DR DRILL ${result} — RTO ${drill_elapsed}s (target ${RTO_TARGET_SECONDS}s) — logged to ${DRILL_LOG} ==="
[ "${result}" != "PASS" ] && exit 2
exit 0
