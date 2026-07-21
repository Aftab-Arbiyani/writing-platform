# Qalam Operations Scripts (P7.1)

Cloud-agnostic operational tooling for deployment, database operations, backup,
and disaster recovery. Every script is `bash`, `set -euo pipefail`, sources the
shared helpers in [`lib/common.sh`](lib/common.sh), takes all configuration from
**environment variables** (never secrets on the command line), and supports
`--help`. Destructive operations (`restore`, `rollback`) prompt for confirmation
unless `ASSUME_YES=1`.

These scripts are what the CD workflows (`.github/workflows/deploy-*.yml`,
`rollback.yml`) call; they also run standalone from an operator shell on the
deploy host.

## Layout

| Script                  | Purpose                                                                                                                                                       | Key env                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `lib/common.sh`         | Sourced helpers: logging, `require_cmd`, `confirm`, `load_env`, secret `mask`/`redact_dsn`, `retry`, `http_*`, `dc` (compose wrapper), `record_deploy` audit. | `ASSUME_YES`, `COMPOSE_FILE`, `ENV_FILE`, `DEPLOY_LOG`                 |
| `deploy/preflight.sh`   | Pre-deploy gate: required env present, image resolvable, DB reachable, disk, current `/version`.                                                              | `BACKEND_IMAGE`, `DATABASE_URL`                                        |
| `deploy/deploy.sh`      | Zero-downtime deploy: pull image → migrate → health-gated `up -d` → record audit. Blue/green + canary extension points documented inline.                     | `BACKEND_IMAGE`, `MIGRATE_CMD`                                         |
| `deploy/smoke.sh`       | Post-deploy verify: `/health/ready`, `/health/startup`, `/version`; asserts `EXPECTED_VERSION` when set.                                                      | `SMOKE_BASE_URL`, `EXPECTED_VERSION`                                   |
| `deploy/rollback.sh`    | Deterministic rollback to an immutable image tag; health-gate + smoke + audit.                                                                                | `ROLLBACK_IMAGE`                                                       |
| `deploy/post-deploy.sh` | Smoke + short monitoring window; records success.                                                                                                             | `SMOKE_BASE_URL`                                                       |
| `db/migrate.sh`         | Safe migration runner: Postgres **advisory lock** (no concurrent runners) + **`schema_migration_audit`** row (who/when/sha/direction) around `MIGRATE_CMD`.   | `DATABASE_URL`, `MIGRATE_CMD`, direction `up`/`down`                   |
| `db/migrate-verify.sh`  | Reversibility check `up → down → up` (mirrors CI).                                                                                                            | `DATABASE_URL`, `MIGRATE_CMD`                                          |
| `db/backup.sh`          | `pg_dump -Fc` + `.sha256` sidecar + retention prune + optional offsite `aws s3 cp`. Prints the dump path.                                                     | `DATABASE_URL`, `BACKUP_DIR`, `BACKUP_RETENTION_DAYS`, `BACKUP_S3_URI` |
| `db/restore.sh`         | Checksum-verified `pg_restore` into a target DB (guarded, `--clean` optional).                                                                                | `RESTORE_DATABASE_URL`/`DATABASE_URL`                                  |
| `db/verify-backup.sh`   | Restore a dump into a **scratch** DB, sanity-check, report **RTO** sample.                                                                                    | `VERIFY_DATABASE_URL`                                                  |
| `dr/drill.sh`           | DR rehearsal: backup → restore-into-scratch → verify → append RTO to `dr/DRILL_LOG.md`.                                                                       | `DATABASE_URL`, `VERIFY_DATABASE_URL`, `RTO_TARGET_SECONDS`            |
| `storage/provision.sh`  | Object storage hardening: validate bucket, enable versioning, apply lifecycle rules (S3/R2/MinIO via `aws s3api`).                                            | `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`                                |

## Typical flows

**Deploy (staging/production), what the CD workflow runs:**

```bash
export BACKEND_IMAGE=ghcr.io/qalam/qalam-backend:sha-abc1234
export ENV_FILE=/opt/qalam/.env.production DATABASE_URL=…
scripts/deploy/preflight.sh
scripts/db/backup.sh                       # pre-deploy checkpoint (prod)
scripts/deploy/deploy.sh                    # migrate + health-gated switch
pnpm --filter backend seed                  # idempotent seed (after migrations)
EXPECTED_VERSION=1.4.2 SMOKE_BASE_URL=https://api.example.com scripts/deploy/smoke.sh
```

> **Seeds** (`run-seeds.ts`) are idempotent and run **after** migrations: RBAC roles,
> PBAC permissions, taxonomy, and the **bootstrap super-admin**. The super-admin step is
> env-gated — set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD` in
> the env file **on the first production deploy** (in production it is skipped rather than
> creating a default-credential account; the password is argon2id-hashed and never logged).
> Re-running is safe — an existing super-admin only has its role ensured (docs 04 §9).

**Rollback (deterministic):**

```bash
ROLLBACK_IMAGE=ghcr.io/qalam/qalam-backend:sha-prev123 scripts/deploy/rollback.sh
```

**Backup + monthly restore drill:**

```bash
DATABASE_URL=… scripts/db/backup.sh
VERIFY_DATABASE_URL=postgres://…/qalam_scratch \
  DATABASE_URL=… scripts/dr/drill.sh          # records RTO in dr/DRILL_LOG.md
```

## Recovery objectives (docs 21)

- **RPO ≤ 5 min**, **RTO ≤ 4 h**, **PITR 30 days**.
- The logical `pg_dump` path here is portable and self-contained (verification
  drills, dev/staging clones). The production RPO/PITR target is met by
  **continuous WAL archiving** (pgBackRest/wal-g) to a separate bucket with
  separate credentials — infra-provisioned, out of scope for these scripts, but
  referenced so the recovery story is complete.

## Safety

- No secret value is ever echoed; DSNs pass through `redact_dsn`, tokens through `mask`.
- `restore.sh`/`rollback.sh` require an interactive `y/N` unless `ASSUME_YES=1`.
- `verify-backup.sh` refuses to run when `VERIFY_DATABASE_URL == DATABASE_URL`.
