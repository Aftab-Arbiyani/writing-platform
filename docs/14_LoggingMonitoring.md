# 14 — Logging, Monitoring & Observability

> **Derives from:** `00_ArchitectureDecisions.md` §3 (Pino decision), §9 (observability
> baseline). Security-relevant redaction contract is shared with
> `13_SecurityArchitecture.md` §13; deployment wiring (collectors, probes in nginx/CI)
> lives in `15_DeploymentStrategy.md`.
>
> **Principle:** we instrument for the questions we will actually ask at 02:00 —
> _"what did this request do?"_ (logs), _"is the platform healthy?"_ (metrics),
> _"why is it slow?"_ (traces). Everything else is noise with a storage bill.

---

## 1. Logging — Pino

### 1.1 Why Pino (ADR recap)

Decided in ADR §3: **Pino via `nestjs-pino`**, over Winston. Recap of the reasoning,
since this doc operationalizes it:

- 5–10× faster serialization — logging must never be the bottleneck on hot endpoints.
- JSON-native. Winston's edge is its transport zoo; our pipeline is
  **stdout → collector**, so transports buy nothing and add failure modes.
- Built-in `redact` (security contract, doc 13 §13) instead of hand-rolled filters.
- First-class request-scoped child loggers → correlation ids for free (§1.5).

### 1.2 Level Policy

`LOG_LEVEL` env (ADR §10): `debug` in local, `info` in staging/production.

| Level   | When                                                             | Examples                                                                   |
| ------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `fatal` | Process cannot continue; exit follows                            | Env validation failed at boot; DB unreachable at startup                   |
| `error` | Request/job failed in an unexpected way; someone should look     | Unhandled exception, 5xx, job moved to failed after final retry            |
| `warn`  | Handled but abnormal; a trend here is a problem                  | Rate limit exceeded, refresh reuse detected, slow query > 1 s, queue retry |
| `info`  | Business events + request completion — the operational narrative | `auth.login.success`, `piece.publish`, request summary line                |
| `debug` | Developer diagnostics, off in prod                               | Cache hit/miss detail, visibility decision traces                          |
| `trace` | Per-step internals, local only, opt-in per module                | TipTap sanitizer walk, query builder output                                |

Rules: **4xx caused by clients logs at `warn` or below** — a validation error is not
an `error`; `error` implies "our bug or our outage", which keeps the error stream
alertable. One request = one `info` summary line (nestjs-pino autoLogging) + zero or
more event lines; never log request bodies wholesale.

### 1.3 Structured Event Taxonomy

Every business-significant log line carries `event` (dot-namespaced, past-tense
verbs avoided — events name _facts_). The taxonomy is a constant catalogue in
`@qalam/shared` (same home as error codes), so event names are typo-proof and
greppable across backend and dashboards.

| Namespace      | Events (Phase 1 catalogue)                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.*`       | `auth.register`, `auth.login.success`, `auth.login.failed`, `auth.logout`, `auth.logout.all`, `auth.refresh.rotated`, `auth.token.reuse_detected`, `auth.oauth.google.linked`, `auth.password.reset_requested`, `auth.password.changed` |
| `piece.*`      | `piece.draft.created`, `piece.draft.autosaved` (`debug`), `piece.publish`, `piece.publish.scheduled`, `piece.unpublish`, `piece.delete`, `piece.visibility.changed`                                                                     |
| `social.*`     | `social.follow`, `social.unfollow`, `social.like`, `social.clap`, `social.bookmark`, `social.repost`, `social.response.created`                                                                                                         |
| `moderation.*` | `moderation.report.created`, `moderation.report.resolved`, `moderation.piece.actioned`, `moderation.user.suspended`, `moderation.private_content.accessed` (audited read, doc 13 §4.2)                                                  |
| `admin.*`      | `admin.role.granted`, `admin.prompt.published`, `admin.featured.changed`, … (mirrors `audit_logs.action` — the audit row is authoritative, the log line is operational)                                                                 |
| `media.*`      | `media.upload.requested`, `media.upload.completed`, `media.processing.done`, `media.processing.rejected` (magic-byte/type failures)                                                                                                     |
| `job.*`        | `job.started` (`debug`), `job.completed`, `job.failed`, `job.retried`, `job.dead_lettered`                                                                                                                                              |
| `search.*`     | `search.query` (`info`, with result count + duration; query text logged post-normalization, capped)                                                                                                                                     |

Shape convention — flat, typed, minimal:

```jsonc
{
  "level": "info",
  "time": 1751803200123,
  "event": "piece.publish",
  "requestId": "01J9…",
  "userId": "01J8…",
  "pieceId": "01J9…",
  "visibility": "public",
  "scheduled": false,
  "msg": "piece published",
}
```

IDs, enums, counts, durations — yes. Titles, content, emails — no (redaction is the
backstop, not the policy).

### 1.4 Request-Scoped Child Loggers

`nestjs-pino` binds a child logger per request via `AsyncLocalStorage`. Base bindings:
`requestId`, `userId` (post-auth), `route`, `method`. Every `this.logger.info(...)`
in any service during that request inherits the bindings — services never pass
correlation ids around manually.

### 1.5 Correlation — One Id from Edge to Job

`X-Request-Id` is minted at the edge and survives the async hop into BullMQ:

```
 browser ──► nginx ──────────► NestJS API ─────────────► BullMQ (Redis) ─────► worker
             adds/forwards      pino http binds           producer copies        processor opens child
             X-Request-Id       requestId to child        requestId into         logger { requestId,
             (uuid if absent)   logger + response         job.data.meta          jobId, queue } — same
                                envelope error.requestId                         requestId, new jobId
