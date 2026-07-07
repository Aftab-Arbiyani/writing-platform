# 02 — System Architecture

> **Derives from:** `00_ArchitectureDecisions.md` (the master ADR). This document expands
> the ADR's decisions into C4-style views, module responsibilities, and the key runtime
> data flows. It re-decides nothing. **Status note:** the backend _foundation_ exists in
> Phase 0; the 14 domain modules in §5 are **Phase 1 plans — documentation only.**

---

## 1. System Context (C4 Level 1)

Who and what touches Qalam, from ten thousand feet:

```
                 ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
                 │    Writer    │   │    Reader    │   │ Moderator/Admin  │
                 │ (Farheen,    │   │   (Sana)     │   │  (staff, RBAC:   │
                 │  Ravi)       │   │              │   │  mod<admin<super)│
                 └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘
                        │ writes, publishes │ reads, curates    │ reviews, curates,
                        │ reads analytics   │ follows           │ audits
                        ▼                   ▼                   ▼
        ┌───────────────────────────────────────────────────────────────────┐
        │                                                                   │
        │                        QALAM  PLATFORM                            │
        │        "a premium writing sanctuary" — publish, discover,         │
        │      engage with Hindi/Urdu (later global) creative writing       │
        │                                                                   │
        └───────┬─────────────────┬─────────────────┬─────────────────┬─────┘
                ▼                 ▼                 ▼                 ▼
     ┌────────────────┐ ┌─────────────────┐ ┌──────────────┐ ┌─────────────────────────┐
     │  Google OAuth  │ │ S3-compatible   │ │    Sentry    │ │ SMTP relay (mailpit dev)│
     │  code + PKCE;  │ │ storage — MinIO │ │   BE + FE    │ │ transactional auth mail │
     │  Apple Phase 2 │ │ dev, S3/R2 prod │ │   errors     │ │ only, NOT notifications │
     └────────────────┘ └─────────────────┘ └──────────────┘ └─────────────────────────┘
```

External dependencies are deliberately few: an OAuth provider, object storage, an error
tracker, and an SMTP relay for account plumbing. **Why:** every external system is an
availability and privacy liability; the MVP keeps only what cannot be self-built.

---

## 2. Container Diagram (C4 Level 2)

```
                              ┌────────────────────────────────────────┐
                              │                 nginx                  │
                              │   TLS termination · reverse proxy ·    │
                              │   static serving for built frontends   │
                              └──────┬──────────────┬──────────────┬───┘
                            app.qalam.*     admin.qalam.*    api.qalam.*
                          ┌──────────▼─────┐ ┌───────▼────────┐ ┌──▼──────────────────────────┐
                          │   frontend     │ │     admin      │ │  backend (NestJS ^11,       │
                          │ React 19+Vite 7│ │ React 19+Vite 7│ │  Express adapter)           │
                          │ reader/writer  │ │ staff panel    │ │  modular monolith           │
                          │ app  :5173 dev │ │      :5174 dev │ │  /api/v1 · :4000 dev        │
                          └────────────────┘ └────────────────┘ │  ┌───────────────────────┐  │
                                                                │  │ HTTP modules (14)     │  │
                                   Swagger → /docs (non-prod)   │  ├───────────────────────┤  │
                                   → openapi.json → codegen     │  │ BullMQ workers        │  │
                                                                │  │ (in-process Phase 1,  │  │
                                                                │  │  extractable binary)  │  │
                                                                │  └───────────────────────┘  │
                                                                └───┬──────────┬──────────┬───┘
                                                                    │          │          │
                                       ┌────────────────────────────▼─┐  ┌─────▼──────┐  ┌▼─────────────────┐
                                       │ PostgreSQL 16          :5432 │  │ Redis 7    │  │ S3/MinIO   :9000 │
                                       │ system of record · FTS       │  │      :6379 │  │ bucket:          │
                                       │ (tsvector+GIN, simple+       │  │ DB0 cache  │  │  qalam-media     │
                                       │  unaccent+pg_trgm) ·         │  │ DB1 queues │  │ pre-signed       │
                                       │ analytics partitions ·       │  │ DB2 ratelim│  │ upload/download  │
                                       │ db: qalam / user: qalam      │  │ DB3 auth   │  │ (console :9001)  │
                                       └──────────────────────────────┘  └────────────┘  └──────────────────┘
```

