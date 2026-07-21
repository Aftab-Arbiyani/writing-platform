# Performance & Load Testing (P7.3)

The repeatable performance harness for the Qalam API. It pairs with the
**Performance Platform** (`src/modules/performance`), which measures live traffic
and verifies it against the same budget catalogue these tests use.

## Layout

```
perf/
├── k6/                       # load / stress / spike / soak / concurrency tests (k6)
│   ├── lib/config.js         #   base URL, token, budget-derived thresholds (mirror the budget catalogue)
│   ├── lib/scenarios.js      #   one flow per product suite (auth, reading, search, recs, publishing, ai, storage)
│   ├── load-test.js          #   sustained steady-state load
│   ├── stress-test.js        #   ramp past capacity → find the knee, confirm graceful degradation
│   ├── spike-test.js         #   sudden burst + recovery
│   ├── soak-test.js          #   long-hold leak detection
│   └── concurrency-test.js   #   fixed high arrival rate on hot resources (stampede/idempotency/txn)
├── failure-testing.md        # fault-injection drills (Toxiproxy): DB/Redis/queue/AI/storage/traffic/memory/CPU
├── run-benchmarks.ts         # deterministic micro-benchmark runner → JSON
├── check-regression.ts       # gate a fresh run against performance-baseline.json (CI regression test)
└── performance-baseline.json # committed baseline (regenerate deliberately with --update)
```

## Load / stress / spike / soak (k6)

Requires the [k6](https://k6.io) binary (an external tool — no npm dependency).

```bash
# Steady-state load against a running API. TOKEN unlocks the authenticated flows.
BASE_URL=http://localhost:4000 TOKEN=<jwt> PIECE_ID=<uuid> \
  k6 run backend/perf/k6/load-test.js

k6 run backend/perf/k6/stress-test.js        # capacity knee + graceful degradation
k6 run backend/perf/k6/spike-test.js         # burst + recovery
SOAK_MINUTES=120 k6 run backend/perf/k6/soak-test.js   # leak detection
k6 run backend/perf/k6/concurrency-test.js   # hot-key contention
```

Thresholds mirror `PERFORMANCE_BUDGETS` (API p95<400ms, p99<1000ms, error<1%,
search p95<500ms, AI p95<15s, storage signing p95<300ms). While a run executes,
watch `GET /admin/performance/report` and `/metrics` (`perf_*`) — the live
Performance Platform verifies the very same budgets against the traffic k6 drives.

## Deterministic benchmarks + regression gate

```bash
pnpm --filter backend perf:bench                 # print a benchmark run as JSON
pnpm --filter backend perf:bench -- --out perf/latest.json
pnpm --filter backend perf:regression            # fail if a scenario regresses beyond tolerance
pnpm --filter backend perf:regression -- --update   # rewrite the baseline (deliberate)
```

The benchmarks are pure, in-process, and dependency-free — repeatable run-to-run,
so the only thing that moves the numbers is a real change in the measured code.
CI runs `perf:regression` to catch order-of-magnitude regressions.

## Failure testing

See [failure-testing.md](failure-testing.md) — Toxiproxy-based drills that verify
the platform **degrades gracefully and recovers** (the performance report flips
the right budgets to `fail` during the fault, back to `pass` after) rather than
collapsing.
