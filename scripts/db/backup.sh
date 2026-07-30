#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/db/backup.sh — Postgres logical backup (pg_dump custom format)
#
# Produces a portable, dependency-light base backup:
#   ${BACKUP_DIR}/qalam-<env>-<UTC-timestamp>.dump   (pg_dump -Fc)
#   + a .sha256 checksum sidecar (integrity for restore/verify)
# then prunes dumps older than BACKUP_RETENTION_DAYS and (optionally) uploads
# to BACKUP_S3_URI. Prints the backup path on stdout (only the path).
#
# NOTE ON RPO/PITR: these logical dumps are portable and good for verification
# drills and dev/staging clones, but the production RPO ≤ 5 min / 30-day PITR
# target (docs 21) is met by continuous WAL archiving via pgBackRest/wal-g to a
# SEPARATE bucket with separate credentials — that is infra-provisioned and out
# of scope here. Treat these dumps as a complementary, self-contained safety net.
#
# Config (env):
#   DATABASE_URL            REQUIRED — source DSN to dump
#   BACKUP_DIR              output dir            (default: <repo>/backups)
#   BACKUP_ENV              env label in filename (default: prod)
#   BACKUP_RETENTION_DAYS   prune older than N d  (default: 30)
#   PGDUMP_JOBS             parallel dump jobs     (default: 1; -Fc note below)
#   BACKUP_S3_URI           if set, `aws s3 cp` the dump + sidecar here (guarded)
#   AWS_ENDPOINT_URL        S3-compatible endpoint (R2/MinIO) passed to aws
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "${SCRIPT_DIR}/../lib/common.sh"

BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
BACKUP_ENV="${BACKUP_ENV:-prod}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
PGDUMP_JOBS="${PGDUMP_JOBS:-1}"
BACKUP_S3_URI="${BACKUP_S3_URI:-}"

usage() {
  cat <<'EOF'
backup.sh — pg_dump -Fc backup + sha256 sidecar + retention prune + optional S3.

Usage: DATABASE_URL=postgres://… backup.sh [--help]

Key env: DATABASE_URL (required), BACKUP_DIR, BACKUP_ENV, BACKUP_RETENTION_DAYS,
         BACKUP_S3_URI, AWS_ENDPOINT_URL. Prints the .dump path on stdout.
EOF
}
case "${1:-}" in -h | --help) usage; exit 0 ;; esac

require_cmd pg_dump
[ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL is required"

# checksum tool (Linux: sha256sum; macOS: shasum -a 256)
sha256_of() {
  if has_cmd sha256sum; then sha256sum "$1" | awk '{print $1}';
  elif has_cmd shasum; then shasum -a 256 "$1" | awk '{print $1}';
  else die "no sha256 tool found (need sha256sum or shasum)"; fi
}

mkdir -p "${BACKUP_DIR}"
STAMP="$(utc_stamp)"
DUMP="${BACKUP_DIR}/qalam-${BACKUP_ENV}-${STAMP}.dump"
SIDECAR="${DUMP}.sha256"

log "backing up $(redact_dsn "${DATABASE_URL}") -> ${DUMP}"
# -Fc = custom format (compressed, selective pg_restore). --no-owner/--no-acl
# keep the dump portable across roles when restoring into a scratch/clone DB.
if [ "${PGDUMP_JOBS}" -gt 1 ]; then
  warn "PGDUMP_JOBS>1 requested but -Fc is single-stream; ignoring (use -Fd for parallel)"
fi
pg_dump --format=custom --no-owner --no-acl --file="${DUMP}" "${DATABASE_URL}"

CKSUM="$(sha256_of "${DUMP}")"
printf '%s  %s\n' "${CKSUM}" "$(basename "${DUMP}")" >"${SIDECAR}"
SIZE="$(du -h "${DUMP}" | awk '{print $1}')"
log "backup complete: ${SIZE}, sha256=${CKSUM}"

# ── Retention prune ──────────────────────────────────────────────────────────
log "pruning backups older than ${BACKUP_RETENTION_DAYS} day(s) in ${BACKUP_DIR}"
pruned=0
while IFS= read -r old; do
  [ -n "${old}" ] || continue
  rm -f "${old}" "${old}.sha256"
  log "pruned ${old}"
  pruned=$((pruned + 1))
done < <(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "qalam-${BACKUP_ENV}-*.dump" \
  -mtime "+${BACKUP_RETENTION_DAYS}" 2>/dev/null)
log "pruned ${pruned} old backup(s)"

# ── Optional offsite upload ──────────────────────────────────────────────────
if [ -n "${BACKUP_S3_URI}" ]; then
  if has_cmd aws; then
    endpoint_args=()
    [ -n "${AWS_ENDPOINT_URL:-}" ] && endpoint_args=(--endpoint-url "${AWS_ENDPOINT_URL}")
    log "uploading to ${BACKUP_S3_URI%/}/"
    aws "${endpoint_args[@]}" s3 cp "${DUMP}" "${BACKUP_S3_URI%/}/$(basename "${DUMP}")"
    aws "${endpoint_args[@]}" s3 cp "${SIDECAR}" "${BACKUP_S3_URI%/}/$(basename "${SIDECAR}")"
    log "offsite upload complete"
  else
    warn "BACKUP_S3_URI set but 'aws' CLI not found — skipping upload (dump kept locally)"
  fi
fi

# stdout: the backup path (for scripting / drill.sh capture)
printf '%s\n' "${DUMP}"