| Container     | Technology                                                                     | Responsibility                                                                                                  | Why (ADR ref)                                                              |
| ------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| nginx         | nginx (dev + prod templates in `infrastructure/nginx/`)                        | TLS, routing by hostname, serving static frontend bundles                                                       | One boring, battle-tested edge; frontends build to static bundles (ADR §9) |
| frontend      | React ^19, Vite ^7, TanStack Query 5, Zustand 5, AntD 5 + Tailwind 4, TipTap 3 | The reader/writer product                                                                                       | ADR §6                                                                     |
| admin         | Same stack as frontend                                                         | Staff panel: users, pieces, reports, prompts, card templates, languages, featured, analytics, roles, audit logs | AntD-heavy tables/forms are its natural home (ADR §6)                      |
| backend       | NestJS ^11 (Express), TypeORM ^0.3, Pino                                       | All domain logic; single deployable containing HTTP modules **and** BullMQ workers                              | Modular monolith (ADR §1); Express for its middleware ecosystem (ADR §3)   |
| PostgreSQL 16 | + `citext`, `unaccent`, `pg_trgm`                                              | System of record, full-text search, partitioned analytics                                                       | One database until data proves otherwise (ADR §1, §4)                      |
| Redis 7       | Single instance, 4 logical DBs                                                 | Cache, BullMQ queues, rate limiting, auth token rotation/denylist                                               | Logical separation without operational sprawl (ADR §3)                     |
| S3/MinIO      | MinIO dev, S3/R2 prod                                                          | Media bytes; API never proxies file content                                                                     | Pre-signed URLs keep the API stateless about bytes (ADR §3)                |

---

## 3. The Modular Monolith

### PROBLEM

Greenfield product, small team, unknown traffic profile — and a _large_ domain:
publishing, social graph, feeds, search, analytics, moderation, media. We need domain
separation strong enough to keep 14 modules from tangling, without paying distributed-
systems costs on day one.

### APPROACH

One NestJS application organized as strict feature modules
(**controller → service → repository**), one PostgreSQL database, Redis for
cache/queues/rate-limiting, BullMQ workers running **in-process** initially and
extractable to a separate deployable later **without code changes** (workers already
communicate with the app only through queues and the database).

### TRADE-OFFS

|                            | Modular monolith                                            | Microservices                          |
| -------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| Transactions               | Local ACID (publish = one transaction)                      | Sagas/outboxes for the same guarantee  |
| Deploy/operate             | One artifact, one pipeline                                  | Per-service pipelines, discovery, mesh |
| Refactoring across domains | An IDE rename                                               | A versioned API migration              |
| Independent scaling        | Coarse (whole app) — mitigated by extraction seams          | Fine-grained                           |
| Failure isolation          | Weaker (one process) — mitigated by queues absorbing spikes | Stronger                               |
| Team cost                  | Fits a small team                                           | Consumes a small team                  |

### DECISION

**Modular monolith** (ADR §1). Module boundaries are _enforced_, not aspirational:

1. **No cross-module repository or entity imports.** A module's repositories and entities
   are private. The `feeds` module never touches `PieceRepository`; it calls the exported
   `PiecesService` surface.
2. **Communicate through exported services or events.** Synchronous needs: import the
   other module's NestJS module and inject its _exported_ service. Asynchronous/fan-out
   needs: emit a domain event or enqueue a BullMQ job. Nothing else crosses the line.
3. **DTOs own validation** (`class-validator`) at the HTTP boundary; services trust their
   inputs were validated.
4. **Repositories are the only TypeORM surface.** Services never touch query builders
   outside a repository (ADR §3) — this is what makes seam extraction honest.

**Extraction seams**, in the order we expect to use them:

| Seam                          | Trigger                                                                                      | Extraction cost                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `workers` (BullMQ processors) | Job latency competes with HTTP latency, or CPU-bound media/sharp work starves the event loop | Near zero — start the same codebase with a worker-only entrypoint; queues are already the interface                      |
| `search`                      | Postgres FTS quality/scale ceiling                                                           | Swap implementation behind `SearchService` for Meilisearch (designated successor — not Elasticsearch, too heavy; ADR §3) |
| `analytics`                   | Event write volume or rollup cost interferes with OLTP                                       | `analytics_events` is already append-only and partitioned; move ingestion + rollups behind its module interface          |

