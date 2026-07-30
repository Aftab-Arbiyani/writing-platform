# 44 — Operations Platform (P7.4)

**Status:** ✅ Complete · **Scope:** complete production observability, monitoring, operational tooling, incident management, reliability tracking, production diagnostics, rollout management, and operational governance. **No new business functionality. No UI redesign.** Reuses every existing platform; redesigns nothing. Builds on the P7.1 config/health/deployment platform, the P7.2 security counters, and the P7.3 Performance Platform — P7.4 makes operations _centralized, evaluated, alerted, and governed_.

> The **Operations Platform** (`backend/src/modules/operations`) is the **single source of truth for operating the platform in production**. Business services carry **no** SLO / alerting / incident / operational logic: they emit a signal through **one** observer seam (and open spans through **one** tracer seam), and the platform owns evaluation, alerting, incidents, and reporting. This is the "never duplicate monitoring responsibilities" guarantee, enforced structurally — the same shape as the P7.3 `PERFORMANCE_OBSERVER` seam.

---

## 1. Folder tree (new / changed)

```
platfrom/
├─ backend/src/
│  ├─ common/operations/
│  │  ├─ operations-observer.port.ts     # + THE ops-signal seam (DI-less accessor + DI token)
│  │  └─ tracing.port.ts                 # + THE tracer seam (OTel-shaped, DI-less + token)
│  ├─ config/
│  │  ├─ operations.config.ts            # + operations namespace (tracing/log/slo/alert/cost tunables)
│  │  └─ config.module.ts                # ~ load operationsConfig
│  ├─ infrastructure/monitoring/
│  │  └─ metrics.service.ts              # ~ render ops_* lines through the SAME /metrics registry
│  ├─ infrastructure/infrastructure.module.ts # ~ export QueueMonitorService (reuse, not duplicate)
│  ├─ health/health.controller.ts        # ~ + GET /health/operations, operations in /health/deep
│  ├─ modules/operations/                # + THE OPERATIONS PLATFORM (@Global)
│  │  ├─ operations.constants.ts         #   SLO/alert/incident/cost/log catalogues + metric/redis taxonomy
│  │  ├─ operations.types.ts             #   all read-model shapes + the resolved OperationalSignals
│  │  ├─ operations.util.ts              #   nowIso/opsId + readSignal (the single metric→signal mapping)
│  │  ├─ operations.exceptions.ts        #   domain exceptions (@qalam/shared ERROR_CODES)
│  │  ├─ collector/operations-registry.service.ts # the observer sink (ops signal counters + metric lines)
│  │  ├─ collector/signal-collector.service.ts     # resolves OperationalSignals from the reused platforms
│  │  ├─ tracing/operations-tracer.service.ts      # the Tracer impl (bounded in-memory trace store)
│  │  ├─ tracing/tracing.service.ts                # Distributed Tracing Service (read surface)
│  │  ├─ logging/logging.service.ts                # Logging Service (classification/sampling/retention policy)
│  │  ├─ metrics/metrics-facade.service.ts         # Metrics Service (facade over the shared /metrics signals)
│  │  ├─ observability/observability.service.ts    # Observability Service (metrics+logs+traces posture)
│  │  ├─ slo/slo.rules.ts · slo/slo.service.ts     # SLO Management (pure rule + service)
│  │  ├─ alerting/alert.rules.ts · alerting/alerting.service.ts # Alerting (pure rule + dedup/suppress/route/escalate)
│  │  ├─ incidents/incident-store.ts · incidents/incident.service.ts # Incident Management (durable Redis + audit)
│  │  ├─ deployment/deployment-observability.service.ts # Deployment Observability
│  │  ├─ cost/cost-observability.service.ts        # Cost Observability
│  │  ├─ reliability/reliability.service.ts        # Reliability Engineering (availability/MTTR/MTBF)
│  │  ├─ health/operational-health.service.ts      # Operational Health Service
│  │  ├─ rollout/feature-rollout.service.ts        # Feature Rollout Platform (over the E12.8 flags)
│  │  ├─ runbook/runbook.catalog.ts · runbook/runbook.service.ts # Runbook Service
│  │  ├─ governance/operational-governance.service.ts # Operational Governance Service
│  │  ├─ dashboards/dashboard.service.ts           # Operational Dashboard Service (the 15-view catalogue)
│  │  ├─ chaos/chaos.catalog.ts · chaos/chaos.service.ts # Chaos-readiness catalogue (no execution)
│  │  ├─ operations-platform.service.ts            # umbrella facade + posture snapshot + report
│  │  ├─ operations-health.indicator.ts            # operations health probe (Terminus)
│  │  ├─ operations-admin.controller.ts            # GET/POST/PATCH/DELETE /admin/operations/*
│  │  ├─ dto/operations-request.dto.ts · dto/operations-response.dto.ts
│  │  ├─ operations.module.ts · index.ts
│  │  └─ **/*.spec.ts                     #   72 unit tests
│  ├─ app.module.ts                       # ~ register OperationsModule (after PerformanceModule)
│  └─ .env.example                        # ~ + OPS_* section
├─ packages/shared/src/error-codes.ts     # ~ + OPERATIONS_* codes
├─ admin/src/features/operations/         # + 10 operational dashboards (see §11)
platfrom/docs/44                          # + this document
qalam-mobile/                             # Flutter operations client — see qalam-mobile/docs/54
```

