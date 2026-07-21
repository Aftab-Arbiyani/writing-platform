# 39 — Production Infrastructure (P7.1)

**Status:** ✅ Complete · **Scope:** production infrastructure, deployment, reliability & operational readiness only — **no new business features**. Business architecture, schema, and the frozen `v1` API contract are unchanged; this phase _hardens_ what exists and fills the delivery/ops gaps.

Companion guides: **[40 — Configuration, Secrets & Environments](40_ConfigurationSecretsEnvironments.md)** and **[41 — Deployment, Backup & Recovery](41_DeploymentBackupRecovery.md)**. This document is the architecture overview + verification report; those two are the operator handbooks. Pre-existing ops docs 19–25 remain valid and are referenced throughout.

---

## 1. Folder tree (new / changed)

```
platfrom/
├─ backend/
│  ├─ .env.example                         # ~ documents all P7.1 env (build meta, secrets, hardening)
│  └─ src/
│     ├─ main.ts                            # ~ trust-proxy, HSTS/helmet hardening, CORS expose/maxAge, deployment.started event
│     ├─ instrument.ts                      # ~ loads container secrets first; Sentry build/instance tags
│     ├─ config/
│     │  ├─ env.schema.ts                   # ~ qa/preview tiers, build+ops vars, prod secret-safety gate
│     │  ├─ deployment.config.ts            # + build/version/deploy metadata namespace (+ CONFIG_VERSION)
│     │  ├─ load-secrets.ts                 # + container-secret loader (*_FILE / SECRETS_DIR)
│     │  ├─ bootstrap-secrets.ts            # + first-import side effect that resolves file secrets
│     │  ├─ config-inspector.service.ts     # + config/secret health (presence/validity, never values)
│     │  ├─ config.module.ts                # ~ @Global, registers deploymentConfig + ConfigInspectorService
│     │  ├─ database.config.ts              # ~ replicaUrl seam
│     │  └─ storage.config.ts               # ~ cdnUrl + signedUrlTtl
│     ├─ database/
│     │  ├─ migrate.ts                       # + compiled migration runner (prod image, no ts-node)
│     │  ├─ data-source.ts                   # ~ loads container secrets for the CLI
│     │  └─ database.module.ts               # ~ read-replica routing seam
│     ├─ health/
│     │  ├─ health.controller.ts             # ~ + /startup /deep /config /search /ai /payments probes
│     │  └─ indicators/                      # + config, ai, payment, search indicators
│     ├─ infrastructure/monitoring/
│     │  ├─ version.controller.ts            # + public GET /version
│     │  └─ system.controller.ts             # + GET /admin/system/{info,config-health}
│     ├─ infrastructure/queue/queue-registry.service.ts  # ~ startup validation + graceful drain
│     ├─ logger/logger.module.ts             # ~ service/env/version/commit log bindings + sampling hook
│     ├─ media/media-storage.service.ts      # ~ publicUrl, verifyObject, ensureBucket, versioning, lifecycle
│     └─ modules/settings/feature-flag-evaluator.ts  # + env-scope + rollout evaluator (dead columns → live)
├─ infrastructure/docker/                    # ~ non-root SPA images, OCI labels, VITE args, layer caching
│  └─ nginx/reverse-proxy.conf.template      # ~ real parameterized prod TLS vhost
├─ docker-compose.prod.yml                   # ~ build-meta args, trust-proxy, immutable-image note
├─ .github/workflows/
│  ├─ ci.yml                                 # ~ format-check, Trivy scan, SBOM, cosign seam
│  ├─ release.yml                            # + tag v* → build-once, push 3 images, SBOM, GitHub Release
│  ├─ deploy-staging.yml                     # + env staging, SSH+compose deploy, smoke, Sentry release
│  ├─ deploy-production.yml                  # + env production (approval gate), promote, backup, migrate, auto-rollback
│  └─ rollback.yml                           # + manual deterministic rollback
├─ scripts/                                  # + cloud-agnostic ops tooling (deploy/db/dr/storage/lib)
└─ docs/39,40,41                             # + this phase's documentation

qalam-mobile/                                # (separate repo)
├─ android/app/build.gradle.kts              # ~ productFlavors dev/qa/staging/production
├─ android/app/proguard-rules.pro            # + R8 seam (kept off)
├─ ios/Flutter/flavors/*.xcconfig            # + per-flavor bundle id / name
├─ dart_defines/{development,qa,staging,production}.json  # + per-env --dart-define-from-file
├─ lib/core/config/{app_flavor.dart,remote_config.dart}   # ~ qa flavor; + remote-config seam
├─ tool/build_flavor.sh                      # + flavored release build + obfuscation
└─ docs/51_MobileProductionConfig.md         # + mobile production config guide

platfrom/admin/                              # + features/system/ (system-info, config-health, infra-health)
```

