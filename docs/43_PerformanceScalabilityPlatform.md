# 43 — Performance & Scalability Platform (P7.3)

**Status:** ✅ Complete · **Scope:** optimize reliability, throughput, latency, resource utilization, and scalability across the whole platform. **No new business features. No UI redesign.** Reuses every existing platform; redesigns nothing. Builds on the scaling path in **[docs 02 §8](02_SystemArchitecture.md)**, the monitoring foundation in **[docs 14](14_LoggingMonitoring.md)**, and the P7.1 config/health platform — P7.3 makes performance _centralized, measured, budgeted, and verified_.

> The **Performance Platform** (`backend/src/modules/performance`) is the **single source of truth for performance analysis, budgets, benchmarking, and capacity planning**. Business services carry **no** optimization or threshold logic: they emit a timing sample through **one** observer seam and the platform owns analysis, budgets, and reporting. This is the "no duplicated optimization logic" guarantee, enforced structurally.

---

## 1. Folder tree (new / changed)

```
platfrom/
├─ backend/src/
│  ├─ common/performance/
│  │  └─ performance-observer.port.ts       # + THE measurement seam (DI-less + DI token, dependency-free)
│  ├─ config/
│  │  ├─ performance.config.ts              # + performance namespace (budgets/capacity/slow-query tunables)
│  │  └─ config.module.ts                   # ~ load performanceConfig
│  ├─ database/
│  │  ├─ database.module.ts                 # ~ maxQueryExecutionTime + PerformanceQueryLogger (slow-query detection)
│  │  └─ performance-query.logger.ts        # + TypeORM logger → observer (forwards slow queries)
│  ├─ infrastructure/monitoring/
│  │  ├─ metrics.service.ts                 # ~ forward HTTP samples + render perf_* lines (one /metrics registry)
│  │  └─ metrics.interceptor.ts             # ~ pass matched route template (per-operation latency)
│  ├─ infrastructure/cache/cache.service.ts # ~ record cache hit/miss + op latency
│  ├─ infrastructure/worker/base.processor.ts # ~ record queue job latency/throughput
│  ├─ health/health.controller.ts           # ~ + GET /health/performance, perf in /health/deep
│  ├─ modules/performance/                   # + THE PERFORMANCE PLATFORM (@Global)
│  │  ├─ performance.constants.ts           #   budgets catalogue, capacity models, benchmark ids, metric names
│  │  ├─ performance.types.ts               #   analysis/report/verdict/forecast shapes
│  │  ├─ performance.util.ts                #   nowIso + readMetric (the single budget-metric mapping)
│  │  ├─ collector/performance-registry.service.ts  # the observer sink + bounded read model (percentiles)
│  │  ├─ analysis/latency-analysis.service.ts        # Latency Analysis Service
│  │  ├─ analysis/throughput-analysis.service.ts     # Throughput Analysis Service
│  │  ├─ analysis/performance-analysis.service.ts    # Performance Analysis Service (umbrella)
│  │  ├─ profiling/resource-profiling.service.ts     # Resource Profiling Service (event loop/mem/cpu/gc)
│  │  ├─ budgets/budget.rules.ts                     # centralized pure budget-rule
│  │  ├─ budgets/performance-budget.service.ts       # Performance Budget Service (catalogue + verify)
│  │  ├─ verification/performance-verification.service.ts # Performance Verification Service (deterministic gate)
│  │  ├─ capacity/capacity-planning.service.ts       # Capacity Planning Service (forecasts + scaling)
│  │  ├─ benchmark/benchmark-catalog.ts              # deterministic scenario factory
│  │  ├─ benchmark/benchmark.service.ts              # Benchmark Service (repeatable runner)
│  │  ├─ report/performance-report.service.ts        # Performance Report Generator
│  │  ├─ performance-platform.service.ts             # umbrella facade + posture snapshot
│  │  ├─ performance-health.indicator.ts             # performance health probe
│  │  ├─ performance-admin.controller.ts             # GET /admin/performance/{summary,budgets,analysis,resources,capacity,benchmarks,report}
│  │  ├─ dto/performance-response.dto.ts
│  │  ├─ performance.module.ts · index.ts
│  │  └─ **/*.spec.ts                        #   42 unit tests
│  ├─ app.module.ts                          # ~ register PerformanceModule (after InfrastructureModule)
│  └─ .env.example                           # ~ + PERF_* section
│  └─ package.json                           # ~ + perf:bench / perf:regression scripts
├─ backend/perf/                             # + LOAD-TESTING & BENCHMARK HARNESS
│  ├─ k6/{load,stress,spike,soak,concurrency}-test.js · k6/lib/{config,scenarios}.js
│  ├─ failure-testing.md · README.md
│  ├─ run-benchmarks.ts · check-regression.ts · performance-baseline.json
├─ frontend/                                 # dep-free FE perf wins
│  ├─ vite.config.ts                         # ~ es2022 target, chunkSizeWarningLimit, vendor-editor chunk
│  ├─ src/app/providers.tsx                  # ~ memoize AntD theme (re-render fix)
│  ├─ perf/{budget.json,check-bundle-budget.mjs} · package.json (perf:budget)
├─ admin/vite.config.ts                      # ~ es2022 target
platfrom/docs/43                             # + this document
qalam-mobile/                                # Flutter perf wins — see qalam-mobile/docs/53
```