Legend: `+` new, `~` changed.

---

## 2. Operations Platform architecture

A `@Global` module (its facade + health indicator injectable everywhere), imported **last** in `app.module.ts` so it composes the whole backbone it reads. Single-responsibility services, each mirroring the P7.3 service shape:

| Service                          | Responsibility                                                                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OperationsRegistryService`      | The **observer sink** — implements the one `OperationsObserver` seam; bounded per-signal counters (deployments, failures, rollouts, SLI outcomes performance doesn't model); renders `ops_*` metric lines. |
| `OperationsTracerService`        | The **tracer** — implements the OTel-shaped `Tracer` seam; head-sampled, bounded in-memory trace store (the admin Tracing viewer's read model).                                                            |
| `SignalCollectorService`         | Resolves the **`OperationalSignals`** snapshot from the reused platforms (P7.3 analysis + capacity, queue monitor, cost, registry) — the "reuse, don't re-measure" boundary.                               |
| `ObservabilityService`           | **Observability** umbrella — metrics + logging + tracing posture.                                                                                                                                          |
| `MetricsFacadeService`           | **Metrics** facade — projects the shared `/metrics` signals into a structured snapshot + owns the ops metric taxonomy.                                                                                     |
| `LoggingService`                 | **Logging** policy — classification, sampling, retention, redaction contract (over the existing Pino logger).                                                                                              |
| `TracingService`                 | **Distributed Tracing** read surface over the tracer's store.                                                                                                                                              |
| `SloService`                     | **SLO Management** — SLIs, SLOs, error budgets, burn rate, over the pure `evaluateSlo` rule.                                                                                                               |
| `AlertingService`                | **Alerting** — evaluates the rule catalogue + dedup, suppression, maintenance windows, routing, escalation → incidents.                                                                                    |
| `IncidentService`                | **Incident Management** — lifecycle, timeline, assignment, notes, root cause, failure class, recovery verification, postmortem.                                                                            |
| `DeploymentObservabilityService` | **Deployment Observability** — deployments, versions, duration, success rate, rollbacks, migrations, config/infra changes.                                                                                 |
| `CostObservabilityService`       | **Cost Observability** — an estimate by category + trend (from the capacity plan + rates).                                                                                                                 |
| `ReliabilityService`             | **Reliability Engineering** — availability, MTTR, MTBF, failure classification, recovery-verified rate.                                                                                                    |
| `OperationalHealthService`       | **Operational Health** — per-component + overall + readiness summary (composed, not a parallel checker).                                                                                                   |
| `FeatureRolloutService`          | **Feature Rollout** — percentage/canary/environment rollouts, kill switches, emergency disable (over the E12.8 flags).                                                                                     |
| `RunbookService`                 | **Runbook** — serves the declarative runbook catalogue (alerts link to runbooks).                                                                                                                          |
| `OperationalGovernanceService`   | **Operational Governance** — centralization + telemetry-consistency assertions.                                                                                                                            |
| `DashboardService`               | **Operational Dashboard** — the 15-view catalogue + its sources.                                                                                                                                           |
| `ChaosService`                   | **Chaos-readiness** — declarative failure-mode → built-in-mitigation catalogue (no fault injection).                                                                                                       |
| `OperationsPlatformService`      | Umbrella **facade** + admin posture snapshot + full report.                                                                                                                                                |

**The two seams.** `common/operations/operations-observer.port.ts` and `tracing.port.ts` are dependency-free ports, each with a DI token **and** a DI-less accessor (`getOperationsObserver()` / `getTracer()`), mirroring `PERFORMANCE_OBSERVER`. Every emission point calls `getOperationsObserver()?.record(...)` or `getTracer()?.startSpan(...)` — a no-op until the platform registers itself, so instrumentation never breaks a request and unit tests need no wiring.

**Centralized rules.** SLOs, alert rules, incident lifecycle, cost categories, runbooks, and chaos scenarios are declarative tables in `operations.constants.ts` (+ the runbook/chaos catalogues); SLO and alert evaluation are single pure functions (`evaluateSlo`, `evaluateAlertRule`) run over them — the Policy-Engine / P7.3-budget pattern. Adding an SLO / alert / runbook is adding a row.

---

## 3. Logging architecture

Structured logging is **already** the P7.1 `AppLoggerModule` (nestjs-pino → JSON to stdout): one line per request with a correlation id (`X-Request-Id`), request id, and deployment context (`service`, `env`, `version`, `commit`, `instanceId`), plus a `logSampleRate` hook and shared redaction (`REDACT_PATHS`). P7.4 adds the **policy layer** (`LoggingService`), the single source of truth for:

- **Classification** — `error` / `audit` (never sampled), `access` / `application` (sampled by `LOG_SAMPLE_RATE`).
- **Sensitive-data filtering** — the shared redaction contract (tokens/passwords/cookies never logged), enforced in the Pino config and mirrored in Sentry's `beforeSend`.
- **Retention + sampling policy** — documented per class (`OPS_LOG_RETENTION_DAYS`), emitted for the downstream collector.
- **Aggregation-ready** — JSON-to-stdout is exactly what ELK / Loki / CloudWatch / Datadog ingest, with no code change.

Correlation IDs, request IDs, trace IDs, user/session/deployment/environment context are all present today; the Logging Service exposes and governs them centrally.

---

## 4. Metrics architecture

There is **one** metrics registry: the existing `GET /metrics` Prometheus endpoint. Application / API / DB / Redis / queue metrics come from the HTTP interceptor + BullMQ gauges; performance signals from the P7.3 `metricLines`; security counters from P7.2; and the Operations Platform appends `ops_*` lines through the **same** registry (`getOperationsObserver()?.metricLines?.()`). The `MetricsFacadeService` projects the identical signals into a structured snapshot for the admin Metrics viewer, and owns the ops metric-name taxonomy (`OPS_METRICS`). **No parallel collection.**

---

## 5. Distributed tracing architecture

`common/operations/tracing.port.ts` is a dependency-free, **OpenTelemetry-shaped** seam (`Tracer.startSpan → Span{setAttribute,setError,end}` + a propagated `TraceContext{traceId,spanId,parentSpanId}`). Trace ids seed from the existing `X-Request-Id` correlation id so a trace stitches to its logs. The `OperationsTracerService` records spans into a bounded, head-sampled in-memory store (the admin Tracing viewer). Any instrumentation point — HTTP, background jobs, DB / Redis / queue / AI / search / storage / payment / auth / external — opens a span through the seam without importing the platform. Because the seam mirrors OTel, swapping the in-process tracer for an OTel SDK exporter (→ Jaeger / Tempo / Datadog / Honeycomb) is a **factory swap, no call-site change** — Sentry already carries the production trace export (`instrument.ts` `tracesSampleRate`).

---

## 6. Alerting architecture

`ALERT_RULES` is the SSOT: each rule declares a metric, comparator, threshold, severity, category, and a linked runbook. The pure `evaluateAlertRule` decides _firing_; the `AlertingService` layers the stateful concerns: **deduplication** (a repeat within `OPS_ALERT_DEDUP_SECONDS` is suppressed via a Redis SET-NX lock), **maintenance-window suppression** (per category, durable Redis), **routing** (by severity, from the routing table), and **escalation** (a firing _critical_ alert opens an incident through the `IncidentOpener` hook — one-way, no module cycle). Every alert category the phase enumerates is covered: performance, availability, infrastructure, security, capacity, cost, queue, AI-provider, search, payment. Alert state lives in the durable Redis DB (AOF) — no new table.

---

## 7. Incident management architecture

Full lifecycle: `open → acknowledged → investigating → identified → monitoring → resolved`, validated against a declared transition table. Each incident carries severity (SEV1–4), an immutable timeline, assignee, root cause + failure classification, recovery-verification flag, and time-to-resolve (feeds MTTR). Incidents auto-open from critical alerts (deduped by source alert) and can be opened manually by an admin. **Persistence** = the durable Redis DB (`getClient('auth')`, AOF) — the same migration-free durable-state pattern the Privacy module uses for consent/DSR — while **every material action is also written to the immutable `audit_logs` trail** (the permanent record) via the shared `AuditService`. Postmortem templates are pre-filled from a resolved incident. No new table, no migration.

---

## 8. Operational dashboard architecture

`DashboardService` declares the 15 operational views (system-overview, infrastructure, application, database, redis, queues, search, ai-platform, payments, authentication, security, performance, deployments, costs, business-kpis) and the read endpoints that feed each. Every dashboard is built from the **other** services' read models — the dashboard service composes references, it never re-measures. The admin app renders 10 dashboard pages against `/admin/operations/*` (see §11).

---

## 9. SLO architecture

`SLO_DEFINITIONS` is the SSOT: availability / latency / success-rate / error-rate objectives per service (API, AI, search, payments), each reading a metric the platform already measures. The pure `evaluateSlo` computes SLI-vs-objective, **error budget remaining**, **burn rate**, and a status (`meeting` / `at_risk` / `breaching` / `no_data`). `no_data` (no live signal) is never a false pass/fail — the P7.3 `not_measured` discipline. Fast-burn objectives (burn rate ≥ `OPS_SLO_FAST_BURN`) are surfaced for alerting.

---

## 10. Cost observability architecture

`CostObservabilityService` produces an internal cost **estimate** (never a bill of record) from the P7.3 capacity forecasts (AI tokens, storage) + configured unit rates, folding bandwidth / DB / Redis / queue / API / third-party into an infrastructure baseline until a metered usage feed is attached (documented seam). It reports cost by category, daily/monthly totals, and a trend (vs the previous persisted estimate). Real billing (Stripe/Apple/Google invoices, cloud bills) plugs in behind this surface without changing consumers.

---

## 11. Admin operations surface

`OperationsAdminController` mounts `/admin/operations/*`: read views gated on `admin.dashboard`, mutations on `settings.manage` (the same gate the feature-flag surface uses), every mutation audited by the service it delegates to. The admin app ships **10 dashboards** — Operations, Incidents, Alerts, Tracing viewer, Metrics viewer, Log viewer, Deployments, Cost, SLO, Service Status — as a new `admin/src/features/operations/` slice following the existing `security`/`system` slice conventions.

---

## 12. Flutter operations summary

The mobile operations client (crash reporting, performance monitoring, network diagnostics, operational logging, release diagnostics, remote feature-flag integration, production telemetry) follows the app's inert-seam pattern (interface + Noop + bootstrap factory + Riverpod provider), reusing the existing crash-reporter/remote-config seams, `log_redaction`, `AppEnvironmentInfo`, the `x-request-id` correlation id, the global error handlers, and the `bootstrapMs` cold-start timer. Nothing phones home until a concrete backend is wired. Full report: **[qalam-mobile/docs/54](../../qalam-mobile/docs/54_MobileOperations.md)**.

---

## 13. Operations test coverage

72 unit tests (`nest build` green, `tsc --noEmit` green, **909 backend tests green**, lint clean): the pure SLO + alert rules, the ops registry + tracer, the SLO / alerting (dedup + maintenance + escalation) / incident-lifecycle / feature-rollout / reliability / operational-health / cost services, and the signal resolver. Alerting/incident state is tested with an in-memory Redis/store fake; every service that reuses another platform is tested with that platform mocked, proving the "compose, don't duplicate" boundary.

---

## 14. Manual operational verification guide

1. `docker compose up -d` · `pnpm --filter backend migration:run` (no new migration — ops state is durable Redis + audit trail) · `pnpm dev`.
2. **Metrics** — `GET /metrics` (dev, no token). After some traffic, confirm `ops_deployments_total` appears alongside `perf_*` and `http_*` lines (one registry).
3. **Summary** — `GET /api/v1/admin/operations/summary` (admin JWT): health, SLO tally, firing alerts, open incidents, cost.
4. **SLO** — `GET /admin/operations/slo` → per-objective SLI/budget/burn/status.
5. **Alerts** — `GET /admin/operations/alerts` → firing/suppressed with runbook links. Open a maintenance window (`POST /admin/operations/maintenance-windows`) and confirm matching alerts flip to `suppressed`.
6. **Incidents** — `POST /admin/operations/incidents`, transition it (`PATCH …/status`), add a note, resolve it (`POST …/resolve`), fetch the postmortem (`GET …/postmortem`). Confirm each writes an `audit_logs` row.
7. **Health** — `GET /admin/operations/health` (component list + readiness), `GET /health/operations`, and `/health/deep` (operations included).
8. **Deployments / cost / reliability / tracing / observability / governance** — the remaining `GET /admin/operations/*` endpoints.
9. **Feature rollout** — `PATCH /admin/operations/rollouts/<key>/percentage {percentage:10}` (canary), then `POST …/kill` (emergency disable) and confirm the flag flips off.
10. **Admin dashboards** — `pnpm --filter admin build`; open the Operations section (10 views).
11. **Flutter** — `flutter analyze` clean; the operations seams are inert-by-default and covered by tests.

---

## 15. Centralization confirmation

All production observability + operations are centralized in the Operations Platform without architectural duplication:

- **Two seams** (`OperationsObserver` + `Tracer`) mirror the P7.3 pattern; no service computes its own SLO/alert/incident logic.
- **Single rule catalogues** (`operations.constants.ts` + runbook/chaos catalogues) with **two pure evaluation functions** (`evaluateSlo`, `evaluateAlertRule`); thresholds live nowhere else.
- **One metrics registry** (the existing `/metrics`), **one logging contract** (the existing Pino logger), **one tracing store**, **one signal resolver** (`SignalCollector` → `readSignal`).
- **Reuses** the Performance Platform (SLO/alert signals + capacity), Security counters, Production Infrastructure (config/health/deployment metadata + `CacheService`/`QueueMonitor`), the Policy + Entitlement platforms (via the surfaces they already expose), the Settings feature-flag subsystem (rollout), and the immutable audit trail (incident/deployment history) — **no parallel monitoring, no new tables, no migration, no redesigned business service.**
- Verified: `nest build` green, `tsc --noEmit` green, **909 backend tests green** (72 new), lint clean.

---

## 16. Future compatibility (confirmation)

Supported without architectural change, because every pillar is a seam: **OpenTelemetry / Jaeger / Tempo** (the OTel-shaped `Tracer` seam → an SDK exporter), **Prometheus / Grafana** (the `/metrics` taxonomy is already forward-compatible), **Loki / ELK / CloudWatch** (JSON-to-stdout aggregation), **Datadog / New Relic / Honeycomb** (metrics + traces exporters behind the seams), **PagerDuty / Opsgenie / VictorOps** (the alert routing table + escalation hook plug in a notifier). Incident/deployment durable state can graduate from durable Redis to Postgres/ClickHouse behind the store interface. Each is a config/adapter change, not a refactor.