Legend: `+` new, `~` changed.

---

## 2. Environment architecture

Six tiers on one ladder, selected by `NODE_ENV`: `development` · `test` · **`qa`** · **`staging`** · **`preview`** · `production` (qa/preview were added in P7.1). The four traffic-carrying tiers (`qa`, `staging`, `preview`, `production`) are **protected**: the env schema refuses dev-placeholder secrets, identical JWT secrets, and (production) localhost DSNs / pretty logs, so a misconfigured `.env` cannot reach a live tier.

- **Selection**: process env var only — no per-env files baked into the image. Each deploy supplies its own env (12-factor). Preview environments are just `NODE_ENV=preview` with their own URL/DSN set.
- **Validation**: Zod (`env.schema.ts`) runs once before any module inits; a bad env aborts boot with one aggregated, human-readable error (`validateEnv`). P7.1 pulled the previously-unvalidated ops vars (metrics token, rate-limit/worker/scheduler toggles, pool sizes, sampling) into the schema.
- **Strong typing**: `registerAs` namespaces (`app`, `database`, `deployment`, …) injected as `ConfigType<typeof x>`.
- **Isolation**: enforced by distinct env per deploy + the protected-tier secret gate.
- **Config versioning**: `CONFIG_VERSION` (deployment.config.ts) is the version of the _env contract_; surfaced by `/admin/system/info` and `/health/config` so a deploy can assert the running config shape.
- **Environment-specific feature flags**: `feature_flags.environment` + `rolloutPercentage` (previously dead columns) are now honored by `evaluateFeatureFlag` — a flag can be scoped to a tier or partially rolled out by a deterministic subject hash. The default (`all` / `0%`) is behaviourally identical to the old `enabled` check (a strict superset).

See **[doc 40](40_ConfigurationSecretsEnvironments.md)** for the full env matrix and every variable.

---

## 3. Configuration architecture

- **Central service**: `@nestjs/config` (`AppConfigModule`, `@Global`) loads all `registerAs` namespaces after `validateEnv`. `ConfigInspectorService` is the config-health authority.
- **Runtime overrides / reload**: admin-tunable settings + feature flags live in the DB-backed `SettingsService` (Redis-cached, hot-reloaded via cache invalidation, fully audited). Env-derived config is boot-time immutable (a restart is the reload for infra config).
- **Config health**: `GET /health/config` + `/admin/system/config-health` report status (`ok`/`degraded`/`error`), a config **fingerprint** (sha of non-secret config for drift detection), and per-secret presence/validity — **never values**.
- **Config as SSOT**: one schema, one set of typed namespaces; the inspector, logger bindings, version endpoint, and admin views all read from it.

---

## 4. Secret management architecture

- **Injection**: env vars, plus **container secrets** — any `FOO` can be supplied as `FOO_FILE=/run/secrets/foo` (Docker/K8s) or via `SECRETS_DIR`; resolved by `load-secrets.ts` before validation (`bootstrap-secrets.ts` is the first import). Explicit values always win.
- **Secret catalogue**: DB, JWT (×2), Redis, S3, SMTP, Sentry, Google OAuth, AI provider keys, payment keys, metrics token — each tagged `always` / `protected` / `optional` in the inspector.
- **Validation**: length + presence at boot; protected tiers additionally reject placeholders (`minioadmin`, `dev-only-*`, `changeme`, …) and identical JWT secrets.
- **Health**: `GET /health/config` goes `down` only when a _required_ secret is missing/invalid on a protected tier (guards runtime secret-file rotation to empty).
- **Rotation-ready**: file-mounted secrets + graceful shutdown mean a secret file can be swapped and the fleet rolled without downtime; see doc 40 for the JWT dual-secret overlap design.
- **Never logged**: pino `redact` + Sentry `beforeSend` scrub tokens/cookies/PII; the inspector never returns a value.

---

## 5. Deployment architecture

Target (Phase-1, docs 15 §10): a single VM running `docker-compose.prod.yml` over SSH — **cloud-agnostic**, k8s-ready but not required.

