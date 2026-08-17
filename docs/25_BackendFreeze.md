# 25 — Backend Freeze v1

**Status: FROZEN** · Effective 2026-07-09 (post Epic 12) · API surface `v1`.

This document is the contract baseline. After E12, the backend enters **additive
maintenance**: `v1` is stable and every future feature (AI, subscriptions,
monetization, admin, reading experience, the React frontend, the Flutter app) must
be built **without breaking the frozen `v1` contract**. It is the reference the
clients build against and the gate every PR is measured against.

> Precedence: the master ADR (`00`) still wins on decisions; this document freezes
> the _contract surface_ those decisions produced. Changing the freeze requires the
> process in §9.

---

## 1. Frozen baseline (anchors)

| Aspect                | Frozen value                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| **API version**       | `v1` — all routes under `/api/v1/*` (URI versioning); probes at root (`/health/*`, `/metrics`)             |
| **Endpoints**         | 19 controllers · 102 OpenAPI paths (see `GET /docs` / exported `openapi.json`)                             |
| **Response contract** | success `{ success, data, meta? }`; error `{ success:false, error:{ code, message, details, requestId } }` |
| **Error catalogue**   | 69 `ERROR_CODES` in `@qalam/shared` — stable strings, never renamed/removed                                |
| **AuthZ vocabulary**  | 26 `PERMISSIONS` codes (PBAC); 11 `RATE_LIMIT_TIERS`                                                       |
| **DB schema version** | migration baseline **`1783582561943-NotificationActorIndex`** (10 migrations; `synchronize:false`)         |
| **Auth model**        | JWT access (15 min) + rotating refresh (30 d) reuse-detection; Argon2id; Google OAuth (code+PKCE)          |
| **Runtime**           | Node 24 · pnpm 9.12 · TypeScript strict · NestJS 11 · TypeORM 0.3                                          |
| **Data stores**       | PostgreSQL 16 · Redis 7 (DB0 cache · DB1 queues · DB2 rate-limit · DB3 auth) · S3/R2 · SMTP                |

---

## 2. API contract (v1)

- **Envelope is invariant.** Success and error shapes above never change within
  `v1`. Clients switch on `error.code` (never on message text) and correlate via
  `requestId`.
- **Error codes are append-only.** New codes may be added; existing codes are
  never renamed, repurposed, or removed within `v1`.
- **Pagination**: cursor (feeds/timelines, opaque base64) and offset (admin
  tables). `meta.pagination` shape is frozen.
- **Rate limiting**: every endpoint is limited (declared tier or `apiDefault`
  300/min); `X-RateLimit-*` + `429 RATE_LIMITED` + `Retry-After` are part of the
  contract.
- **AuthN/AuthZ**: bearer access token; PBAC via permission codes; the permission
  catalogue is append-only within `v1`.
- **Source of truth**: the exported `openapi.json` (built from `/docs` in
  non-production) is the machine-readable contract that feeds `@qalam/api-types`
  codegen — the wire between backend, React, and Flutter.

---

## 3. Database schema version

- **Baseline**: the 10 migrations through `1783582561943-NotificationActorIndex`.
- **Rule**: migrations only (`synchronize:false` forever), immutable once merged,
  every migration has a tested `down()` (CI validates up→down→up).
- **Evolution is expand → migrate → contract** (backward-compatible): the currently
  deployed app must keep working against the new schema. No destructive change
  (drop column/table, tighten a constraint) ships in the same release as the code
  that stops using it.
- UUIDv7 app-generated PKs; snake_case columns; soft delete only where `docs/04`
  says so.

---

## 4. Supported environments

| Env            | Purpose  | Notes                                                                    |
| -------------- | -------- | ------------------------------------------------------------------------ |
| **local**      | dev      | `docker compose up -d` + `pnpm dev`; `/docs` on                          |
| **staging**    | pre-prod | auto-deploy on merge to `main`; synthetic seed data only                 |
| **production** | live     | tag `v*` + manual approval; `/docs` off; secrets via GitHub Environments |

Hard runtime requirements: Node **24**, pnpm **9.12**, PostgreSQL **16**, Redis **7**,
an S3-compatible bucket, and an SMTP endpoint. Env is Zod-validated at boot
(fail-fast); required with no default: `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`.

---

## 5. Deployment requirements

- Immutable `sha-<12>` images (never `latest`); build-once-promote-many.
- Migrations run as an **explicit deploy step before app rollout**.
- Health-gated rollout on `/health/ready`; `SIGTERM` graceful drain
  (`stop_grace_period: 45s`); non-root container; stdout JSON logs.