---

## 4. Backend Module Architecture

```
backend/src/
├── main.ts             # bootstrap: helmet, CORS, URI versioning, pipes, swagger, pino
├── app.module.ts
├── config/             # env.schema.ts (Zod, fail-fast) · app/database/redis/jwt/storage
├── common/             # exception filter → envelope · interceptors · decorators ·
│                       # base classes (AppException, BaseEntity) · shared types
├── database/           # data-source.ts (CLI) · migrations/ · seeds/
└── modules/            # ↓ the 14 Phase-1 modules (planned)
```

Every module follows the same internal anatomy — `*.module.ts`, `*.controller.ts`,
`*.service.ts`, `*.repository.ts` (custom repositories via `DataSource`), `entities/`,
`dto/` — so knowledge of one module is knowledge of all of them (see
`03_FolderStructure.md`).

---

## 5. Phase-1 Module Map (planned — not implemented)

**`auth`** — Registration, login, and session lifecycle. Email+password (Argon2id) and
Google OAuth (authorization code + PKCE); Apple deferred to Phase 2. Issues JWTs: access
15 min, rotating refresh 30 days, with refresh **reuse-detection denylist in Redis DB 3**.
Web clients get httpOnly `Secure` `SameSite=Lax` cookies; mobile gets tokens in the body
for secure storage. Owns `auth_identities`; strict rate-limit tiers on its endpoints.

**`users`** — Identity and the social graph. Owns `users`, `profiles`, `follows`,
`roles`/`user_roles`. Enforces the identity rules: `username` permanent, unique
(`citext`), 3–30 chars `^[a-z0-9_]+$`; one changeable `pen_name`; private-account flag on
the profile with enforcement in the query layer (visibility guards — not RLS, ADR §4).
Exports the visibility-checking service every read path depends on.

**`pieces`** — The heart of the domain: the written work's full lifecycle — draft →
preview → publish (with title, subtitle, cover image, featured quote, tags, genre,
language, visibility) → scheduled publish. Owns `pieces` and `piece_stats`, plus
`reposts` (repost|quote) and `responses` (piece → piece). Canonical content is TipTap
JSON (`content jsonb`); on write it derives `content_text` (for FTS), `word_count`, and
`reading_time_seconds`. Honors `Idempotency-Key` on publish. Enqueues `scheduled-publish`
jobs and emits the published event others fan out from.

**`taxonomy`** — The classification vocabulary: `languages`, `genres`, `tags`,
`piece_tags`. Languages are admin-managed and carry script/direction metadata — this is
where a piece learns it renders RTL. Kept separate from `pieces` so vocabulary governance
(admin CRUD, merging tags) never entangles content logic.

**`engagement`** — Lightweight social actions: `likes`, `claps` (transactional cap of 50
per user per piece, the constant living in `@qalam/shared`), `bookmarks`. Updates
denormalized `piece_stats` counters in the same transaction — never `COUNT(*)` on hot
paths (ADR §4) — and produces the events that feed notifications and trending.

