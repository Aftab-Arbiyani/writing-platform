# Failure & Resilience Testing (P7.3)

Verify the platform holds acceptable performance while a dependency is degraded —
the "performance under failure" matrix. These are **manual/CI fault-injection
drills**, not automated pass/fail gates (the platform is designed to _degrade_,
not stay fast, under fault). Watch `GET /admin/performance/report`,
`GET /health/deep`, and `/metrics` throughout each drill.

Tooling: [Toxiproxy](https://github.com/Shopify/toxiproxy) sits between the API
and each dependency to inject latency/failure without touching app code. Point
`DATABASE_URL` / `REDIS_URL` / `S3_ENDPOINT` at the proxy, then add toxics.

| Failure mode          | Inject                                                                 | Expected behaviour (graceful degradation)                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Database slowdown** | `toxiproxy latency` 500ms on the PG proxy                              | Slow-query detector fires (`perf_slow_queries_total` climbs, `/admin/performance/report.slowQueries` fills); reads queue on the pool; no data loss. Verify `db.query.slow_count` budget flips to `fail`. |
| **Redis slowdown**    | latency 300ms on the cache proxy                                       | `CacheService` degrades to the compute path (docs: "outage → falls back to compute"); hit-ratio drops; requests get slower but succeed. Rate limiter (DB 2) may loosen.                                  |
| **Queue saturation**  | pause workers (`WORKERS_ENABLED=false` on the worker node) + push jobs | Backlog grows; `bullmq_oldest_waiting_age_seconds` + `queue.backlog.oldest` budget breach; API stays responsive (writes are async). Recovers when workers resume.                                        |
| **AI latency**        | latency 10s on the AI-provider egress                                  | Orchestrator timeout (`AI_TIMEOUT`) fires at `requestTimeoutMs`; `ai.completion.p95` budget breach; non-AI paths unaffected (isolated).                                                                  |
| **Storage latency**   | latency 2s on the S3 proxy                                             | Signed-URL issuance slows (`storage.signing.p95` breach); reads/writes of content metadata unaffected (bytes never transit the API).                                                                     |
| **High traffic**      | `k6 run load-test.js` at 2× steady                                     | Latency budgets hold or rate limiter sheds excess with `429 + Retry-After`.                                                                                                                              |
| **Burst traffic**     | `k6 run spike-test.js`                                                 | Survives the shock; **recovers** to budget within the recovery window.                                                                                                                                   |
| **Large uploads**     | POST `/media/upload-url` for max-size objects, PUT direct to storage   | API memory flat (pre-signed — bytes bypass the API); `media-processing` queue absorbs re-encode.                                                                                                         |
| **Large downloads**   | fetch large media via CDN/signed URL                                   | API unaffected (never proxies bytes).                                                                                                                                                                    |
| **Memory pressure**   | run under a low `--max-old-space-size`; soak                           | `perf_heap_used_bytes` approaches the `runtime.memory.heap_used` budget; GC count climbs; watch for the budget flip before OOM.                                                                          |
| **CPU saturation**    | concurrency-test.js + a CPU-bound media job                            | Event-loop lag climbs (`runtime.event_loop_lag.p95` breach); media queue concurrency (2) prevents sharp from starving the loop.                                                                          |

## Running a drill

```bash
# 1. Start Toxiproxy and register the dependency proxies (see toxiproxy docs).
# 2. Point the API at the proxy and boot it.
# 3. Baseline: capture GET /admin/performance/report.
# 4. Add a toxic, e.g. 500ms DB latency:
toxiproxy-cli toxic add -t latency -a latency=500 postgres
# 5. Drive load: k6 run backend/perf/k6/load-test.js
# 6. Observe: /admin/performance/report (budget verdicts flip), /health/performance (down),
#    /metrics (perf_* gauges). Confirm the system degrades, never collapses.
# 7. Remove the toxic and confirm recovery to healthy.
toxiproxy-cli toxic remove -n latency_downstream postgres
```

The pass criterion is **graceful degradation + recovery**, evidenced by the
performance report flipping the right budgets to `fail` during the fault and back
to `pass` after — never a crash, data loss, or unbounded resource growth.
