# 41 — Deployment, Backup & Recovery (P7.1)

The operations handbook: infrastructure, CI/CD, deployment, rollback, backup, restore, disaster recovery, and the failure-mode runbook foundation. Architecture: **[doc 39](39_ProductionInfrastructure.md)**. Config/secrets: **[doc 40](40_ConfigurationSecretsEnvironments.md)**. Extends the existing ops docs 19 (deploy), 20 (runbook), 21 (backup/recovery), 22 (release/rollback checklists).

All commands assume the ops scripts in `scripts/` (see `scripts/README.md`). Every script reads config from env vars, never echoes secrets, and guards destructive ops (`ASSUME_YES=1` to automate).

---

## 1. Infrastructure guide

- **Runtime**: modular-monolith backend (NestJS) + in-process BullMQ workers, PostgreSQL 16, Redis 7, S3-compatible object storage, SPA frontend + admin behind nginx. Node 24, pnpm 9.12, turbo monorepo.
- **Images** (built by `release.yml`, pushed to GHCR): `qalam-backend` (non-root, `/health` healthcheck, migration runner baked in), `qalam-frontend` + `qalam-admin` (non-root nginx :8080, `/healthz`). All carry OCI + build-metadata labels; tags are immutable `sha-<short>` (+ semver for releases).
- **Compose**: `docker-compose.yml` (dev infra + `--profile full`), `docker-compose.prod.yml` (postgres + redis + backend; storage/SMTP external; resource limits, restart, log rotation, `init:true`, grace period).
- **Edge**: render `infrastructure/nginx/reverse-proxy.conf.template` with `envsubst` (TLS, HSTS, CSP, rate-limit, `X-Forwarded-*`/`X-Request-Id`, SPA + `/api` + `/health` proxy). Set `TRUST_PROXY_HOPS` on the backend to match the hop count.
- **Cloud-agnostic / future-ready**: single-VM compose today; the image/health/config/deploy contracts map cleanly onto Kubernetes (probes → `startupProbe`/`livenessProbe`/`readinessProbe`), Helm, Terraform, GitOps, multi-region, and auto-scaling with no architectural change.

---

## 2. CI/CD guide

- **`ci.yml`** (PR + push main): lint · `format:check` · typecheck · unit tests · build · `pnpm audit --prod` · gitleaks · migration `up→down→up` · docker build · **Trivy** image scan · **SBOM** (Syft) · **cosign** signing seam (inert until `COSIGN_KEY` set).
- **`release.yml`** (tag `v*.*.*`): build-once → push backend/frontend/admin to GHCR tagged `sha-<short>` **and** the semver → SBOM + provenance attestations → **GitHub Release** with auto notes. This is artifact publishing + release tagging + semantic versioning.
- **`deploy-staging.yml`** (push main + dispatch): Environment `staging` → deploy the `sha-…` image over SSH → smoke → Sentry release.
- **`deploy-production.yml`** (tag `v*` + dispatch): Environment `production` whose **required-reviewer rule is the manual approval / Go-No-Go gate** → promote the pre-built `sha-…` image (no rebuild) → pre-deploy backup → preflight → migrate → deploy → smoke (asserts `/version`) → **auto-rollback on failure**.
- **`rollback.yml`** (dispatch): deterministic rollback in the chosen environment.

Secrets are GitHub **Environment secrets** (`SSH_HOST/USER/KEY`, `DATABASE_URL`, Sentry trio, optional `COSIGN_KEY`), gated so forks/PRs never run VM steps. Added actions are SHA-pinned; permissions are least-privilege per job. **Environment promotion** = build-once in `release.yml`, promote the same digest to staging then production.

---

## 3. Deployment guide (zero-downtime)

What `deploy-*.yml` runs on the VM (also runnable by hand):

```bash
export BACKEND_IMAGE=ghcr.io/qalam/qalam-backend:sha-abc1234
export ENV_FILE=/opt/qalam/.env.production DATABASE_URL=…

scripts/deploy/preflight.sh      # env present, image resolvable, DB reachable, disk, current /version
scripts/db/backup.sh             # pre-deploy checkpoint (production)
scripts/db/migrate.sh up         # advisory-locked + audited migration (compiled runner)
scripts/deploy/deploy.sh         # pull → up -d → HEALTH-GATE on /health/ready
EXPECTED_VERSION=1.4.2 SMOKE_BASE_URL=https://api.example.com scripts/deploy/smoke.sh
scripts/deploy/post-deploy.sh    # short monitoring window; record success
```

- **Zero-downtime**: health-gated start (readiness must pass before old is stopped); app drains via `enableShutdownHooks` + queue drain + `stop_grace_period`.
- **Blue/green & canary**: extension points documented in `deploy.sh` (second color / weighted upstream) — add without architectural change.
- **Audit trail**: `.deploy-history` (ts, event, result, image, version, sha, operator, host).

---

## 4. Rollback guide (deterministic)

```bash
# Roll back to a known-good immutable image (production auto-does this on smoke failure).
ROLLBACK_IMAGE=ghcr.io/qalam/qalam-backend:sha-prev123 \
  EXPECTED_VERSION=1.4.1 scripts/deploy/rollback.sh
# or the pipeline: Actions → rollback.yml → {environment, image_tag, expected_version}
```

Rollback is deterministic because every deploy uses an **immutable** `sha-…` tag — rolling back = redeploying the previous digest + smoke. **Schema rollbacks**: prefer expand-contract so a code rollback needs no down-migration; if a migration must reverse, `scripts/db/migrate.sh down` reverts one step (advisory-locked + audited), or restore from the pre-deploy backup (§5). Rollback checklist: docs 22.

