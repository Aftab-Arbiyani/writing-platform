#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# scripts/storage/provision.sh — object-storage provisioning (P7.1)
#
# Cloud-agnostic (S3 / R2 / MinIO) hardening of the media bucket:
#   • validate the bucket exists / is reachable        (Bucket Validation)
#   • enable object versioning                         (Object Versioning Ready)
#   • apply lifecycle rules: expire tmp/ (1d) + quarantine/ (7d), abort
#     incomplete multipart uploads (3d)                (Lifecycle Policies)
#
# Uses the AWS CLI (`aws s3api`) against S3_ENDPOINT — works with AWS S3,
# Cloudflare R2 and MinIO. The backend also exposes equivalent methods
# (MediaStorageService.ensureBucket/enableVersioning/applyLifecyclePolicy) for
# programmatic use; this script is the ops-side, no-app-boot path.
#
# Config (env):
#   S3_BUCKET        REQUIRED — bucket name
#   S3_ENDPOINT      S3-compatible endpoint (omit for real AWS)
#   S3_REGION        (default: us-east-1)
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   credentials (standard aws env)
#   SKIP_VERSIONING=1 / SKIP_LIFECYCLE=1        opt out of a step
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "${SCRIPT_DIR}/../lib/common.sh"

S3_REGION="${S3_REGION:-us-east-1}"

usage() {
  cat <<'EOF'
provision.sh — validate bucket, enable versioning, apply lifecycle rules.

Usage: S3_BUCKET=qalam-media [S3_ENDPOINT=…] provision.sh [--help]
Requires the `aws` CLI + standard AWS_* credentials. Idempotent.
EOF
}
case "${1:-}" in -h | --help) usage; exit 0 ;; esac

require_cmd aws
[ -n "${S3_BUCKET:-}" ] || die "S3_BUCKET is required"

# Endpoint arg is only added when S3_ENDPOINT is set (real AWS needs none).
ep_args=()
[ -n "${S3_ENDPOINT:-}" ] && ep_args=(--endpoint-url "${S3_ENDPOINT}")
awss3() { aws "${ep_args[@]}" --region "${S3_REGION}" "$@"; }

# ── 1. Bucket validation ─────────────────────────────────────────────────────
log "validating bucket '${S3_BUCKET}'"
if awss3 s3api head-bucket --bucket "${S3_BUCKET}" >/dev/null 2>&1; then
  log "bucket reachable"
else
  die "bucket '${S3_BUCKET}' not reachable/does not exist (create it via infra first)"
fi

# ── 2. Versioning ────────────────────────────────────────────────────────────
if [ "${SKIP_VERSIONING:-0}" = "1" ]; then
  warn "SKIP_VERSIONING=1 — leaving versioning unchanged"
else
  log "enabling bucket versioning"
  awss3 s3api put-bucket-versioning --bucket "${S3_BUCKET}" \
    --versioning-configuration Status=Enabled
  log "versioning enabled"
fi

# ── 3. Lifecycle rules ───────────────────────────────────────────────────────
if [ "${SKIP_LIFECYCLE:-0}" = "1" ]; then
  warn "SKIP_LIFECYCLE=1 — leaving lifecycle rules unchanged"
else
  log "applying lifecycle rules (tmp 1d, quarantine 7d, abort MPU 3d)"
  lc_json="$(mktemp)"
  trap 'rm -f "${lc_json}"' EXIT
  cat >"${lc_json}" <<'JSON'
{
  "Rules": [
    { "ID": "qalam-expire-tmp", "Status": "Enabled",
      "Filter": { "Prefix": "tmp/" }, "Expiration": { "Days": 1 } },
    { "ID": "qalam-expire-quarantine", "Status": "Enabled",
      "Filter": { "Prefix": "quarantine/" }, "Expiration": { "Days": 7 } },
    { "ID": "qalam-abort-incomplete-mpu", "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 3 } }
  ]
}
JSON
  awss3 s3api put-bucket-lifecycle-configuration --bucket "${S3_BUCKET}" \
    --lifecycle-configuration "file://${lc_json}"
  log "lifecycle rules applied"
fi

log "storage provisioning complete for '${S3_BUCKET}'"