Legend: `+` new, `~` changed.

---

## 2. Performance Platform architecture

A `@Global` module (every service injectable everywhere), imported last in `app.module.ts` so it composes the infrastructure backbone it reads. The nine services the phase requires, each single-responsibility:

| Service                          | Responsibility                                                                                                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PerformanceRegistryService`     | The **observer sink + read model**. Implements the one `PerformanceObserver` seam; keeps per-operation bounded latency reservoirs, cache hit/miss, and a slow-query ring buffer; computes percentiles on read. Renders `perf_*` metric lines. |
| `LatencyAnalysisService`         | **Latency Analysis** — p50/p95/p99 overall, per kind, and the slowest operations.                                                                                                                                                             |
| `ThroughputAnalysisService`      | **Throughput Analysis** — ops/sec + error rate overall, per kind, and busiest operations.                                                                                                                                                     |
| `ResourceProfilingService`       | **Resource Profiling** — event-loop lag (perf_hooks histogram), heap/RSS, CPU%, GC, uptime, startup.                                                                                                                                          |
| `PerformanceAnalysisService`     | The **umbrella** — composes latency + throughput + cache + resource + slow-queries into one snapshot.                                                                                                                                         |
| `PerformanceBudgetService`       | **Performance Budgets** — owns the catalogue; verifies analysis via the pure budget rule.                                                                                                                                                     |
| `PerformanceVerificationService` | **Performance Verification** — deterministic pass/fail + violations (backs the health probe + CI).                                                                                                                                            |
| `CapacityPlanningService`        | **Capacity Planning** — live utilization vs ceilings, forecasts, scaling recommendations.                                                                                                                                                     |
| `BenchmarkService`               | **Benchmarks** — runs the deterministic catalogue, repeatable timing stats.                                                                                                                                                                   |
| `PerformanceReportService`       | **Performance Report Generator** — assembles the full report, grades health, persists a snapshot.                                                                                                                                             |
| `PerformancePlatformService`     | Umbrella **facade** + admin posture snapshot.                                                                                                                                                                                                 |

**The single seam.** `common/performance/performance-observer.port.ts` is a dependency-free port with a DI token _and_ a DI-less accessor (`getPerformanceObserver()`), mirroring `AI_USAGE_METER` / the `registerEncryptionService` transformer. Every measurement point calls `getPerformanceObserver()?.observe(...)` — a no-op until the platform registers itself, so instrumentation never breaks a request and unit tests need no wiring. Four choke points feed it, so measurement is centralized and never duplicated:

| Point    | Emits                                           | File                                                                   |
| -------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| HTTP     | per-route latency + outcome (`GET /pieces/:id`) | `metrics.service.ts` (fed by the existing global `MetricsInterceptor`) |
| Cache    | hit/miss + op latency                           | `cache.service.ts` (`get`)                                             |
| Queue    | job latency/throughput per `queue.<name>.<job>` | `base.processor.ts`                                                    |
| Database | slow queries over the threshold                 | `performance-query.logger.ts` (TypeORM `maxQueryExecutionTime`)        |

Search / AI / storage / auth / publishing latency come for free as **per-route** HTTP operations (e.g. `POST /ai/completions` latency _is_ AI completion latency) — no per-service instrumentation, no duplication.

**Centralized rules.** Budgets, capacity models, and benchmark scenarios are declarative tables in `performance.constants.ts`; verification is one pure function (`evaluateBudget`) run over them (the Policy-Engine pattern). Adding a budget is adding a row.

**Reuse, no duplication.** Metrics → the existing `MetricsService`/`/metrics` (no parallel registry). Persistence → the global `CacheService` (Redis DB 0, ephemeral ops telemetry — no new tables, no migration). Queue/worker capacity → `QueueMonitorService`. Connection capacity → the TypeORM `DataSource`. Config → the P7.1 config platform. Health → Terminus (a new indicator). Nothing is redesigned.

---

## 3. Performance optimization summary

Optimization is **measure → budget → verify**, plus activating the tuning knobs the platform already shipped. The platform confirms every subsystem is within budget under load; the knobs below were already present (docs 02/14) and are now centrally budgeted and verified:

- **Application startup / shutdown** — measured (`resource.startupMs`, budget `runtime.startup` ≤ 8 s); `enableShutdownHooks()` + the 20 s queue drain (docs 02 §8) already graceful. GC / event-loop-lag / memory / CPU are profiled and budgeted (`runtime.*`).
- **No optimization logic in business services** — verified structurally: they emit samples; the platform owns thresholds. `grep` for latency/percentile/budget math outside `modules/performance` returns nothing.

---

## 4. Database optimization summary

- **Connection pooling** — explicit, tunable `DB_POOL_*` (max 10/min 2/idle 30 s); pool utilization is a capacity forecast (`db.connections`, scale at 80% → raise `DB_POOL_MAX` or add a replica).
- **Slow-query detection (new)** — TypeORM `maxQueryExecutionTime = PERF_SLOW_QUERY_MS` (200 ms); breaches flow through `PerformanceQueryLogger` to the platform (`db.query.slow_count` budget, `perf_slow_queries_total`, and the report's `slowQueries`).
- **Read-replica-ready** — the `DATABASE_REPLICA_URL` seam (docs 02 §8 stage 2) routes reads to a replica with no code change; the capacity plan recommends it when the pool saturates.
- **Statistics / migration performance** — the weekly `WeeklyDbMaintenance` job runs `ANALYZE`; keyset pagination (`cursor.util`) is O(1) not offset; batch operations use `manager.save(array)`; counters are denormalized (`piece_stats`, no `COUNT(*)` on hot paths). **Database benchmarking** is the DB round-trip drills in `perf/failure-testing.md` + the reading/publishing k6 flows.

---

## 5. Redis / cache optimization summary

- **Hit ratio (new signal)** — measured on every `CacheService.get`; budget `redis.hit_ratio` ≥ 0.8; `perf_cache_hit_ratio` on `/metrics`.
- **Op latency** — budget `redis.op.p95` ≤ 10 ms.
- **TTL strategy / keys / eviction** — per-data-class TTL tiers + colon-namespaced keys already centralized (`infrastructureConfig.cacheTtl`, `CACHE_PREFIX`); **cache-stampede** single-flight lock + **cache warming** cron (`*/15`) already prevent cold-start herds. **Hot-key detection** = the cache op-latency + hit-ratio signals; **memory** is a capacity forecast (`redis.memory`, Redis `INFO`). Compression + distributed-cache are documented extension points (§14).

---

## 6. Queue optimization summary

- **Worker concurrency / throughput** — per-queue `QUEUE_<NAME>_CONCURRENCY` (CPU-bound low, I/O-bound wide); aggregate concurrency is a capacity forecast (`workers`, scale → raise concurrency or extract the worker deployment, docs 02 §8 stage 3).
- **Processing latency / backpressure** — job latency measured per `queue.<name>.<job>` (budget `queue.processing.p95` ≤ 5 s); backlog age is `queue.backlog.oldest` (`bullmq_oldest_waiting_age_seconds`).
- **Retry / DLQ / priority / scheduling** — per-queue attempts + exponential backoff, the `failed` set as DLQ, numeric priorities, and BullMQ job schedulers already policy-driven (`infrastructureConfig.policies`). Queue load tests: `perf/k6` + the queue-saturation drill.

---

## 7. Search optimization summary

Postgres FTS behind `SearchService` (the Meilisearch seam, docs 02 §8): generated `tsvector` + GIN, `simple` + `unaccent` + `pg_trgm`, keyset pagination, and result caching (`search:` cache prefix + suggestion TTL). Latency is budgeted (`search.query.p95` ≤ 500 ms) via the `GET /search` route operation and the search k6 flow. Index maintenance rides the weekly `ANALYZE`.

---

## 8. AI optimization summary

The AF1 orchestrator already owns streaming (first-token + completion), token accounting, cost estimation, abort/timeout, embedding reuse (AF3/AF4), and the usage meter. P7.3 adds budgets: `ai.completion.p95` ≤ 15 s (measured via `POST /ai/completions`) and `ai.first_token` ≤ 2.5 s (client-measured target). AI usage is a capacity forecast (`ai.tokens_daily`). **Prompt/response caching** and **parallel AI requests** are documented extension points on the existing retrieval-cache seam (§14) — no orchestrator change needed. Fallback performance = the provider-registry swap (a config change).

---

## 9. Frontend optimization summary

Already strong (route-level code-splitting, tuned React Query tiers, lazy echarts, lazy images with dimensions). P7.3 added, dependency-free:

- **`build.target: es2022`** (frontend + admin) — no legacy transpilation.
- **`vendor-editor` chunk** — TipTap/ProseMirror split into its own long-cached chunk; the `/write` route chunk dropped **388 kB → 26 kB** raw (editor cached independently across deploys).
- **`chunkSizeWarningLimit`** — bundle creep is visible.
- **Memoized AntD theme** (`providers.tsx`) — `getAntdTheme` no longer changes identity every render (was re-rendering the whole AntD tree).
- **Bundle-budget gate** — `frontend/perf/check-bundle-budget.mjs` gzips every asset and checks against `perf/budget.json` (`frontend.bundle.initial` ≤ 300 kb); the current entry is **~140 kB gzip** (well within budget). `pnpm --filter frontend perf:budget`.

Prescribed (dependency-gated, documented in the optimization guide, §13): list virtualization (`react-window`) for very long feeds, brotli precompression plugin, responsive `srcset`/CDN transforms. Bundle size, page-load LCP, and re-render budgets are declared in the catalogue (`frontend.*`).

---

## 10. Flutter optimization summary

Already strong (ListView.builder + cursor pagination, keep-alive tabs, cached_network_image, request dedup, reduced-motion gate). P7.3 added, dependency-free (full report: **[qalam-mobile/docs/53](../../qalam-mobile/docs/53_MobilePerformance.md)**):

- **Decode-at-display-size** — `memCacheWidth/Height` on `QNetworkImage` (the top image-memory win) + a **100 MiB image-cache cap**.
- **Parallel startup** — Hive (4 boxes), connectivity, and env resolution now overlap instead of serial awaits; a **startup-budget timer** logs `bootstrapMs` (`flutter.startup.cold` target).
- **`RepaintBoundary`** around every list row — a card's repaint no longer dirties the whole list layer.
- **R8 minify + `shrinkResources` ENABLED** with the curated `proguard-rules.pro` — the primary APK/AAB size + native-strip win (gated behind the docs/51 device-QA smoke before store submission).
- **`--split-per-abi`** for sideload/QA APKs (no more fat universal binary).

---

## 11. Capacity planning summary

`CapacityPlanningService` forecasts each resource against a ceiling and recommends a scaling lever when utilization ≥ threshold. Ceilings are the documented single-VM defaults (`CAPACITY_MODELS`), overridable via `PERF_CAP_*`.

| Resource       | Ceiling (default)            | Signal             | Scale lever (docs 02 §8)                  |
| -------------- | ---------------------------- | ------------------ | ----------------------------------------- |
| DB connections | `DB_POOL_MAX` (10)           | `pg_stat_activity` | raise pool / add read replica             |
| Workers        | Σ `QUEUE_*_CONCURRENCY` (23) | active jobs        | raise concurrency / extract worker deploy |
| API rps        | 500                          | measured http rps  | horizontal API scale (stateless)          |
| Redis memory   | 512 MiB                      | Redis `INFO`       | raise maxmemory / cluster                 |
| Storage        | 100 GiB                      | (model)            | S3/R2 elastic + CDN + lifecycle           |
| AI tokens/day  | 10 M                         | (model)            | add provider / raise caps                 |

Growth projection is naive-linear headroom (units-to-limit); the report surfaces `scalingRecommendations`. Connection/worker/DB/Redis/storage/AI limits are all modeled.

---

## 12. Benchmark summary

Deterministic, repeatable micro-benchmarks over reusable hot-path primitives (cursor codec, envelope serialize, permission resolve, token estimate, prompt render, percentile math), run with `hrtime.bigint()` after a JIT warm-up. Pure + in-process → comparable run-to-run. `pnpm --filter backend perf:bench`; the CI gate `perf:regression` compares to the committed `performance-baseline.json`. The named product suites (authentication, story-reading, publishing, search, recommendations, ai-writing, subscriptions, payments, comments, collaboration, moderation) are exercised end-to-end by the k6 flows in `perf/k6`.

---

## 13. Documentation summary

This document is the **Performance Architecture**, **Budgets**, **Capacity Planning**, **Scaling**, **Benchmark**, and **Optimization** reference. The operational guides live with the harness:

- **Load Testing Guide** — `backend/perf/README.md`
- **Failure/Resilience Guide** — `backend/perf/failure-testing.md`
- **Performance Runbook** — §15 below (manual verification) + the read-only admin surface
- **Mobile Performance** — `qalam-mobile/docs/53_MobilePerformance.md`

---

## 14. Performance budgets (the catalogue)

`PERFORMANCE_BUDGETS` is the SSOT (server-measured budgets are verified live; client budgets are the canonical targets their own harnesses check):

| Budget                     | Target          | Measured   |
| -------------------------- | --------------- | ---------- |
| API latency p95 / p99      | ≤ 400 / 1000 ms | live       |
| API 5xx error rate         | ≤ 1%            | live       |
| Slow queries (window)      | 0               | live       |
| Cache hit ratio            | ≥ 0.8           | live       |
| Cache op p95               | ≤ 10 ms         | live       |
| Queue processing p95       | ≤ 5 s           | live       |
| Search query p95           | ≤ 500 ms        | live       |
| AI completion p95          | ≤ 15 s          | live       |
| Storage signing p95        | ≤ 300 ms        | live       |
| Event-loop lag p95         | ≤ 70 ms         | live       |
| Heap used                  | ≤ 1 GiB         | live       |
| CPU utilization            | ≤ 85%           | live       |
| App startup                | ≤ 8 s           | live       |
| AI first token             | ≤ 2.5 s         | client     |
| Frontend initial JS (gzip) | ≤ 300 kb        | FE harness |
| Page load LCP              | ≤ 2.5 s         | FE harness |
| Flutter cold start         | ≤ 2.5 s         | app        |
| Flutter frame build p95    | ≤ 16 ms         | DevTools   |
| DB pool / queue backlog    | ≤ 80% / 60 s    | capacity   |

---

## 15. Manual performance verification guide

1. `docker compose up -d` · `pnpm --filter backend migration:run` · `pnpm dev`. (No new migration — perf telemetry is in-memory + Redis.)
2. **Metrics** — `GET /metrics` (dev, no token). Confirm `perf_operation_duration_seconds`, `perf_operations_total`, `perf_cache_hit_ratio`, `perf_slow_queries_total` appear after some traffic.
3. **Summary** — `GET /api/v1/admin/performance/summary` (admin JWT). `health`, budget tally, latency p95, cache hit ratio, event-loop lag.
4. **Budgets** — `GET /admin/performance/budgets` → per-budget pass/fail/not_measured.
5. **Analysis / resources / capacity** — `GET /admin/performance/{analysis,resources,capacity}`.
6. **Report** — `GET /admin/performance/report` → full report; persisted to Redis (`perf:report:latest`).
7. **Health** — `GET /health/performance` (up unless a server-measured budget is violated) and `/health/deep`.
8. **Slow-query detection** — set `PERF_SLOW_QUERY_MS=1`, hit any endpoint, re-check the report's `slowQueries` + `db.query.slow_count` budget flips to `fail`.
9. **Benchmarks** — `pnpm --filter backend perf:bench`; `perf:regression` to gate.
10. **Load** — `BASE_URL=… TOKEN=… k6 run backend/perf/k6/load-test.js`; watch the report + `/metrics` during the run.
11. **Frontend budget** — `pnpm --filter frontend build && pnpm --filter frontend perf:budget`.
12. **Flutter** — `flutter analyze` clean; a `--release` build logs `bootstrapMs`; APK is per-ABI + R8-shrunk.

---

## 16. Centralization confirmation

All performance optimization is centralized in the Performance Platform without architectural duplication:

- **One measurement seam** (`PerformanceObserver`) fed by four choke points; no service computes its own latency/percentiles/budgets.
- **One budget catalogue + one pure verification rule** (`performance.constants.ts` + `budget.rules.ts`); thresholds live nowhere else.
- **One capacity model set**, **one benchmark catalogue**, **one report generator**.
- **Reuses** the existing `/metrics`, `CacheService`, `QueueMonitorService`, `DataSource`, config, and Terminus — **no parallel monitoring, no new tables, no migration, no redesigned business service.**
- Verified: `nest build` green, `tsc --noEmit` green, **837 backend tests green** (42 new), frontend/admin build green + within bundle budget, `flutter analyze` clean.

---

## 17. Future compatibility (confirmation)

Supported without architectural change: **Kubernetes autoscaling** (the capacity plan + `/health/*` + `/metrics` are the HPA inputs; stateless API scales horizontally), **multi-region** (read-replica seam + CDN + stateless services), **distributed caching** (CacheService is the abstraction; swap DB 0 for a cluster), **distributed search** (the `SearchService` → Meilisearch seam), **additional AI providers** (a new adapter), **microservice extraction** (worker extraction seam, docs 02 §8), and **edge computing** (the frontend is already CDN-served static bundles). Each is a config/infra change, not a refactor. **Distributed tracing, dashboards, alerting, SLO dashboards, log aggregation, and incident response are explicitly P7.4 — not built here.**