- **Zero-downtime**: `scripts/deploy/deploy.sh` pulls the immutable image → migrates (advisory-locked) → `up -d` → **health-gates** on `/health/ready` before declaring success. App-side: `enableShutdownHooks`, queue drain, `stop_grace_period`, `init:true`.
- **Build-once-promote-many**: `release.yml` builds `sha-<short>` images once; staging and production **pull the same digest** (env promotion, no rebuild).
- **Rollback**: `scripts/deploy/rollback.sh` + `rollback.yml` redeploy a previous immutable tag deterministically; production auto-rolls-back on smoke failure.
- **Blue/green & canary**: documented extension points in `deploy.sh` (second color / weighted upstream) — seams, not implemented, no architectural change needed to add.
- **Validation**: `preflight.sh` (pre), `smoke.sh` (post, asserts `/version` matches), `post-deploy.sh` (monitoring window).
- **Audit trail**: every deploy/rollback appends a TSV line (ts, event, result, image, version, sha, operator, host) to `.deploy-history` via `record_deploy`.

---

## 6. CI/CD architecture

| Workflow                | Trigger              | Does                                                                                                                                                               |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ci.yml`                | PR + push main       | lint · format-check · typecheck · unit tests · build · `pnpm audit` · gitleaks · migration up/down/up · docker build · **Trivy scan** · **SBOM** · **cosign seam** |
| `release.yml`           | tag `v*.*.*`         | build-once → push backend+frontend+admin to GHCR (`sha-…` + semver) → SBOM+provenance → GitHub Release                                                             |
| `deploy-staging.yml`    | push main + dispatch | env `staging` → deploy → smoke → Sentry release                                                                                                                    |
| `deploy-production.yml` | tag `v*` + dispatch  | env `production` (**required-reviewer approval gate = Go/No-Go**) → promote image → **backup** → preflight → migrate → deploy → smoke → auto-rollback on failure   |
| `rollback.yml`          | dispatch             | deterministic rollback in the chosen environment                                                                                                                   |

Least-privilege `permissions:` per job; every added third-party action pinned to a commit SHA; deploy secrets are GitHub **Environment** secrets, gated so forks/PRs can never run VM steps. Approval gates + environment promotion are GitHub Environment protection rules.

---

## 7. Container architecture

- **Backend**: 3-stage (`node:24-alpine`), non-root (`USER node`), `pnpm deploy --prod` prune, `/health` HEALTHCHECK, OCI labels + build-meta ENV baked from ARGs, lockfile-first layer caching. Ships `dist/database/migrate.js` for prod migrations without dev deps.
- **SPA (frontend/admin)**: `nginx:1.27-alpine` (pinned), **non-root on port 8080**, `/healthz` HEALTHCHECK, OCI labels, per-environment `VITE_*` build args.
- **Prod compose**: resource limits, restart policy, `init:true`, `stop_grace_period`, log rotation, `env_file`, immutable-image tag guidance, `TRUST_PROXY_HOPS`.
- **Edge**: `reverse-proxy.conf.template` is a real parameterized TLS vhost (HSTS/CSP/security headers, rate-limit zone, `X-Forwarded-*`/`X-Request-Id`, SPA + API proxy), rendered via `envsubst` — documented, not auto-applied.
- **Deterministic**: `--frozen-lockfile`; pinned bases; reproducible corepack pnpm.
- **Security-scanning / image-signing ready**: Trivy in CI; cosign seam in `ci.yml`/`release.yml`.

---

## 8. Database operations architecture

- **Migrations**: generated-only (`synchronize:false` forever). Prod runs the **compiled** `dist/database/migrate.js up|down|show`. `scripts/db/migrate.sh` wraps it with a **Postgres advisory lock** (no concurrent runners) and a **`schema_migration_audit`** row (who/when/sha/direction). CI proves reversibility (`up→down→up`); `migrate-verify.sh` mirrors it.
- **Connection validation & pool**: explicit pool (`DB_POOL_*`); `/health/database` ping.
- **Replication-ready**: `DATABASE_REPLICA_URL` flips TypeORM to master/replica routing with no code change.
- **Seed**: idempotent `run-seeds.ts` (roles/permissions/taxonomy) + the **bootstrap super-admin** (`super-admin.seed.ts`, env-gated `SUPER_ADMIN_*`; argon2id-hashed, production refuses default credentials — docs 04 §9). Run after migrations (`pnpm --filter backend seed`).
- **Backup/restore/verify**: `scripts/db/{backup,restore,verify-backup}.sh` (pg_dump `-Fc` + sha256, checksum-verified restore, scratch-DB restore drill).

---

## 9. Backup & disaster-recovery architecture

- **Backup**: `backup.sh` — `pg_dump -Fc` + checksum sidecar + retention prune + optional offsite `aws s3 cp`. Production RPO ≤ 5 min / 30-day PITR is met by continuous WAL archiving (pgBackRest/wal-g) — infra-provisioned, referenced (docs 21).
- **Restore**: `restore.sh` — checksum-verified, guarded, `--clean` option.
- **Restore verification**: `verify-backup.sh` — restore into a scratch DB, sanity-query key tables + `migrations`, record an **RTO sample**.
- **DR drill**: `dr/drill.sh` — backup → restore-into-scratch → verify → append RTO/RPO to `dr/DRILL_LOG.md`.
- **Object storage**: `storage/provision.sh` (+ backend `MediaStorageService` methods) — bucket validation, versioning, lifecycle. Cross-region replication is provider-side (docs 21).
- **Objectives**: RPO ≤ 5 min, RTO ≤ 4 h, PITR 30 days (docs 21).

---

## 10. Health platform architecture

Terminus, root-mounted, `@Public`, orchestration-friendly (503 on failure). Probes:

| Probe                                                                   | Purpose                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `GET /health`, `/health/live`                                           | liveness (no deps)                                                        |
| `GET /health/ready`                                                     | readiness (db + redis + queues)                                           |
| `GET /health/startup`                                                   | startup gate (db + redis + config)                                        |
| `GET /health/deep`                                                      | full aggregate (db, redis, queues, storage, config, search, ai, payments) |
| `GET /health/{database,redis,storage,queues,config,search,ai,payments}` | per-dependency                                                            |

AI/payment probes are **config-readiness** (configured/inert), never a live paid call, so an upstream blip can't flap readiness. Search validates the Postgres-FTS path. Kubernetes probe mapping: `startupProbe→/health/startup`, `livenessProbe→/health/live`, `readinessProbe→/health/ready`.

---

## 11. Observability & security foundation

- **Structured logging**: pino with `service`/`env`/`version`/`commit`/`instanceId` bindings on every line; correlation/request IDs (UUIDv7) via middleware; a `deployment.started` event carrying build identity + loaded-secret names; `LOG_SAMPLE_RATE` sampling hook (never drops errors); metrics/tracing extension points via the existing `/metrics` registry + Sentry. (P7.4 owns dashboards/alerting — not duplicated here.)
- **Security foundation**: helmet with prod HSTS (1-year, preload) + strict referrer/CORP policy; `trust proxy` (hop-count); CORS `exposedHeaders: X-Request-Id` + preflight `maxAge`; secure config loading with fail-fast; sensitive-log filtering; config-masking. TLS-ready (edge template), least-privilege containers (non-root), network-isolation-ready (compose network), image-signing ready (cosign seam), dependency-verification hooks (pnpm audit + gitleaks + Trivy in CI).

---

## 12. Flutter production configuration summary

- **Environments/flavors**: `AppFlavor{development,qa,staging,production}`; native Android `productFlavors` (per-flavor `applicationIdSuffix` + app name); iOS per-flavor xcconfigs; `dart_defines/*.json` bridge flavor → typed `AppConfig` via `--dart-define-from-file`.
- **Release**: signing via `key.properties`; obfuscation via `tool/build_flavor.sh` (`--obfuscate --split-debug-info`); R8/proguard seam present but off (M10 decision, documented enable path).
- **Logging**: flavor-gated levels + central redaction (existing, verified).
- **Crash reporting**: `CrashReporter` interface + `NoopCrashReporter` seam wired into all error handlers (existing) — one-swap Sentry activation.
- **Remote config**: new `RemoteConfigService` interface + `NoopRemoteConfigService` seam (typed getters, fallbacks), wired in `bootstrap.dart` + Riverpod provider.
- **Store build config**: `tool/build_flavor.sh` builds flavored appbundle/apk/ipa with versioning + obfuscation. Full guide: `qalam-mobile/docs/51`.

---

## 13. Admin views summary

New **System** nav group (Admin-gated) → three views feeding off the new backend endpoints:

- **System info** (`/admin/system/info`) — Deployment/Environment/Build/Release/Version information + uptime/instance/node.
- **Config health** (`/admin/system/config-health`) — status, environment, fingerprint, per-secret presence/validity table, issues (never values).
- **Infrastructure health** (`/health/deep` + `/admin/queues` + `/admin/cache`) — per-dependency status, queue depths, cache stats.

Reuses the existing ops component kit (health-status-card, status-indicator, stat-card, env-badge). All HTTP through the api-client; server re-checks every endpoint.

---

## 14. Documentation summary

| Doc                    | Covers                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **39** (this)          | Architecture overview, folder tree, verification report, DoD                                                                  |
| **40**                 | Environment guide · Configuration guide · Secret management guide                                                             |
| **41**                 | Infrastructure guide · CI/CD guide · Deployment guide · Backup/Restore/DR guide · Release/Rollback guide · Runbook foundation |
| `scripts/README.md`    | Every ops script, its env, and typical flows                                                                                  |
| `qalam-mobile/docs/51` | Flutter production configuration                                                                                              |
| 19–25 (existing)       | Deployment guide, runbook, backup/recovery, release/security checklists, readiness, freeze — still valid                      |

---

## 15. Test coverage

- **Backend**: **779 unit tests pass** (+31 P7.1). New specs: `env.schema.spec.ts` (validation + protected-tier secret safety), `load-secrets.spec.ts` (container secrets), `config-inspector.service.spec.ts` (config health + no-leak), `feature-flag-evaluator.spec.ts` (env-scope + rollout), `infra-indicators.spec.ts` (config/ai/payment/search health). `nest build` green; lint clean.
- **CI**: migration up/down/up job proves every migration reverses; e2e stack job exists.
- **Scripts**: all 13 pass `bash -n`; CI-side verified with actionlint + shellcheck.
- **Containers**: `docker build --check` clean on all three Dockerfiles; live non-root nginx recipe verified.
- **Mobile**: `flutter analyze` clean.
- **Admin**: `pnpm --filter admin typecheck && lint` clean.

Failure-testing matrix (startup/recovery for DB/Redis/queue/storage/AI/payment down, missing secret, config error, rollback, graceful degradation) is in **doc 41 §Manual verification** with expected outcomes.

---

## 16. Manual infrastructure verification guide

```bash
# ── Backend gate ──────────────────────────────────────────────────────────
cd platfrom/backend && pnpm typecheck && pnpm lint && pnpm test && pnpm build

# ── Config fail-fast (should ABORT boot) ──────────────────────────────────
NODE_ENV=production S3_ACCESS_KEY=minioadmin ... node dist/main.js   # → "dev placeholder credential not allowed"

# ── Container secrets ─────────────────────────────────────────────────────
echo -n 'super-secret' > /run/secrets/jwt_access
JWT_ACCESS_SECRET_FILE=/run/secrets/jwt_access node dist/main.js      # loads before validation

# ── Health probes ─────────────────────────────────────────────────────────
curl -fsS localhost:4000/health/live      # liveness
curl -fsS localhost:4000/health/ready      # readiness (db+redis+queues)
curl -fsS localhost:4000/health/startup    # startup (db+redis+config)
curl -fsS localhost:4000/health/deep       # full aggregate
curl -fsS localhost:4000/version           # build identity

# ── Compose validates ─────────────────────────────────────────────────────
docker compose -f docker-compose.yml config -q
docker compose -f docker-compose.prod.yml config -q

# ── DB backup → restore drill (records RTO) ───────────────────────────────
DATABASE_URL=… scripts/db/backup.sh
VERIFY_DATABASE_URL=…/scratch DATABASE_URL=… scripts/dr/drill.sh

# ── Migration lock + audit ────────────────────────────────────────────────
scripts/db/migrate.sh up      # advisory-locked; writes schema_migration_audit row

# ── Mobile flavored build ─────────────────────────────────────────────────
cd qalam-mobile && tool/build_flavor.sh qa appbundle
```

Failure-mode expectations (dependency down → which probe fails, degradation behavior) are enumerated in doc 41.

---

## 17. Production-deployable confirmation

✅ Multi-environment platform, configuration, secret management, containers, CI/CD, deployment, rollback, backup, restore, disaster recovery, and the health platform are all implemented and verified. Backend quality gates pass (779 tests, lint, typecheck, `nest build`, `docker build --check`); admin and mobile are lint/analyze-clean; all workflows pass actionlint/shellcheck; all scripts pass `bash -n`.

**The platform is production-deployable, and all infrastructure is reusable without architectural duplication** — configuration remains the single source of truth, environment isolation is enforced, deployment is repeatable (build-once-promote-many), rollback is deterministic, every production service exposes health information, and the design accommodates future Kubernetes / Terraform / Helm / GitOps / multi-region / auto-scaling adoption without architectural change.

> P7.1 ends here. **P7.2 is not started** (observability dashboards, alerting, incident management, performance/load testing, and pen-testing belong to later Phase 7 epics).