**`collections`** — Curation: `collections`/`collection_pieces` (public, shareable,
Sana's showcases) and `reading_lists`/`reading_list_pieces` (personal queues). Distinct
from `engagement` because curation objects have their own lifecycle, visibility, and
ordering semantics rather than being simple toggles.

**`feeds`** — Read-side composition of the four tabs: **Following** (pieces from followed
writers), **Trending** (precomputed scores from the `trending-score` job), **Latest**,
**Discover**. Cursor-paginated (opaque base64, stable under insertion). Owns no tables —
it composes other modules' exported query surfaces and applies visibility guards. The
clearest beneficiary of the no-cross-repository rule.

**`search`** — Postgres FTS behind a deliberate `SearchService` interface: generated
`tsvector` columns + GIN indexes, `simple` config + `unaccent` + `pg_trgm` for honest
exact/fuzzy Hindi/Urdu matching (no stemmers exist for these languages). Searches
writers, titles, tags, genres, languages. The interface is the Meilisearch extraction
seam.

**`notifications`** — In-app notifications only (ADR §10). Consumes domain events via the
`notifications` queue, resolves recipients (respecting privacy and self-action
suppression), batch-inserts `notifications` rows, and serves unread counts and the
notification list. No email, no push — by decision, not omission.

**`analytics`** — The write funnel for `analytics_events` (append-only, monthly
partitions) and the read surface over `analytics_daily` rollups produced by the
`analytics-rollup` job; raw partitions pruned after 13 months. Powers the writer
dashboard (views, reads, reading time, completion, shares, followers, traffic, countries,
devices) and admin analytics. A designated extraction seam.

**`moderation`** — Reports pipeline (`reports`), moderation actions with RBAC
(`user < moderator < admin < super_admin`), and `audit_logs` written on **every** admin
mutation (ADR §8). Keeps trust-and-safety state machines out of content modules; `pieces`
knows a piece can be hidden, `moderation` knows why and by whom.

**`media`** — Pre-signed upload issuance (content-type and size validated _before_
signing), media records, and the `media-processing` worker: sharp re-encoding — which
strips EXIF/GPS as a security property, not a nicety — plus variant generation into the
`qalam-media` bucket. The API never proxies file bytes in either direction.

**`prompts`** — Daily writing prompts (`daily_prompts`): admin-curated, scheduled
publication, and the linkage from prompt to the pieces written in response. Small on
purpose; it exists to give Weekly Writers (the §6 metric in `01_ProjectVision.md`) a
reason to return.

**`admin`** — The admin panel's backend-for-frontend: dashboard aggregates,
`card_templates`, `featured_writers`, moderator/role management, and offset-paginated
(`?page&limit`) tables where admins need totals. Composes other modules' exported
services behind admin-only guards; owns only admin-specific tables.

---

## 6. Key Data Flows

### 6.1 Publish (immediate)

```
Writer(FE)          API /api/v1 (pieces)                Postgres              Redis/BullMQ
   │  POST /pieces/:id/publish                             │                       │
   │  Idempotency-Key: <uuid>                              │                       │
   ├──────────────────────────►│                           │                       │
   │                           │ 1. guards (auth, owner)   │                       │
   │                           │ 2. DTO validation         │                       │
   │                           │ 3. idempotency check ─────┼──────────────────────►│ (DB 0)
   │                           │ 4. derive from TipTap JSON:                       │
   │                           │    content_text · word_count · reading_time      │
   │                           │ 5. BEGIN ────────────────►│                       │
   │                           │    piece → published      │                       │
   │                           │    slug finalized         │                       │
   │                           │    piece_stats upsert     │                       │
   │                           │    COMMIT ───────────────►│                       │
   │                           │ 6. enqueue fan-out ───────┼──────────────────────►│ notifications
   │                           │                           │                       │ (DB 1)
   │◄──────────────────────────┤ { success: true, data: { piece } }                │
```

**Why:** steps 1–5 are synchronous because the writer must see truth immediately; follower
fan-out is asynchronous because it is unbounded work (anything > 2 s or retry-worthy is
queued — ADR §3).

### 6.2 Scheduled publish (BullMQ)

```
Writer(FE)        API (pieces)            Postgres         scheduled-publish queue      Worker
   │ publish with publishAt=T  │              │                      │                    │
   ├──────────────────────────►│              │                      │                    │
   │                           │ validate T > now                    │                    │
   │                           │ (else PIECE_SCHEDULE_IN_PAST)       │                    │
   │                           │ piece → scheduled ─────►│           │                    │
   │                           │ enqueue delayed job (delay = T-now, jobId = pieceId)     │
   │                           ├────────────────────────────────────►│                    │
   │◄── success (status: scheduled)                       │          │                    │
   │                                                      │          │   at T             │
   │                                                      │          ├───────────────────►│
   │                                                      │◄─── re-verify: still scheduled?
   │                                                      │     not deleted/withdrawn?   │
   │                                                      │◄─── same publish tx as 6.1 ──┤
   │                                                      │          │  enqueue fan-out   │
   │                                                      │          │◄───────────────────┤
```

**Why re-verify at fire time:** the writer may have edited, unscheduled, or deleted the
piece during the delay; the job payload is a _reference_ (piece id as `jobId`, which also
gives delete-and-replace rescheduling), never a snapshot. Missed schedules break writer
trust — this queue's failure rate is a guardrail metric (`01_ProjectVision.md` §6).

### 6.3 Feed request — Following vs. Trending

```
Reader(FE)         API (feeds)                 users/pieces (services)        Postgres / Redis
   │ GET /feeds?tab=following&cursor=…&limit=20     │                              │
   ├──────────────►│                                │                              │
   │               │ decode opaque cursor (base64: last published_at + id)         │
   │               │ following ids ────────────────►│ (users svc)                  │
   │               │ pieces keyset query ──────────►│ (pieces svc) ───────────────►│ PG:
   │               │   WHERE author IN (…)          │   visibility guards applied  │ keyset <
   │               │                                │   (private accounts, etc.)   │ (pub_at,id)
   │◄──────────────┤ { data: [...], meta: { nextCursor } }                         │
   │
   │ GET /feeds?tab=trending&cursor=…
   ├──────────────►│                                                               │
   │               │ read precomputed ranking ────────────────────────────────────►│ Redis DB 0
   │               │   (materialized by the trending-score job on its schedule;    │ (cache) →
   │               │    cache miss → scores persisted with piece_stats)            │ PG fallback
   │◄──────────────┤ hydrate pieces via pieces svc; same envelope + cursor         │
```

**Why cursor, not offset:** feeds mutate constantly; offsets skip or duplicate rows under
insertion, cursors do not (ADR §5). **Why trending is precomputed:** the `trending-score`
job turns the hottest read path into a lookup; minutes of ranking staleness is imperceptible.

### 6.4 Search (Postgres FTS)

```
Reader(FE)          API (search)                        PostgreSQL 16
   │ GET /search?q=ग़ज़ल&type=pieces&cursor=…               │
   ├───────────────►│                                       │
   │                │ SearchService.search(q, filters)      │
   │                │  1. normalize: unaccent, lower ──────►│
   │                │  2. FTS: tsquery ('simple') against   │
   │                │     generated tsvector (GIN index)    │
   │                │  3. low recall? → pg_trgm similarity  │
   │                │     fallback (fuzzy/partial match)    │
   │                │  4. rank, apply visibility guards     │
   │◄───────────────┤ pieces | writers | tags | genres | languages
```

**Why `simple` + trigram, not a language config:** Postgres has no Hindi/Urdu stemmers; a
stemming config would silently mangle these languages. `simple` + `unaccent` + `pg_trgm`
gives _honest_ exact and fuzzy matching (ADR §3). All access goes through
`SearchService` — the Meilisearch seam.

### 6.5 Notification fan-out

```
engagement/pieces (producer)     notifications queue        Worker              Postgres        Reader(FE)
   │ event: piece published /          │                      │                    │               │
   │ like / clap / follow / response   │                      │                    │               │
   ├──────── enqueue ─────────────────►│ (Redis DB 1)         │                    │               │
   │                                   ├─────────────────────►│                    │               │
   │                                   │   resolve recipients (followers query,    │               │
   │                                   │   privacy rules, suppress self-actions)   │               │
   │                                   │                      ├── batch INSERT ───►│ notifications │
   │                                   │            GET /notifications · GET /notifications/unread-count
   │                                   │                      │                    │◄──────────────┤
```

**Why queued:** fan-out size is unbounded (a writer with 50k followers must not slow a
like to a crawl). **Why in-app only:** ADR §10 — there is no email/push channel to fan
into, by decision. Request IDs propagate from the originating HTTP request into the job
for traceability (ADR §9).

### 6.6 Media upload (pre-signed)

```
Writer(FE)            API (media)                S3/MinIO (qalam-media)     media-processing queue/Worker
   │ POST /media/upload-url                            │                         │
   │ { contentType, size, purpose }                    │                         │
   ├─────────────────►│                                │                         │
   │                  │ validate content-type + size   │                         │
   │                  │ create media row (pending)     │                         │
   │                  │ pre-sign PUT ──────────────────►                         │
   │◄─────────────────┤ { uploadUrl, mediaId }         │                         │
   │  PUT bytes ─ direct, API never proxies ──────────►│                         │
   │ POST /media/:id/complete                          │                         │
   ├─────────────────►│ enqueue ──────────────────────────────────────────────►│
   │◄── success ──────┤                                │                         │ sharp: re-encode
   │                  │                                │◄── variants written ────┤ (strips EXIF/GPS),
   │                  │      media row → ready, variant keys recorded            │ resize variants
```

**Why pre-signed:** file bytes never transit the API — no memory pressure or upload
timeouts on the app tier (ADR §3). **Why re-encode:** re-encoding _is_ the EXIF/GPS
stripping mechanism — a privacy guarantee enforced in the pipeline, not a policy (ADR §8).

---

## 7. BullMQ Queue Catalogue & Redis Map

All queues live in **Redis DB 1**. Rule of thumb (ADR §3): _anything over 2 seconds or
worth retrying is a job._ Workers run in-process in Phase 1 and are the first extraction
seam.

| Queue               | Producer                                 | Job does                                                                                                         | Timing                             |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `scheduled-publish` | `pieces` on schedule request             | Re-verify state, run the publish transaction, trigger fan-out                                                    | Delayed jobs (fire at `publishAt`) |
| `notifications`     | `pieces`, `engagement`, `users` (follow) | Resolve recipients, batch-insert in-app notification rows                                                        | On event                           |
| `media-processing`  | `media` on upload completion             | sharp re-encode (strip EXIF/GPS), generate variants, mark ready                                                  | On event                           |
| `analytics-rollup`  | Scheduler (repeatable)                   | Aggregate `analytics_events` partitions into `analytics_daily`; prune raw partitions > 13 months                 | Nightly                            |
| `trending-score`    | Scheduler (repeatable)                   | Recompute trending scores from `piece_stats` + recent events; materialize ranking (Redis DB 0 cache + persisted) | Periodic (minutes)                 |
| `emails`            | `auth` (and future transactional needs)  | Send transactional auth mail (e.g. password reset) via SMTP — mailpit in dev                                     | On event                           |

Counter reconciliation (the nightly `piece_stats` audit, ADR §4) runs as a repeatable job
alongside `analytics-rollup`.

**Redis logical DB map** (one instance, four namespaces — ADR §3):

| DB  | Purpose       | Notes                                                                     |
| --- | ------------- | ------------------------------------------------------------------------- |
| 0   | Cache         | Feed/trending materializations, idempotency keys, hot lookups             |
| 1   | Queues        | All BullMQ queues above                                                   |
| 2   | Rate limiting | Sliding window per user/IP; `X-RateLimit-*` headers; strict tiers on auth |
| 3   | Auth          | Refresh-token rotation state + reuse-detection denylist                   |

**Why logical DBs, not instances:** real key-namespace separation (flush cache without
touching queues) at zero operational cost; split into instances only when load demands.

---

## 8. Scaling Path

Staged, boring, and data-triggered — each step is prepared for _now_ but executed only
when measurements demand it:

```
Stage 0: single node  →  Stage 1: vertical    →  Stage 2: read replicas   →  Stage 3: worker extraction
(everything on one       (bigger PG/Redis/       (PG streaming replicas       (same codebase, worker-only
 box via compose/         app boxes;              take feeds/search/           entrypoint on separate compute;
 nginx)                   measure first)          analytics reads; writes      HTTP tier stops sharing CPU
                                                  stay on primary)             with sharp/rollups)
                                            … then, only if data demands: search / analytics seams
```

1. **Vertical first.** A well-indexed Postgres 16 on capable hardware carries this
   read-heavy workload far beyond launch scale; Postgres will bottleneck long before
   Express does (ADR §3), and this step costs zero architectural change.
2. **Read replicas.** Feeds, search, and analytics reads move to replicas; read/write
   routing lands in exactly one layer — repositories — because services never touch
   TypeORM directly.
3. **Worker extraction.** Deploy the same artifact with a worker-only entrypoint. Queues
   and Postgres are already the only interface between HTTP and workers, so this is an
   infrastructure change, not a refactor.
4. **Then, only if data demands:** `search` → Meilisearch behind `SearchService`;
   `analytics` ingestion/rollup extracted behind its module boundary. Full microservice
   decomposition is explicitly **not** on this path (ADR §1).

Operational envelope throughout: migrations as a deploy step (never at boot), `/health` +
`/health/ready` (Terminus) probes, Pino JSON → stdout → collector, Sentry release-tagged
on both tiers, request IDs propagated frontend → API → queue jobs (ADR §9).