---

## 5. Backup, restore & disaster-recovery guide

**Objectives (docs 21):** RPO ≤ 5 min · RTO ≤ 4 h · PITR 30 days.

```bash
# Backup (pg_dump -Fc + sha256 sidecar + retention prune + optional offsite):
DATABASE_URL=… BACKUP_DIR=/var/backups/qalam BACKUP_S3_URI=s3://qalam-backups \
  scripts/db/backup.sh

# Restore (checksum-verified, guarded):
RESTORE_DATABASE_URL=… scripts/db/restore.sh /var/backups/qalam/qalam-prod-<ts>.dump --clean

# Restore VERIFICATION into a scratch DB (records an RTO sample):
VERIFY_DATABASE_URL=postgres://…/qalam_scratch scripts/db/verify-backup.sh

# Full DR DRILL (backup → restore-into-scratch → verify → log RTO/RPO):
DATABASE_URL=… VERIFY_DATABASE_URL=…/qalam_scratch scripts/dr/drill.sh   # → scripts/dr/DRILL_LOG.md

# Object storage recovery-readiness (versioning + lifecycle + bucket validation):
S3_BUCKET=qalam-media S3_ENDPOINT=… scripts/storage/provision.sh
```

- **Logical dumps** (above) are portable and power verification drills + dev/staging clones. **Production RPO/PITR** is met by continuous **WAL archiving** (pgBackRest/wal-g) to a separate bucket with separate credentials — infra-provisioned (docs 21 §3), rehearse PITR per docs 21 §3b.
- **Object-storage recovery**: bucket versioning (restore prior object versions) + provider cross-region replication.
- **Config/secrets recovery**: GitHub Environments + an offline sealed copy; `.env.example` is the recovery shape (docs 21 §5).
- **Redis**: intentionally not backed up (cache/queues are rebuildable/transient).
- Run `scripts/dr/drill.sh` monthly; each run appends a PASS/RTO row to `scripts/dr/DRILL_LOG.md`.

---

## 6. Release guide

1. Merge to `main` → `deploy-staging.yml` auto-deploys the `sha-…` build to staging; verify.
2. Complete the **release checklist** (docs 22): CI green, migrations validated, env/secrets present, config-health `ok`.
3. Tag `vX.Y.Z` (semver) → `release.yml` builds-once, pushes GHCR (`sha-…` + `vX.Y.Z`), attaches SBOM, cuts a GitHub Release.
4. `deploy-production.yml` fires on the tag and **waits for approval** (production Environment reviewers = Go/No-Go).
5. Approve → promote (same digest) → backup → migrate → deploy → smoke → Sentry release. Auto-rollback on smoke failure.

Release candidates: tag `vX.Y.Z-rc.N` and set `RELEASE_CHANNEL=rc` for the build. Release/build metadata (`APP_VERSION`, `GIT_SHA`, `BUILD_TIME`, `BUILD_NUMBER`, `RELEASE_CHANNEL`) is baked into the image and surfaced at `/version` + `/admin/system/info`.

---

## 7. Runbook foundation — failure modes

Verified startup/degradation behavior (P7.1 does **not** own alerting/dashboards — P7.4). For each, the table gives the signal and the expected platform response:

| Failure                                    | Signal                                                                        | Expected behavior                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Database down**                          | `/health/ready` + `/health/database` → 503                                    | instance pulled from rotation; liveness stays up (no restart loop); recover DB → readiness recovers |
| **Redis down**                             | `/health/ready` + `/health/redis` → 503                                       | pulled from rotation; recover → recovers                                                            |
| **Queue Redis down**                       | `/health/queues` down; `queue.startup.degraded` log                           | jobs not consumed; enqueue/monitor still respond; recover → drains                                  |
| **Storage down**                           | `/health/storage` down; `/health/ready` **stays UP**                          | degraded-not-dead: reads work, uploads fail gracefully                                              |
| **AI provider down/unconfigured**          | `/health/ai` `mode:inert`, never `down`                                       | AI features return `AI_DISABLED`/degrade; readiness unaffected                                      |
| **Payment provider down/unconfigured**     | `/health/payments` `mode:inert`                                               | billing endpoints degrade (deny); readiness unaffected                                              |
| **Search (FTS) broken**                    | `/health/search` down                                                         | search endpoints error; core app unaffected                                                         |
| **Config error / missing required secret** | boot aborts with one aggregated error; on a live tier `/health/config` → down | fail-fast — a misconfigured process never serves traffic                                            |
| **Secret missing (protected tier)**        | boot aborts (`… is required in "production"`)                                 | fail-fast                                                                                           |
| **Network partition (proxy ↔ backend)**    | edge 502/504; backend `/health/live` local-OK                                 | set `TRUST_PROXY_HOPS`; readiness governs LB rotation                                               |
| **Deployment failure**                     | smoke fails post-deploy                                                       | production auto-rollback to previous `sha-…`; manual `rollback.sh` otherwise                        |
| **Graceful degradation**                   | one optional subsystem down                                                   | core reading/writing continues; only the affected feature degrades                                  |

Recovery validation: after any recovery, run `scripts/deploy/smoke.sh` and confirm `/health/deep` is green. Record DR-drill RTO in `scripts/dr/DRILL_LOG.md`.

---

Deployment checklist → docs 19/22 · Rollback checklist → docs 22 · Backup/recovery detail → docs 21 · Security checklist → docs 23 · Readiness → docs 24.