- Required health/observability wired: `/health/{live,ready,database,redis,storage,
queues}`, token-gated `/metrics`, Sentry (release = git sha).
- Full procedure: `19_DeploymentGuide.md`; rollback/DR: `21`, `22`.

---

## 6. Performance targets (SLOs)

Steady-state targets the frozen backend is expected to hold; regressions are a
release blocker (validate against `/metrics` + Sentry traces).

| Target                | Value                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------- |
| API availability      | ≥ 99.9% (readiness)                                                                       |
| API latency p95       | ≤ 300 ms (non-search reads); ≤ 800 ms (search/aggregate)                                  |
| 5xx error rate        | < 0.5% (alert at 10% failure ratio / 15 min)                                              |
| Scheduled-publish lag | published within 60 s of target                                                           |
| Queue stall alert     | `oldest_waiting_age` > 10 min (scheduled-publish/notifications/emails), > 30 min (others) |
| Cache                 | read-through + single-flight; hot caches warmed every 15 min                              |
| Data durability       | RPO ≤ 5 min, RTO ≤ 4 h, PITR 30 days                                                      |
| DB pool               | `DB_POOL_MAX` × instances < Postgres `max_connections`                                    |

No `COUNT(*)` on hot paths (use `piece_stats`); heavy/unbounded work is queued
(anything > 2 s or retry-worthy).

---

## 7. Coding standards

Frozen as the **CLAUDE.md "Hard rules"** + `16_CodingStandards.md`. Non-negotiable:
strict TS (no `any`); controller → service → repository layering; no cross-module
repository imports (services/events/queues only); DTO validation at the boundary;
TypeORM parameterization only; secrets via env; never log tokens/passwords/emails;
domain invariants (permanent username, one pen name, one language per piece, claps
≤ 50). New async work follows the typed-job-handler pattern
(`backend/src/infrastructure/README.md`).

---

## 8. Breaking-change policy

**Within `v1`: additive only.** A change is **breaking** (and therefore NOT allowed
in `v1`) if it:

- removes or renames an endpoint, field, `ERROR_CODES` value, permission code, or
  enum value;
- changes a field's type, nullability, or semantics, or the envelope/pagination
  shape;
- makes a previously-optional request field required, or adds a new required field;
- tightens validation/auth on an existing endpoint in a way that rejects
  previously-valid calls;
- makes a destructive/incompatible schema change (see §3).

**Allowed (additive)**: new endpoints; new optional request fields; new response
fields (clients must ignore unknown fields); new error codes / permissions / rate
tiers / enum members; new indexes; performance/security fixes that preserve
behavior.

**When a breaking change is genuinely required:**

1. Introduce it under a **new API version** (`/api/v2/...` via URI versioning) —
   `v1` keeps working.
2. Or add a new endpoint/field and **deprecate** the old one: mark `@deprecated` in
   Swagger, announce, keep it for a documented window (≥ 1 minor release), then
   remove only in a new major version.
3. Never mutate `v1` in place.

**Future features (AI, subscriptions, monetization, admin, reading experience)**
are built as **new modules + new additive endpoints/columns** behind the same
contract. They must not alter existing `v1` responses, error codes, or schema
semantics. Phase-2 concerns (AI, payments, Apple login) remain out of scope until
explicitly planned, and enter additively.

---

## 9. Amending the freeze

Changing anything in §1–§3 (the contract) requires: (a) an ADR entry in `docs/00`,
(b) a version bump entry in the table below, and (c) — for any breaking change —
a new API version per §8. Additive changes update the relevant doc + `openapi.json`
and are noted here.

| Date       | Change                                                                                                                 | By  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | --- |
| 2026-07-09 | Initial freeze at `v1` (post Epic 12)                                                                                  | —   |
| 2026-07-27 | **Additive:** `GET /pieces/by-slug/:slug` (B1, [45 §3](./45_WebClientRoadmap.md))                                      | —   |
| 2026-08-08 | **Post-freeze surface, shape change:** `GET /stories/:id/snapshots` (B7, [45 §4.12](./45_WebClientRoadmap.md))         | —   |
| 2026-08-17 | **Post-freeze surface, additive + one error code split:** `admin/monetization` (B8, [45 §5](./45_WebClientRoadmap.md)) | —   |

