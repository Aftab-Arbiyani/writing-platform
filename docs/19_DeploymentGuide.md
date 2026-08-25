# 19 — Deployment Guide (Backend)

Operational guide for deploying the Qalam backend to production. Complements the
strategy in `15_DeploymentStrategy.md` (the "why") with the concrete "how" as of
Epic 12 (production hardening). Authoritative source of decisions: `00`.

## 1. Production architecture (Phase 1)

Single-VM topology (docs 15 §10). Everything is stateless except Postgres + Redis

- object storage.

```
                    ┌────────────────────────── VM / host ──────────────────────────┐
   Internet ──TLS──▶ nginx edge (443)      ┌───────────────────────────────┐         │
                    │  api.DOMAIN  ─────────▶ backend  (NestJS API           │         │
                    │  app.DOMAIN  ─static─┐ │           + in-process BullMQ  │         │
                    │  admin.DOMAIN ─static┤ │           workers)  :4000     │         │
                    └──────────────────────┘ └───┬───────────────┬──────────┘         │
                                                 │               │                    │
                                         ┌───────▼──────┐  ┌─────▼──────┐             │
                                         │ Postgres 16  │  │  Redis 7   │             │
                                         │ (data)       │  │ DB0 cache  │             │
                                         └──────────────┘  │ DB1 queues │             │
                                                           │ DB2 rate   │             │
   External managed:  S3/R2 (media) ◀──────────────────────┤ DB3 auth   │             │
                      SMTP (transactional mail) ◀───────────┴────────────┘             │
                    └──────────────────────────────────────────────────────────────────┘
```

- **One backend image** runs the HTTP API **and** the BullMQ workers in-process
  (`WORKERS_ENABLED=true`). Worker extraction to a separate node is a later
  packaging change (docs 15 §10) — set `WORKERS_ENABLED=false` on API nodes and
  run a worker-only node with it `true`; no code change.
- **Migrations run as an explicit deploy step, never at boot** (`synchronize:false`
  forever).
- **Object storage + SMTP are external** managed services in production.

## 2. Images

Built from the repo root; see `infrastructure/docker/backend.Dockerfile`
(3-stage: base → build → runtime, non-root `node` user, pnpm pinned via corepack,
`HEALTHCHECK` hitting `/health`).

```bash
docker build -f infrastructure/docker/backend.Dockerfile -t ghcr.io/qalam/qalam-backend:sha-<12> .
```

Tagging (docs 15 §2.3): immutable `sha-<12>` is the only deploy ref; `latest` is
banned in production. CI's `docker-build` job proves the image builds on every PR.

## 3. Environment configuration

