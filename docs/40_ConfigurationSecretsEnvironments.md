# 40 — Configuration, Secrets & Environments (P7.1)

Operator reference for the environment ladder, the configuration platform, and secret management. Overview + folder tree: **[doc 39](39_ProductionInfrastructure.md)**. Configuration is the **single source of truth** — this document is how you feed it correctly per environment.

---

## 1. Environment guide

### The ladder

| `NODE_ENV`    | Purpose              | Protected? | Notes                                        |
| ------------- | -------------------- | ---------- | -------------------------------------------- |
| `development` | local dev            | no         | docker-compose infra; placeholder secrets OK |
| `test`        | CI / jest            | no         | ephemeral DB; placeholder secrets OK         |
| `qa`          | integration/QA       | **yes**    | real secrets required                        |
| `staging`     | pre-prod mirror      | **yes**    | real secrets; prod-like                      |
| `preview`     | ephemeral per-branch | **yes**    | real secrets; own URL/DSN                    |
| `production`  | live                 | **yes**    | + no localhost DSN, no pretty logs           |

**Protected tiers** (`qa`/`staging`/`preview`/`production`) fail boot on: dev-placeholder secrets (`minioadmin`, `dev-only-*`, `changeme`, …), identical JWT access/refresh secrets. `production` additionally rejects a localhost `DATABASE_URL` and `LOG_PRETTY=true`. This is `validateEnv` in `backend/src/config/env.schema.ts` (Zod, fail-fast, one aggregated error).

Selection is by the `NODE_ENV` process var only — no env files are baked into images. A **preview** environment is just `NODE_ENV=preview` with its own URLs/DSN/secrets injected by the pipeline.

### Environment variable reference

All variables are validated at boot. `backend/.env.example` is the canonical, commented copy. Grouped:

- **Runtime**: `NODE_ENV`, `PORT`, `LOG_LEVEL`, `LOG_PRETTY`, `LOG_SAMPLE_RATE`.
- **URLs / CORS**: `APP_URL`, `ADMIN_URL`, `API_URL` (first two form the CORS allowlist).
- **Build/deploy metadata (P7.1)**: `SERVICE_NAME`, `APP_VERSION`, `GIT_SHA`, `BUILD_TIME`, `BUILD_NUMBER`, `RELEASE_CHANNEL`, `DEPLOYED_AT`, `INSTANCE_ID` — injected by the image build/CD; surfaced by `/version` + `/admin/system/info` + log bindings.
- **Data stores**: `DATABASE_URL` (required), `DATABASE_REPLICA_URL` (replication seam), `REDIS_URL`, `DB_POOL_{MAX,MIN,IDLE_TIMEOUT_MS,CONN_TIMEOUT_MS}`.
- **Auth**: `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (min 32, required, must differ on protected tiers), `JWT_*_TTL`, `GOOGLE_CLIENT_ID/SECRET`.
- **Storage**: `S3_{ENDPOINT,REGION,BUCKET,ACCESS_KEY,SECRET_KEY}`, `CDN_URL`, `S3_SIGNED_URL_TTL_SECONDS`.
- **Mail**: `SMTP_URL`, `MAIL_FROM`.
- **Observability**: `SENTRY_DSN`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE`.
- **Ops toggles/guards**: `METRICS_TOKEN`, `RATE_LIMIT_ENABLED`, `WORKERS_ENABLED`, `SCHEDULER_ENABLED`, `TRUST_PROXY_HOPS`.
- **AI / payments**: provider keys (all optional; blank = subsystem inert).
- **Async (infra.config)**: `CRON_*`, `QUEUE_<NAME>_*`, `CACHE_TTL_*`, `RETENTION_*` (dynamic; documented in `.env.example`).

### Configuration versioning

`CONFIG_VERSION` (`deployment.config.ts`) versions the _env contract shape_. Bump it whenever a required var is added/renamed. `/admin/system/info.config.version` + `/health/config` expose it, and the config **fingerprint** (sha256 of non-secret config) detects drift between what shipped and what's running.

### Environment-specific feature flags