**2026-07-27 — `GET /pieces/by-slug/:slug`.** Additive per §8; no existing endpoint, DTO, or
behaviour changed. **Why:** the web reader addresses pieces by slug (`/p/:slug` — already emitted by
feed cards, search results, notification deep links and mobile), but `GET /pieces/:id` is guarded by
`ParseUUIDPipe` and accepts UUIDs only, so the reader page could not be built at all. The alternatives
— relaxing `pieces/:id` to take slug-or-UUID (mutates a frozen contract, drops param validation) or
moving the web to `/p/:id` (forfeits SEO, breaks shipped deep links) — were rejected. The new route
mirrors `getById` exactly: `@Public()` + `OptionalAuthGuard`, identical visibility rules (published +
visible; owner sees any status), identical `PieceResponseDto`, identical `PieceNotFoundException` on
miss. Only the lookup key differs.

**2026-08-08 — `GET /stories/:id/snapshots` answers `SnapshotHistoryDto`, not `SnapshotDto[]`.**
Recorded here for discoverability, **not** as a freeze amendment: this route is AF6 (added 2026-07-20)
and is therefore outside the `v1` baseline of 102 paths frozen on 2026-07-09, and its only consumers
are the frontend and the Flutter app, both updated in the same commit. **Why:** B7 caps how many
story versions a plan SHOWS, and §4.12 requires the true total to travel with the clamped list — an
array has nowhere to carry it, and five rows out of thirty-two are indistinguishable from five rows
out of five, so a client reading only the array would report a count that is false. The alternative,
a second `GET /stories/:id/snapshots/limit` endpoint mirroring B4's and B6's, was rejected: the total
is a property of the very list being clamped, and splitting them makes a torn read possible between
the two requests. Nothing else changed — same route, same guard, same permission, same `SnapshotDto`
for each item. `POST /stories/:id/snapshots` (capture) is untouched **by design**, and a test fails if
that stops being true.

**2026-08-17 — `admin/monetization` gains three reads, four fields, and one error code.** Recorded
here for discoverability, in the B7 style above and **not** as a freeze amendment: `admin/monetization`
is AF5, built after the `v1` baseline of 102 paths was frozen on 2026-07-09, and §8 names monetization
and admin explicitly as future features that "enter additively" outside that baseline. Its only
consumer is the admin app, updated in the same commits. No ADR and no version bump; every change below
is additive except one error code, which is discussed on its own.

**What changed.** Three new routes, all `@Permissions(billing.manage)` like every other route on the
controller, all pure plumbing over service methods that already existed:

| Route                                               | Answers                           | Reuses                                      |
| --------------------------------------------------- | --------------------------------- | ------------------------------------------- |
| `GET admin/monetization/users/:userId/subscription` | `AdminUserSubscriptionDto`        | `SubscriptionService.findByUser`            |
| `GET admin/monetization/users/:userId/payments`     | the module's cursor page envelope | `BillingService.listPayments`               |
| `GET admin/monetization/users/:userId/credits`      | `AdminUserCreditsDto`             | `CreditService.findWallet` (new, read-only) |

Plus, on existing shapes: `UpdateMonetizationConfigDto` declares its remaining three properties
(`taxRates`, `currencyRates`, `regionCurrency` — the service always merged them; the DTO was what the
boundary rejected them at); `toCouponDto` returns `appliesToTier`, `perUserLimit` and `description`;
and `RevenueAnalytics` gains `byCurrency`.

**Why `byCurrency` is an addition and not a fix to the fields it corrects.** `totalRevenue`,
`last30dRevenue` and `refunded` sum across every currency, which is meaningless on a multi-currency
install — the honest shape would be a per-currency map. Retyping a shipped field from a number to a
map is breaking regardless of the baseline, and the admin revenue dashboard already reads all three.
So the grouped figures arrive alongside, the four scalars keep their exact former types and meanings,
and a spec asserts that promise directly so the next person tempted to "finish the job" finds out
there rather than in a client.

**The one non-additive change: `PAYMENT_NOT_REFUNDABLE`.** `BillingService.refund` threw
`PAYMENT_NOT_FOUND` both when no payment row existed and when the row existed with no
`providerPaymentId` — a payment never captured at a provider. The second case now answers
`PAYMENT_NOT_REFUNDABLE` (409). The code is additive; what changed is that a case which used to answer
404 now answers 409, and that is a deliberate correction rather than an oversight: the two states lead
an operator to opposite actions, and collapsing them told someone holding a correct payment id to go
and find a better one. The admin app is the only consumer, its refund copy is split in the same commit
per the B7 precedent, and both its unit and browser specs assert the two codes stay apart.

**Nothing existing was removed, renamed or retyped.** The four numeric config fields, the coupon
fields that already shipped, the four revenue scalars, `PAYMENT_NOT_FOUND` itself, and every one of
A1's fourteen routes are untouched.