```

- The API **echoes `X-Request-Id`** on every response and embeds it in the error
  envelope (`error.requestId`, ADR §5) — a user bug report containing a request id
  is directly greppable across API _and_ worker logs.
- Jobs log both `requestId` (origin) and `jobId` (BullMQC identity); scheduled/cron
  jobs with no originating request mint their own `requestId` at enqueue so downstream
  fan-out still correlates.
- Frontends send `X-Request-Id` from the API client wrapper (crypto.randomUUID per
  call) so a Sentry breadcrumb on the client can be joined to server logs.

### 1.6 Redaction

Single source of truth `logging/redaction.ts`, applied in Pino config (and mirrored
conceptually in Sentry `beforeSend`, §2.4):

```ts
redact: {
  paths: [
    "req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]',
    "*.password", "*.currentPassword", "*.newPassword",
    "*.token", "*.accessToken", "*.refreshToken", "*.code",
  ],
  censor: "[REDACTED]",
}
// email is not dropped but masked by serializer: "aftab@example.com" → "af***@e***.com"
```

Full rationale and the guarantee ("token values never appear in URLs") in doc 13 §13.

### 1.7 Transport

- **Local:** `pino-pretty` (dev dependency, wired via `LOG_PRETTY=true`) — human
  colorized output.
- **Staging/production:** raw JSON to **stdout, nothing else**. No in-process file
  writing, no log rotation logic in the app — the container runtime captures stdout
  and the host ships it (Vector/promtail → Loki-class store; the collector choice is
  an ops detail, doc 15 §1 environments table). The app's contract ends at stdout.

**Why:** 12-factor logging keeps the app runtime-agnostic — the same image logs
correctly under compose, systemd, or k8s later.

---

## 2. Sentry

### 2.1 Placement

| App                     | SDK                                                                                             | DSN env           |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ----------------- |
| backend (API + workers) | `@sentry/nestjs` (init before Nest bootstrap; BullMQ worker errors captured in processor catch) | `SENTRY_DSN`      |
| frontend                | `@sentry/react` (ErrorBoundary + router instrumentation)                                        | `VITE_SENTRY_DSN` |
| admin                   | `@sentry/react`                                                                                 | `VITE_SENTRY_DSN` |

Three Sentry projects (backend / frontend / admin) — separate rate budgets and alert
routing; one org-level view.

### 2.2 Releases & Sourcemaps

- `release: qalam-<app>@<git-sha>` — the same sha that tags Docker images
  (doc 15 §2.3), so "which build threw this" is one lookup.
- CI (doc 15 §4): Vite builds emit hidden sourcemaps → `sentry-cli sourcemaps upload`
  during the build job → **sourcemaps are deleted from the deployed bundle** (never
  publicly served). Backend uploads sourcemaps for its compiled `dist/`.
- `environment: local | staging | production` tag from `NODE_ENV`/`VITE_APP_ENV`.

### 2.3 Sampling

| Signal                      | Rate        | Why                                                                                                              |
| --------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| Errors                      | 100 %       | Errors are rare by design (§1.2 level policy); sampling errors hides the first occurrence — the one that matters |
| Traces (`tracesSampleRate`) | 10 %        | Enough for p95 latency attribution without doubling request overhead or Sentry bill                              |
| Profiles                    | 0 % Phase 1 | Enable temporarily during performance investigations only                                                        |

### 2.4 PII Scrubbing & User Context

- `sendDefaultPii: false` on all three SDKs.
- `beforeSend`: drop `request.cookies` and `authorization` headers always; drop entire
  request body for any `/auth/*` route; strip query strings matching the redaction
  list (doc 13 §13).
- **User context policy: `Sentry.setUser({ id })` — id only, never email, never
  username.** Support lookups go id → admin panel, not the reverse.
- Breadcrumbs: `console` and `fetch` breadcrumbs filtered through the same URL
  scrubber; no keystroke/DOM-value breadcrumbs on the editor surfaces (draft text is
  the user's private asset — doc 13 §2).

---

## 3. Health Endpoints

`@nestjs/terminus` (Phase 1, per ADR §9), no auth (they leak nothing but
up/down), excluded from rate limiting and access-log sampling:

| Endpoint            | Purpose                                        | Checks                                                                                                                                                                                                 | Consumer                                              |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `GET /health`       | **Liveness** — is the process alive?           | Event loop responds; nothing external (a DB outage must NOT restart the API)                                                                                                                           | Container runtime restart policy                      |
| `GET /health/ready` | **Readiness** — should traffic be routed here? | Postgres `SELECT 1` (2 s timeout) · Redis `PING` (DB 0) · storage `HEAD` on `qalam-media` bucket (5 s, degraded-not-dead: reports `degraded` but stays ready if only storage fails — reads still work) | nginx upstream gating, deploy health gate (doc 15 §6) |

External **uptime monitoring** (any ping service): `GET /health/ready` on API +
`GET /` on both SPAs from outside our network, 60 s interval, alert after 2
consecutive failures (§8). Internal checks can't see DNS/TLS/network failures.

## 4. Metrics Plan

**Phase 1:** we ship logs + Sentry + health only, and _log_ the numbers below as
structured events. **Phase 1.5:** `prom-client` `/metrics` endpoint (IP-allowlisted)
scraped by **Prometheus + Grafana**. The taxonomy is fixed now so dashboards don't
need renamed series later.

### 4.1 Golden Signals per Endpoint Class

Endpoint classes: `auth`, `read` (pieces/profiles/feeds), `write` (publish/drafts),
`social`, `search`, `media`, `admin`.

| Signal     | Metric                                                                                                                                       | Labels                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Latency    | `http_request_duration_seconds` (histogram)                                                                                                  | `class`, `route`, `method`           |
| Traffic    | `http_requests_total` (counter)                                                                                                              | `class`, `route`, `method`, `status` |
| Errors     | derived: `status=~"5.."` rate                                                                                                                | same                                 |
| Saturation | `nodejs_eventloop_lag_seconds`, `process_resident_memory_bytes`, `nodejs_heap_size_used_bytes`, pg pool `db_pool_in_use` / `db_pool_waiting` | —                                    |

### 4.2 BullMQ (per queue: `scheduled-publish`, `notifications`, `media-processing`, `analytics-rollup`, `trending-score`, `emails`)

| Metric                                                     | Type      | Alert-relevant                                                 |
| ---------------------------------------------------------- | --------- | -------------------------------------------------------------- |
| `bullmq_queue_depth{queue,state}` (waiting/active/delayed) | gauge     | ✔ backlog                                                      |
| `bullmq_jobs_total{queue,outcome}` (completed/failed)      | counter   | ✔ failure ratio                                                |
| `bullmq_oldest_waiting_age_seconds{queue}`                 | gauge     | ✔ **the** stall detector — depth can be low while age explodes |
| `bullmq_job_duration_seconds{queue}`                       | histogram | capacity planning                                              |

### 4.3 Postgres & Node

- **Postgres:** connection counts vs `max_connections`, transaction rate, replication
  lag (when replica exists), and **`pg_stat_statements`** (enabled from day one, even
  before Prometheus — it answers "which query got slow" retroactively). Slow-query
  log threshold 1 s → captured as `warn` log events in Phase 1.
- **Node:** event loop lag (alert > 200 ms sustained), heap used vs limit, GC pause
  totals, open handles.

### 4.4 What We Log vs Metric vs Trace

| Question                                   | Tool                      | Why                                                     |
| ------------------------------------------ | ------------------------- | ------------------------------------------------------- |
| "What happened to request `01J9…`?"        | **Logs**                  | Cardinality is unbounded; needs full context            |
| "Is publish latency degrading this week?"  | **Metrics**               | Cheap aggregates over time; alertable                   |
| "Which of the 6 spans in publish is slow?" | **Traces** (Sentry, 10 %) | Cross-service timing decomposition                      |
| "Who did what in admin?"                   | **Audit log (DB)**        | Legal-grade retention; queryable; not a logging concern |

Rule of thumb: metrics for _rates and states_, logs for _events with identity_,
traces for _latency anatomy_. Never encode unbounded values (user ids, slugs) as
metric labels.

## 5. BullMQ Observability

- **bull-board** mounted at `/admin/queues` on the API, behind `JwtAuthGuard` +
  `@Roles(ADMIN)` (doc 13 §4.3) — never exposed on the public nginx vhost in
  production (admin vhost only, doc 15 §7).
- **Retry/backoff defaults:** `attempts: 5`, exponential backoff from 5 s, per-queue
  overrides (`emails` retries harder; `trending-score` is recompute-on-next-tick, so
  `attempts: 1`).
- **Dead-letter handling:** after final failure, jobs stay in `failed`
  (`removeOnFail: 1000` keeps the last 1000 per queue) and emit
  `job.dead_lettered` (`error` level → Sentry). Failed jobs are inspectable and
  re-runnable from bull-board; a weekly review clears or replays the backlog.
  Idempotency (`Idempotency-Key`, deterministic job ids like
  `publish:{pieceId}:{scheduledAt}`) makes replays safe.
- **Stalled jobs:** BullMQ stalled-checker on; `stalledInterval: 30s`,
  `maxStalledCount: 2` → then failed (never silently re-looped).

## 6. Frontend Monitoring Notes

- Both SPAs report Web Vitals (LCP/INP/CLS) through Sentry performance at the same
  10 % sample; budget: LCP < 2.5 s on `/p/:slug` (the reading surface is the product).
- API client wrapper logs non-2xx envelopes as breadcrumbs (scrubbed), so a Sentry
  issue shows the failing API call chain with request ids joinable to backend logs
  (§1.5).

## 7. Log Retention

| Store                                  | Hot                                                      | Cold                                                                                                 | Then                        |
| -------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------- |
| Application logs (API, workers, nginx) | 30 days searchable                                       | 13 months compressed object storage (matches ADR's 13-month analytics horizon — one retention story) | deleted                     |
| `audit_logs` (Postgres table)          | 7 **years** — compliance-grade, append-only (doc 13 §11) | —                                                                                                    | reviewed before any purge   |
| Sentry events                          | 90 days (plan default)                                   | —                                                                                                    | aggregate stats persist     |
| BullMQ job records                     | last 1000 failed / 100 completed per queue (in Redis)    | —                                                                                                    | logs are the durable record |

## 8. Alerting

Channels: **page** (on-call, immediate) · **channel** (team chat, work-hours response)
· **digest** (daily summary). Conditions are deliberately few — every alert must be
actionable or it trains people to ignore the pager.

| Condition                                 | Threshold                                                                     | Severity                     | Channel                     |
| ----------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------- | --------------------------- |
| Uptime probe: API `/health/ready` failing | 2 consecutive (≥ 2 min)                                                       | SEV1-adjacent                | page                        |
| Uptime probe: frontend or admin down      | 2 consecutive                                                                 | high                         | page                        |
| 5xx rate                                  | > 2 % of requests over 5 min                                                  | high                         | page                        |
| `auth.token.reuse_detected`               | any occurrence                                                                | high (security, doc 13 §3.2) | page + security channel     |
| `auth.login.failed` spike                 | > 100/min platform-wide                                                       | medium                       | channel                     |
| BullMQ `oldest_waiting_age`               | > 10 min (`scheduled-publish`, `notifications`, `emails`) · > 30 min (others) | high                         | page                        |
| BullMQ failure ratio                      | > 10 % over 15 min, any queue                                                 | medium                       | channel                     |
| `job.dead_lettered`                       | any, on `scheduled-publish` (user-visible promise)                            | high                         | channel                     |
| Postgres connections                      | > 80 % of max for 5 min                                                       | high                         | page                        |
| Event loop lag                            | > 200 ms sustained 5 min                                                      | medium                       | channel                     |
| Disk (DB volume)                          | > 80 %                                                                        | medium                       | channel                     |
| Sentry: new issue in production           | first occurrence                                                              | medium                       | channel                     |
| `pnpm audit` high/critical in CI          | on PR                                                                         | low                          | fails pipeline (doc 13 §12) |
| Cert expiry                               | < 14 days                                                                     | medium                       | channel                     |
| Restore drill overdue (doc 15 §9)         | > 35 days since last                                                          | low                          | digest                      |

Escalation: unacknowledged page → 15 min → next person. Alert thresholds live in
config-as-code next to the Grafana/uptime definitions, reviewed when they misfire —
a noisy alert is a bug.

---

_Cross-references: redaction & scrubbing contract → `13_SecurityArchitecture.md` §13 ·
collector/probe wiring, deploy health gates, backup alerts → `15_DeploymentStrategy.md` ·
queue catalogue → ADR §3._