Every variable is Zod-validated at boot (`src/config/env.schema.ts`) — a
misconfigured process dies immediately with one readable error. See
`backend/.env.example` for the full annotated list. Required (no default):
`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.

Production-relevant knobs (Epic 12):

| Variable                                | Purpose                 | Prod value                        |
| --------------------------------------- | ----------------------- | --------------------------------- |
| `NODE_ENV`                              | environment             | `production` (disables `/docs`)   |
| `SENTRY_DSN`                            | error reporting         | the backend project DSN           |
| `SENTRY_TRACES_SAMPLE_RATE`             | trace sampling          | `0.1`                             |
| `GIT_SHA` / `SENTRY_RELEASE`            | release correlation     | deploy sha                        |
| `METRICS_TOKEN`                         | `/metrics` bearer auth  | a strong random token             |
| `RATE_LIMIT_ENABLED`                    | global rate limiting    | `true`                            |
| `DB_POOL_MAX` / `_MIN`                  | PG pool                 | size vs `max_connections` ÷ nodes |
| `LOG_PRETTY`                            | pretty logs             | unset (raw JSON to stdout)        |
| `WORKERS_ENABLED` / `SCHEDULER_ENABLED` | in-process workers/cron | `true`                            |

**AI and payments credentials (AF1 / AF5).** Both subsystems are **credential-gated**: a provider
with no key is inert, and every one of these knobs is Zod-validated like the rest. They were absent
from `backend/.env.example` until 2026-08-25, which made them discoverable only by reading
`src/config/{ai,payments}.config.ts` (48 §3.22b, AI-4); the example file now carries both blocks with
which adapters actually ship.

| Variable group                                    | Purpose                                | Prod value                                     |
| ------------------------------------------------- | -------------------------------------- | ---------------------------------------------- |
| `OPENAI_*` / `ANTHROPIC_*` / `GOOGLE_AI_*`        | the three **shipped** AI adapters      | the vendor key for whichever you use           |
| `AI_DEFAULT_PROVIDER` / `AI_DEFAULT_MODEL`        | which provider serves an unnamed call  | a provider whose key is actually set           |
| `AI_DAILY_TOKEN_LIMIT` / `AI_MONTHLY_TOKEN_LIMIT` | platform token ceilings                | a real number — **`0` means unlimited**        |
| `AI_STUB_ENABLED`                                 | canned-passage provider                | `false` (test stacks only)                     |
| `STRIPE_*` / `APPLE_*` / `GOOGLE_PLAY_*`          | the three **shipped** payment adapters | credentials for the processors you settle with |
| `APPLE_USE_SANDBOX`                               | Apple receipt endpoint                 | `false` (the code default is `true`)           |
| `PAYMENTS_MANUAL_ENABLED`                         | settle with no processor               | `false` — it books uncollected revenue         |

> Monetization has a **second** gate that is not an env var: the `feature.payments.enabled` feature
> flag, admin-toggleable and dark by default. Credentials decide _which processor can settle_; the
> flag decides whether the platform is on at all. A stack with perfect Stripe keys and the flag down
> still refuses every checkout — and a graph read still answers 404 rather than 402 (48 §3.22c).

**Secrets** live in GitHub Environments (staging/production) and are injected as
the container's `env_file` — never committed, never inlined in compose.

## 4. Deploy (single VM, compose)

```bash
# 1. Pull the immutable image (or build on the host).
docker compose -f docker-compose.prod.yml --env-file .env.production pull

# 2. Run migrations FIRST, as an explicit step (expand→migrate→contract; docs 15 §5).
docker compose -f docker-compose.prod.yml --env-file .env.production \
  run --rm backend pnpm --filter backend migration:run

# 3. Roll the app (health-gated; compose restarts unhealthy containers).
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 4. Smoke test.
curl -fsS https://api.DOMAIN/health/ready
```

`docker-compose.prod.yml` sets restart policies (`unless-stopped`), per-service
resource limits, healthchecks, log rotation, `init: true` (PID-1 signal
forwarding), and `stop_grace_period: 45s` for the backend so graceful shutdown
completes.

## 5. Graceful shutdown

`main.ts` calls `app.enableShutdownHooks()`. On `SIGTERM` (docs 15 §6): readiness
flips, in-flight HTTP drains, BullMQ workers finish active jobs, then Postgres +
Redis connections close. `stop_grace_period: 45s` gives this room; a hard kill
before then risks dropping an in-flight publish/broadcast.

## 6. Health gating & probes

- Container/orchestrator liveness: `GET /health` (process-up only).
- Load-balancer readiness: `GET /health/ready` (Postgres + Redis + queues).
- Per-dependency triage: `/health/database`, `/health/redis`, `/health/storage`,
  `/health/queues`. Storage is **degraded-not-dead** — a storage outage does NOT
  fail `/health/ready` (reads still work).

See `20_Runbook.md` for the full health/metrics/monitoring reference.

## 7. Scaling path (docs 15 §10)

Stage 0 single node → Stage 1 vertical → Stage 2 PG read replicas → Stage 3
worker extraction (same image, `WORKERS_ENABLED=false` on API nodes + a
worker-only node). The app is already stateless, env-configured, non-root,
SIGTERM-graceful, and stdout-logging — k8s is a later packaging change, not a
rewrite.
