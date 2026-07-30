# 20 — Backend Runbook

On-call reference: how to observe the system, and how to respond to the incidents
that actually happen. Pairs with `14_LoggingMonitoring.md` (design) and
`21_BackupRecovery.md` (data recovery).

## 1. Observability at a glance

| Question                    | Where to look                                            |
| --------------------------- | -------------------------------------------------------- |
| "What did this request do?" | **Logs** (Pino JSON on stdout) — filter by `requestId`   |
| "Is the platform healthy?"  | **Health** endpoints + **`/metrics`**                    |
| "Why did this 500?"         | **Sentry** (grouped by release; tagged with `requestId`) |
| "Is a queue stuck?"         | `GET /api/v1/admin/queues` or `bullmq_*` metrics         |

**Correlation id.** Every request carries `X-Request-Id` (minted at the edge or
by `RequestIdMiddleware`), threaded into the log line, the error envelope
(`error.requestId`), the Sentry event tag, and any BullMQ job it enqueues. One id
joins client → API → worker → Sentry.

**Redaction.** `src/logger/redaction.ts` is the single source of truth
(tokens/passwords/cookies → `[REDACTED]`), applied in Pino and mirrored in the
Sentry `beforeSend`. Emails are never logged.

## 2. Health endpoints

| Endpoint               | Checks                         | Use                          |
| ---------------------- | ------------------------------ | ---------------------------- |
| `GET /health`          | process only                   | liveness / container restart |
| `GET /health/live`     | process only                   | k8s livenessProbe alias      |
| `GET /health/ready`    | Postgres + Redis + queues      | LB/readiness gate            |
| `GET /health/database` | Postgres `SELECT 1`            | triage                       |
| `GET /health/redis`    | Redis `PING`                   | triage                       |
| `GET /health/storage`  | S3 `HEAD` bucket               | triage (degraded-not-dead)   |
| `GET /health/queues`   | BullMQ Redis + per-queue depth | triage                       |

All are `@Public`, version-neutral (root path, no `/api`), and exempt from rate
limiting.

## 3. Metrics (`GET /metrics`)

Prometheus text format, token-gated (`METRICS_TOKEN`) + IP-allowlisted at the edge.
Key series (docs 14 §4.2 taxonomy):

- `http_requests_total{method,status}`, `http_errors_total`,
  `http_request_duration_seconds_{sum,count}`
- `bullmq_queue_depth{queue,state}` — **the backlog gauge**
- `bullmq_oldest_waiting_age_seconds{queue}` — **the stall detector** (low depth
  - rising age = a stuck queue)
- `bullmq_workers{queue}` — worker health
- `process_resident_memory_bytes`, `nodejs_heap_used_bytes`, `process_uptime_seconds`

`prom-client` + Prometheus/Grafana scraping is the Phase-1.5 rollout; the series
names are fixed now so dashboards are forward-compatible.

## 4. Admin operations APIs (`system.manage` / `admin.dashboard`)

- `GET /api/v1/admin/queues` — depth-by-state, oldest-waiting age, worker count.
- `GET /api/v1/admin/jobs?queue=&state=&page=&limit=` — inspect jobs.
- `POST /api/v1/admin/jobs/retry/:id?queue=` — replay a dead-lettered job.
- `GET /api/v1/admin/cache` — cache key counts / memory / warmable groups.
- `POST /api/v1/admin/cache/clear` (prefix or full flush) · `POST /admin/cache/warm`.

## 5. Common incidents

### Queue stuck / backlog growing

1. `GET /admin/queues` → find the queue with high `oldestWaitingAgeMs` or depth.
2. Check `GET /health/queues` and Redis (`/health/redis`) — is DB1 reachable?
3. Confirm workers are running (`bullmq_workers{queue}` > 0; `WORKERS_ENABLED=true`).
4. Failed jobs: `GET /admin/jobs?queue=X&state=failed`. Fix root cause, then
   `POST /admin/jobs/retry/:id?queue=X`. `job.dead_lettered` events are in Sentry.

### Scheduled publishing lag (a piece didn't publish on time)

- The every-minute sweep (`scheduled-publish/publish-due`) is the backstop; a
  delayed per-piece job fires at `publishAt`. Check the `scheduled-publish` queue
  for failed jobs and the sweep's `job.completed` logs. It re-verifies state at
  fire time, so an edited/unscheduled piece is a safe no-op.

### 5xx spike

- Sentry groups by release; open the newest issue, use its `requestId` tag to pull
  the matching log line. Roll back the image if it correlates with a deploy
  (`21_BackupRecovery.md` / `22_ReleaseChecklist.md` §rollback).

### Rate-limit false positives (429s)

- Global baseline is `apiDefault` 300/min per user-or-IP; tighter tiers on auth
  (5/min login), search (30/min), etc. Shared-NAT clients can collide on IP.
  Emergency valve: `RATE_LIMIT_ENABLED=false` (last resort — removes all limits).

### DB connections exhausted

- `DB_POOL_MAX` × instance count must stay under Postgres `max_connections`.
  Symptoms: connection-timeout errors, `/health/database` flapping. Lower
  `DB_POOL_MAX` or raise PG `max_connections`.

### Redis down

- `/health/ready` → 503 (DB1/DB2 gone → rate limiting + queues degrade).
  Cache (DB0) misses fall back to live compute (graceful). Restore Redis; queues
  resume from durable state (AOF enabled).

## 6. Cache operations

- Cache lives in Redis **DB0 only** — safe to flush without touching queues:
  `POST /admin/cache/clear` (no prefix = `FLUSHDB` on DB0).
- Warming runs every 15 min + on demand (`POST /admin/cache/warm`). Read-through
  with a single-flight stampede lock, so a cold key is recomputed once.

## 7. Log levels & retention

- Levels: `debug` (dev), `info` (prod default). 5xx log with stack; 4xx don't.
- `job.*` taxonomy: `job.started`(debug) → `job.completed`/`job.failed`(warn) →
  `job.dead_lettered`(error → Sentry).
- Container logs are JSON to stdout, rotated by the runtime (`max-size 10m`,
  `max-file 5`). App does no file writing.
