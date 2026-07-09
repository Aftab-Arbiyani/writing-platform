# Infrastructure module — Asynchronous Processing (Epic 11)

The async backbone: BullMQ queues, in-process workers, cron scheduling, Redis caching, and
admin monitoring. Business modules **publish jobs only** (through the `JobEnqueuer` port);
workers **process** them. The dependency arrow is one-way — infrastructure imports business
modules to reach their exported services; **business modules never import infrastructure**
(they depend only on the `common/queue` port + name catalogue).

See `docs/00 → E11 build amendment` for the architectural decision record.

**Job model.** The queue/job vocabulary and the **typed job contract** live in `common/queue`
(so producers can depend on it without importing infrastructure): `queue.constants.ts`
(`QUEUE` / `JOB` names), `job-payloads.ts` (`JobPayloads` payload-per-job + `JOB_QUEUE`
job→queue binding + `JOB_RETRY` per-job overrides), `job-handler.ts` (`JobHandler`/`JobRunner`),
`job-enqueuer.port.ts` (`enqueue<J>(job, data)` — type-checked payload, queue derived from job).
Each job is a handler class under `worker/handlers/` with a `zod` `validate` + a `handle`.

## 1. Folder structure

```
src/infrastructure/
├── infrastructure.module.ts      # @Global — composes everything; registers the 9 queues
├── queue/                        # QUEUE concern
│   ├── queue-registry.service.ts # resolves every Queue by name
│   ├── queue-producer.service.ts # the JOB_ENQUEUER impl (retry/backoff/priority + requestId)
│   ├── dead-letter.service.ts    # inspect / retry / discard failed jobs (the DLQ)
│   ├── queue-health.indicator.ts # Terminus readiness probe (per-queue depth)
│   └── worker-concurrency.ts     # per-queue concurrency (read at decorator eval time)
├── worker/                       # WORKER concern
│   ├── base.processor.ts         # per-queue dispatcher: job.* logging + dead-letter detection
│   ├── abstract-job-handler.ts   # base for job classes: validate → handle, wraps run()
│   ├── *.processor.ts            # one thin @Processor per queue — wires its handlers
│   └── handlers/                 # the typed job classes (validate + handle), grouped by queue
├── scheduler/
│   └── scheduler.service.ts      # SCHEDULER concern — repeatable cron via upsertJobScheduler
├── cache/                        # CACHE concern
│   ├── cache.service.ts          # read-through + stampede lock + invalidate + warm + stats
│   ├── cache-warmer.service.ts   # warms hot caches via each module's cached read path
│   └── cache.constants.ts
├── events/
│   └── event-bridge.service.ts   # DomainEventBus → cache-invalidation jobs
├── maintenance/
│   └── maintenance.service.ts    # token/notification/soft-delete cleanup + DB ANALYZE
└── monitoring/                   # MONITORING concern
    ├── admin-queue.controller.ts # GET /admin/queues, /admin/jobs; POST /admin/jobs/retry/:id
    ├── admin-cache.controller.ts # GET /admin/cache; POST /admin/cache/clear|warm
    └── queue-monitor.service.ts
```

## 2. Queue list (Redis DB 1)

| Queue               | Worker | Producer                               | Retry / notes                                         |
| ------------------- | ------ | -------------------------------------- | ----------------------------------------------------- |
| `scheduled-publish` | ✓      | scheduler (sweep) + `pieces` (delayed) | attempts 5, prio 1                                    |
| `notifications`     | ✓      | `notifications` broadcast              | attempts 5, concurrency 5                             |
| `media-processing`  | ✓      | `media` on upload                      | attempts 3, concurrency 2 (CPU-bound)                 |
| `analytics-rollup`  | ✓      | scheduler                              | attempts 3                                            |
| `trending-score`    | ✓      | scheduler + event bridge               | **attempts 1** (recompute next tick)                  |
| `emails`            | —      | —                                      | registered for parity; mail is synchronous in Phase 1 |
| `cache`             | ✓      | scheduler + event bridge               | attempts 3                                            |
| `maintenance`       | ✓      | scheduler                              | attempts 3, backoff 30 s                              |
| `ai`                | —      | —                                      | Phase-2 placeholder, no worker                        |

Defaults: exponential backoff from 5 s, keep last 100 completed / 1000 failed per queue (the
`failed` set is the dead-letter store). Everything is env-overridable — see `.env.example`.

## 3. Cron schedule (BullMQ job schedulers)

| Cadence          | Job                                          | Does                                            |
| ---------------- | -------------------------------------------- | ----------------------------------------------- |
| every minute     | `scheduled-publish/publish-due`              | publish scheduled pieces now due                |
| hourly           | `trending-score/trending-recompute`          | recompute + cache trending ranking              |
| hourly           | `analytics-rollup/analytics-hourly-snapshot` | refresh daily snapshot                          |
| daily 03:00      | `analytics-rollup/analytics-nightly-rollup`  | daily+weekly+monthly snapshots                  |
| daily 04:00      | `maintenance/daily-cleanup`                  | expired tokens, old notifications, soft-deletes |
| weekly Sun 05:00 | `maintenance/weekly-db-maintenance`          | `ANALYZE` + VACUUM recommendations              |
| weekly Sun 05:30 | `cache/cache-optimize`                       | cache-size snapshot for tuning                  |
| every 15 min     | `cache/cache-warm`                           | warm hot caches (anti cold-start stampede)      |