`feature_flags` rows carry `environment` (scope) and `rolloutPercentage`. `evaluateFeatureFlag` (`modules/settings/feature-flag-evaluator.ts`):

- `enabled=false` → off; `environment` ∈ {`all`, current} → passes scope; `rolloutPercentage` 1..99 → deterministic `fnv1a(key:subjectId) % 100` bucket (system-level gates with no subject pass on enabled+scope).
- Default (`all` / `0%`) is behaviourally identical to the legacy `enabled` check — a strict superset, no regression.

---

## 2. Configuration guide

- **Loader**: `@nestjs/config` `AppConfigModule` (`@Global`) runs `validateEnv`, then loads typed `registerAs` namespaces. Inject `ConfigType<typeof xConfig>` — never read `process.env` in business code.
- **Two layers**: (1) boot-time env config (immutable; restart to reload); (2) runtime DB-backed `SettingsService` + feature flags (Redis-cached, hot-reloaded via cache invalidation, **audited** via `AuditService`). Admins tune (2) through `/admin/settings` + `/admin/feature-flags`.
- **Config health**: `GET /health/config` (probe; `down` only when a required secret is missing/invalid on a protected tier) and `GET /admin/system/config-health` (full report: status, environment, fingerprint, per-secret presence/validity, issues). `ConfigInspectorService` is the authority and **never emits a value**.
- **Never hardcode**: secrets come from env/secret files only (CLAUDE.md rule 9).

---

## 3. Secret management guide

### Supplying secrets

1. **Env var** — simplest (compose `env_file`, CI env).
2. **Container secret file** — `FOO_FILE=/run/secrets/foo`. `load-secrets.ts` reads the file into `FOO` before validation. Docker Swarm/Compose `secrets:` and K8s projected volumes use this. An explicitly-set `FOO` always wins.
3. **Secrets directory** — `SECRETS_DIR=/run/secrets`; every file becomes `<FILENAME>=<contents>` (Docker/K8s default mount).

Resolution happens at first import (`bootstrap-secrets.ts`, before `instrument.ts`/Nest), so Sentry, `validateEnv`, and every namespace see resolved values. The `deployment.started` log line reports which secret **names** were loaded (never values).

### Secret catalogue & requirements

| Secret(s)                                                              | Requirement   | If absent                                    |
| ---------------------------------------------------------------------- | ------------- | -------------------------------------------- |
| `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_URL` | **always**    | boot aborts                                  |
| `S3_*`, `SMTP_URL`, `METRICS_TOKEN`                                    | **protected** | boot aborts on qa/staging/preview/production |
| Sentry, Google OAuth, AI provider keys, payment keys                   | optional      | that subsystem stays inert                   |

### Validation, health & rotation

- **Validation**: length/presence at boot; protected tiers reject placeholders + identical JWT secrets.
- **Health**: `/health/config` + `/admin/system/config-health` report presence/validity; the deep probe surfaces config status.
- **Rotation-ready**: file-mounted secrets + graceful shutdown + rolling deploy = swap a secret file and roll the fleet with no downtime. For **JWT rotation** without logging users out, run an overlap window (verify against both old and new refresh secrets, sign with new) per docs 13 §10 — the file-secret plumbing makes the swap operationally trivial; wire the dual-verify when you rotate.
- **Never exposed**: pino `redact` + Sentry `beforeSend` scrub secrets/PII from logs and events; the inspector returns booleans only.

### CI/CD & container secrets

- **CI/CD**: GitHub **Environment secrets** (`SSH_KEY`, `DATABASE_URL`, Sentry trio, optional `COSIGN_KEY`) — gated so forks/PRs can't read them; gitleaks scans every push.
- **Containers**: mount secrets as files (`*_FILE`/`SECRETS_DIR`) rather than plain env where the orchestrator supports it, to keep them out of `/proc/<pid>/environ`.

---

See **[doc 41](41_DeploymentBackupRecovery.md)** for how these are consumed during deploy/backup/DR, and **[doc 39](39_ProductionInfrastructure.md)** for the architecture overview.