## 4. Cache strategy (`CacheService`, Redis DB 0)

- **Read-through** — `wrap(key, ttl, compute)`.
- **Write-invalidate** — `del` / `delByPrefix`, plus event-driven invalidation on publish/archive.
- **Manual + automatic refresh** — `POST /admin/cache/warm` and the 15-min warm cron.
- **Stampede prevention** — `wrap` takes a single-flight Redis lock (`SET NX`); concurrent
  cold-key readers wait for the fill instead of all recomputing.
- **Safe clear** — a full flush hits DB 0 only (cache), never the queues (DB 1).

## 5. Monitoring APIs (`/api/v1/admin/*`, PBAC; documented in Swagger `/docs`)

| Method + path                                | Permission        | Purpose                                                 |
| -------------------------------------------- | ----------------- | ------------------------------------------------------- |
| `GET /admin/queues`                          | `admin.dashboard` | all queues: depth-by-state, oldest-waiting age, workers |
| `GET /admin/queues/:name`                    | `admin.dashboard` | one queue's status                                      |
| `GET /admin/jobs?queue=&state=&page=&limit=` | `admin.dashboard` | paginated job inspection                                |
| `POST /admin/jobs/retry/:id?queue=`          | `system.manage`   | replay a dead-lettered job                              |
| `GET /admin/cache`                           | `admin.dashboard` | key counts by prefix, memory, warmable groups           |
| `POST /admin/cache/clear`                    | `system.manage`   | clear a prefix, or flush the cache DB                   |
| `POST /admin/cache/warm`                     | `system.manage`   | warm one group or all                                   |

## 6. Test coverage

`jest src/infrastructure` — unit tests across producer (typed enqueue + per-job retry merge),
cache (incl. stampede), base-processor (dispatch + validation dead-letter + retry), job handlers
(validation → `UnrecoverableError`), dead-letter, queue monitor, scheduler (cron registration +
failure isolation), cache warmer, event bridge, maintenance; plus `notifications-broadcast.spec.ts`
for the async fan-out path. Full backend suite: **272/272**.

## 7. Performance improvements

- Scheduled publishing, broadcast fan-out (unbounded), media re-encode, analytics rollup, and
  trending recompute all moved **off the request path** onto queues.
- Trending is materialized into cache by the recompute worker → reads hit a warm snapshot.
- Cache warming + stampede lock eliminate cold-start recompute storms.
- Cleanup jobs bound table growth (tokens, notifications, soft-deletes) and keep planner stats
  fresh (`ANALYZE`).

## 8. Manual testing guide

```bash
# 0. Infra + build
docker compose up -d postgres redis
pnpm --filter backend migration:run
pnpm --filter backend build && node backend/dist/main.js   # or: pnpm --filter backend dev

# 1. Health — readiness now includes a per-queue depth snapshot
curl -s localhost:4000/health/ready | jq .data.info.queues

# 2. Admin APIs are default-deny (401 without a token)
curl -s -o /dev/null -w '%{http_code}\n' localhost:4000/api/v1/admin/queues   # → 401
#    With an admin/super-admin bearer token:
TOKEN=...   # access token for a user with admin.dashboard / system.manage
curl -s localhost:4000/api/v1/admin/queues            -H "Authorization: Bearer $TOKEN" | jq
curl -s 'localhost:4000/api/v1/admin/jobs?queue=scheduled-publish&state=completed' -H "Authorization: Bearer $TOKEN" | jq
curl -s localhost:4000/api/v1/admin/cache             -H "Authorization: Bearer $TOKEN" | jq
curl -s -XPOST localhost:4000/api/v1/admin/cache/warm -H "Authorization: Bearer $TOKEN" | jq

# 3. Cron fires + a worker runs (watch the log ~1 min for the every-minute sweep):
#    "job.completed queue=scheduled-publish job=publish-due ..."

# 4. Scheduled publishing end-to-end:
#    - schedule a piece for ~90 s in the future (POST /pieces/:id/schedule)
#    - within 60 s of the target it flips to published (delayed job + the sweep backstop)

# 5. Broadcast fan-out:
#    - POST /admin/system-notifications → returns immediately; the `notifications` worker
#      inserts one row per recipient (job.completed queue=notifications)

# 6. Inspect Redis:
docker exec qalam-redis-1 redis-cli -n 1 --scan --pattern 'qalam:queues*repeat*'  # schedulers
docker exec qalam-redis-1 redis-cli -n 0 dbsize                                    # cache keys

# 7. Retry / DLQ: a job that exhausts attempts lands in `failed`; replay it:
curl -s -XPOST 'localhost:4000/api/v1/admin/jobs/retry/<jobId>?queue=<queue>' -H "Authorization: Bearer $TOKEN"
```

Env toggles for testing: `WORKERS_ENABLED=false` (API-only node), `SCHEDULER_ENABLED=false`
(no cron), `CRON_*` to speed up a cadence, `QUEUE_<NAME>_CONCURRENCY` to tune a worker.
