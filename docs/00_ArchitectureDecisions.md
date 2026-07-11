# 00 — Architecture Decision Record (Master)

> **Status:** Living document. This is the single source of truth for every architectural
> decision in the platform. All other documents (01–18), the scaffold, and `CLAUDE.md`
> derive from this file. When a decision changes, it changes **here first**.

---

## 0. Product Identity

- **Working codename:** **Qalam** (قلم / क़लम — _"the pen"_). Chosen because it is shared
  vocabulary between Urdu and Hindi, our launch audiences. Rename is a find/replace on the
  `@qalam/*` package scope; nothing else couples to it.
- **Product:** A global creative writing platform — _"a premium writing sanctuary."_
- **Launch audience:** Hindi and Urdu writers. **Urdu is RTL — right-to-left support is a
  day-one architectural requirement, not a Phase 2 retrofit.**
- **Growth path:** Global multilingual writers.

## 1. System Shape — Modular Monolith

**PROBLEM.** Greenfield product, small team, unknown traffic profile, large domain
(publishing, social, search, analytics, moderation).

**APPROACH.** One NestJS application organized as strict feature modules
(controller → service → repository), one PostgreSQL database, Redis for
cache/queues/rate-limiting, BullMQ workers in-process initially (extractable to a separate
deployable later without code changes).

**TRADE-OFFS.** Microservices give independent scaling but cost distributed transactions,
service discovery, and operational burden a small team cannot pay. A modular monolith with
enforced module boundaries gives us 90% of the extraction benefit with 10% of the cost.

**DECISION.** Modular monolith. Module boundaries are enforced (no cross-module repository
imports; modules communicate through exported services or events). Extraction seams:
`workers` (BullMQ processors), `search`, `analytics`.

```
                    ┌─────────────────────────────────────────────┐
                    │                   nginx                     │
                    └──────┬───────────────┬──────────────┬───────┘
                   app.qalam.*      admin.qalam.*    api.qalam.*
                    ┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼──────────────┐
                    │  frontend   │ │    admin    │ │  NestJS API        │
                    │ React+Vite  │ │ React+Vite  │ │  (modular monolith)│
                    └─────────────┘ └─────────────┘ │  + BullMQ workers  │
                                                    └───┬─────┬─────┬────┘
                                              ┌─────────▼─┐ ┌─▼───────┐ ┌▼──────────┐
                                              │ PostgreSQL│ │  Redis  │ │ S3/MinIO  │
                                              │ 16 (FTS)  │ │cache/queue│ │  media   │
                                              └───────────┘ └─────────┘ └───────────┘
```

## 2. Monorepo & Toolchain

| Decision          | Choice                                                      | Why (vs. alternative)                                                                                                                                               |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager   | **pnpm 9 workspaces**                                       | Strict node_modules (no phantom deps), content-addressed store, `workspace:*` protocol. npm/yarn hoisting hides dependency bugs.                                    |
| Task runner       | **Turborepo 2**                                             | Task graph + local/remote caching with near-zero config. Nx is more powerful but far more opinionated/invasive; we don't need generators or module federation.      |
| Node              | **24 LTS** (`.nvmrc`, `engines >= 22`)                      | Current LTS on the host; native `fetch`, stable test runner.                                                                                                        |
| TypeScript        | **^5.x, `strict: true` everywhere**                         | Non-negotiable. Shared base configs in `@qalam/config`.                                                                                                             |
| Lint/format       | **ESLint 9 flat config + Prettier 3**                       | Flat config is the present and future of ESLint; shared config exported from `@qalam/config`.                                                                       |
| Git hooks         | **husky + lint-staged + commitlint** (conventional commits) | Cheap enforcement at the edge; CI re-verifies.                                                                                                                      |
| Internal packages | **Built with tsup (ESM + d.ts), consumed as `workspace:*`** | Source-consumption breaks the NestJS tsc pipeline; building packages keeps every consumer (Vite, Nest, future RN/CLI) uniform. Turbo `dependsOn: ^build` orders it. |

**Workspace layout** (repo root = this directory; GitHub workflows must live at `.github/`
— that is a GitHub platform requirement, so `infrastructure/github/` from the original
brief is realized as `.github/` at root):

```
platfrom/                       # repo root (existing dir name kept)
├── backend/                    # NestJS API + workers
├── frontend/                   # Reader/writer app (React + Vite)
├── admin/                      # Admin panel (React + Vite)
├── packages/
│   ├── shared/                 # @qalam/shared     — domain constants, enums, error codes
│   ├── api-types/              # @qalam/api-types  — OpenAPI-generated + handwritten API types
│   ├── ui/                     # @qalam/ui         — design tokens, AntD theme, primitives
│   ├── config/                 # @qalam/config     — tsconfig/eslint/prettier presets
│   └── utils/                  # @qalam/utils      — pure functions (slugify, readingTime…)
├── infrastructure/
│   ├── docker/                 # Dockerfiles (backend, frontend, admin)
│   └── nginx/                  # reverse-proxy configs (dev + prod templates)
├── .github/workflows/          # CI pipelines
├── docs/                       # 00–18 architecture documents
├── docker-compose.yml          # dev infra (postgres, redis, minio, mailpit) + full profile
├── turbo.json / pnpm-workspace.yaml / package.json
└── CLAUDE.md                   # engineering handbook (AI + human onboarding)
```

**Package responsibilities (keep these disjoint):**

- `@qalam/shared` — _what the domain knows_: enums (`PieceStatus`, `Visibility`, `Role`),
  error-code catalogue, limits (`MAX_CLAPS_PER_USER = 50`), regexes (`USERNAME_REGEX`).
- `@qalam/utils` — _how to compute_: pure, dependency-free functions.
- `@qalam/api-types` — _the wire contract_: generated from the backend's OpenAPI spec
  (`openapi-typescript`) + handwritten request/response helpers. Flutter generates Dart
  models from the same `openapi.json` — one contract, three consumers.
- `@qalam/ui` — _how it looks_: design tokens (CSS variables), AntD theme object,
  Tailwind preset, shared primitives.
- `@qalam/config` — _how we build_: `tsconfig/base|nest|react`, `eslint/base|nest|react`,
  `prettier` preset.

## 3. Backend Decisions (NestJS)

| Area      | Decision                                                                                                                                                                                                                                    | Rationale                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework | NestJS ^11, Express adapter                                                                                                                                                                                                                 | Fastify is faster but Express has the broadest middleware ecosystem (helmet, rate-limit) and the team's global conventions assume it. Revisit only if HTTP throughput becomes the bottleneck (it won't — Postgres will). |
| Layering  | controller → service → repository (custom repositories via `DataSource`), DTOs own validation (`class-validator`)                                                                                                                           | Repository pattern isolates TypeORM; services never touch query builders directly outside repositories.                                                                                                                  |
| Config    | `@nestjs/config` + **Zod-validated env** (fail-fast at boot)                                                                                                                                                                                | Zod is already in the stack; one validation vocabulary across the whole platform.                                                                                                                                        |
| Logging   | **Pino** (`nestjs-pino`) — chosen over Winston                                                                                                                                                                                              | 5–10× faster, JSON-native, built-in redaction, request-scoped child loggers with correlation IDs. Winston's transports are its only edge; we ship JSON to stdout → collector anyway.                                     |
| Errors    | Global exception filter → error envelope (§5); domain errors extend `AppException` with catalogue codes                                                                                                                                     |                                                                                                                                                                                                                          |
| Auth      | JWT **access 15 min** + **rotating refresh 30 days**; web: httpOnly `Secure` `SameSite=Lax` cookie; mobile: body + secure storage. Argon2id hashing. Google OAuth (code + PKCE); Apple deferred. Refresh reuse-detection denylist in Redis. |                                                                                                                                                                                                                          |
| Queues    | BullMQ. Named queues: `scheduled-publish`, `notifications`, `media-processing`, `analytics-rollup`, `trending-score`, `emails`                                                                                                              | Anything > 2 s or retry-worthy is queued. Workers run in-process Phase 1, extractable binary later.                                                                                                                      |
| Redis map | DB 0 cache · DB 1 queues · DB 2 rate-limit · DB 3 auth (refresh rotation / denylist)                                                                                                                                                        | Logical separation, one instance.                                                                                                                                                                                        |
| Media     | S3-compatible storage (MinIO dev, S3/R2 prod), pre-signed upload URLs, `sharp` processing in `media-processing` worker                                                                                                                      | API never proxies file bytes.                                                                                                                                                                                            |
| Search    | **PostgreSQL FTS** — generated `tsvector` columns + GIN; **`simple` config + `unaccent` + `pg_trgm`** for Hindi/Urdu                                                                                                                        | Postgres has no Hindi/Urdu stemmers; `simple` + trigram gives honest exact/fuzzy matching. Swappable behind `SearchService` if we outgrow it (Meilisearch is the designated successor — not Elasticsearch, too heavy).   |
| API docs  | Swagger decorators → `/docs` (non-prod) → exported `openapi.json` → codegen pipeline                                                                                                                                                        | The spec is a build artifact, not documentation-after-the-fact.                                                                                                                                                          |
| Testing   | Jest 29 (unit + e2e w/ Supertest, Testcontainers later)                                                                                                                                                                                     |                                                                                                                                                                                                                          |

**Backend folder shape** (foundation now; modules are Phase 1):

```
backend/src/
├── main.ts                    # bootstrap: helmet, CORS, versioning, pipes, swagger, pino
├── app.module.ts
├── config/                    # env.schema.ts (Zod), app/database/redis/jwt/storage config
├── common/                    # filters, interceptors, decorators, base classes, types
├── database/                  # data-source.ts (CLI), migrations/, seeds/
└── modules/                   # Phase 1: auth, users, pieces, taxonomy, engagement,
                               # collections, feeds, search, notifications, analytics,
                               # moderation, media, prompts, admin
```

## 4. Database Decisions (PostgreSQL 16 + TypeORM)

- **Naming:** snake_case columns, plural table names, `SnakeNamingStrategy`.
- **PKs:** **UUIDv7, application-generated** (time-ordered → index-friendly, unlike v4;
  PG16 has no native v7). Public URLs use `slug` / `username`, never raw IDs.
- **Base columns:** `id`, `created_at`, `updated_at`, `deleted_at` (soft delete where the
  domain needs recoverability: users, pieces, collections — not on join/event tables).
- **Migrations only** — `synchronize: false` always, including dev. Migrations are
  generated, reviewed (`/migration-check`), and immutable once merged.
- **Content storage:** TipTap **JSON is canonical** (`content jsonb`); derived
  `content_text` (for FTS `tsvector`) and `reading_time_seconds` / `word_count` computed
  on write. HTML is rendered, never stored as source of truth.
- **Counters:** denormalized `piece_stats` (likes/claps/bookmarks/views…) maintained
  transactionally + reconciled by nightly job. Never `COUNT(*)` on hot paths.
- **Analytics:** append-only `analytics_events`, **monthly partitions**, rolled up by
  BullMQ into `analytics_daily` aggregates; raw partitions pruned after 13 months.
- **Core tables** (full ERD in `04_DatabaseDesign.md`): `users`, `auth_identities`,
  `profiles`, `follows`, `pieces`, `piece_stats`, `languages`, `genres`, `tags`,
  `piece_tags`, `likes`, `claps` (count ≤ 50/user), `bookmarks`, `collections`,
  `collection_pieces`, `reading_lists`, `reading_list_pieces`, `reposts` (type:
  repost|quote), `responses` (piece→piece), `notifications`, `reports`, `roles`,
  `user_roles`, `audit_logs`, `daily_prompts`, `card_templates`, `featured_writers`,
  `analytics_events`, `analytics_daily`.
- **Identity rules:** `username` — permanent, unique (`citext`), immutable after creation,
  3–30 chars `^[a-z0-9_]+$`. One `pen_name` per user, changeable. Private accounts:
  boolean on profile; enforcement in query layer (visibility guards), not row-level
  security (RLS is overkill for one-tenant social visibility and complicates every query).

## 5. API Standards

- **Style:** REST, JSON, URI-versioned `/api/v1/...` (header versioning is invisible and
  cache-hostile; URI versioning is boring and correct).
- **Envelope:**
  ```jsonc
  { "success": true,  "data": …, "meta": { /* pagination etc. */ } }
  { "success": false, "error": { "code": "PIECE_NOT_FOUND", "message": "…", "details": [], "requestId": "…" } }
  ```
- **Error codes:** `DOMAIN_REASON` catalogue in `@qalam/shared` (e.g.
  `AUTH_INVALID_CREDENTIALS`, `PIECE_SCHEDULE_IN_PAST`). HTTP status still meaningful.
- **Pagination:** **cursor-based for feeds/timelines** (`?cursor&limit`, opaque base64,
  stable under insertion), offset-based for admin tables (`?page&limit`, needs totals).
- **Conventions:** kebab-case paths, camelCase JSON, plural resources, `PATCH` partial
  updates, `Idempotency-Key` honored on unsafe retried endpoints (Phase 1: publish).
- **Rate limits:** Redis sliding window per user/IP; headers `X-RateLimit-*`; strict
  tiers on auth endpoints.

## 6. Frontend & Admin Decisions (React + Vite)

| Area         | Decision                                                                                                                                                                                                                                                                                                               | Rationale                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Core         | React ^19, Vite ^7, TS strict                                                                                                                                                                                                                                                                                          |                                                                     |
| Server state | **TanStack Query v5 only** — never mirrored into Zustand                                                                                                                                                                                                                                                               | One cache, one invalidation model.                                  |
| Client state | **Zustand v5** slices (theme, editor UI, session)                                                                                                                                                                                                                                                                      | Redux is ceremony we don't need; Context re-renders too broadly.    |
| Forms        | React Hook Form + Zod resolvers; Zod schemas shared with API layer                                                                                                                                                                                                                                                     |                                                                     |
| URL state    | React Router v7 (data APIs); URL is the source of truth for tabs/filters/search                                                                                                                                                                                                                                        |                                                                     |
| UI kit       | **AntD 5 + Tailwind 4**: AntD for complex widgets (tables, dialogs, pickers — admin-heavy), Tailwind for layout/spacing/custom literary surfaces. **Conflict rule:** Tailwind preflight disabled; tokens defined once as CSS variables in `@qalam/ui` and fed to _both_ AntD `ConfigProvider` theme and Tailwind theme | Two systems, one token source — no drift, no specificity wars.      |
| Dark mode    | Class-strategy (`data-theme` on `<html>`), AntD dark algorithm, persisted + system-default, **day one**                                                                                                                                                                                                                |                                                                     |
| RTL          | `dir` switches per content language (Urdu `rtl`); **CSS logical properties only** (`ms-*`/`me-*`, `ps-*`/`pe-*` — never `ml-*`/`mr-*`); AntD `direction` prop                                                                                                                                                          | Retrofit costs 10× — banned by lint rule from day one.              |
| Editor       | TipTap 3; custom extensions Phase 1: footnotes, mentions, hashtags; marks: bold/italic/underline/align/blockquote/lists                                                                                                                                                                                                |                                                                     |
| Motion       | Framer Motion; durations 150/250/400 ms; respects `prefers-reduced-motion`                                                                                                                                                                                                                                             |                                                                     |
| API layer    | Centralized typed `fetch` wrapper (`lib/api-client.ts`) + per-feature query hooks; types from `@qalam/api-types`; no ad-hoc fetches in components                                                                                                                                                                      |                                                                     |
| Structure    | `app/` (providers, router) · `features/<name>/{api,components,hooks,stores}` · `components/` (app-wide composites) · shared primitives in `@qalam/ui`                                                                                                                                                                  | Feature-first; a feature can be deleted in one `rm -rf`.            |
| Testing      | **Vitest** + Testing Library (not Jest — native Vite pipeline, same config, faster)                                                                                                                                                                                                                                    |                                                                     |
| i18n         | UI-chrome i18n deferred to Phase 1 (`react-i18next` planned); _content_ language/direction handling is day one                                                                                                                                                                                                         | Don't confuse UI language with content language — independent axes. |

**Fonts** (self-hosted via @fontsource, no CDN — privacy + perf):
UI: **Inter** (+ Noto Sans Devanagari / Noto Naskh Arabic per script) · Reading: **Lora**
(Latin), **Noto Serif Devanagari** (Hindi), **Noto Nastaliq Urdu** (Urdu — line-height ≥ 2,
larger base size; Nastaliq is vertically demanding) · Mono: JetBrains Mono.

## 7. Design Tokens (canonical values)

_"Warm paper and ink."_ Literary, calm, generous whitespace. Writing is the hero.

| Token                                   | Light                                   | Dark                        |
| --------------------------------------- | --------------------------------------- | --------------------------- |
| `--q-bg-canvas`                         | `#FAF7F1` (warm paper)                  | `#131110` (warm near-black) |
| `--q-bg-surface`                        | `#FFFFFF`                               | `#1C1917`                   |
| `--q-bg-raised`                         | `#F3EEE5`                               | `#26221E`                   |
| `--q-text-primary`                      | `#24211B` (ink)                         | `#ECE6DA`                   |
| `--q-text-secondary`                    | `#6B655A`                               | `#A69F90`                   |
| `--q-text-muted`                        | `#8F887A`                               | `#7A7367`                   |
| `--q-border`                            | `#E7E1D6`                               | `#2E2A24`                   |
| `--q-accent`                            | `#9E4B28` (terracotta ink)              | `#D07349`                   |
| `--q-accent-hover`                      | `#B45A32`                               | `#DD8A63`                   |
| `--q-success / warning / danger / info` | `#3E7C4F / #A97A1F / #B3382E / #3B6EA8` | warm-shifted variants       |

- **Type scale:** 1.25 ratio — 12/14/16/20/25/31/39/49. Reading column: 65–72ch,
  18–20px serif, line-height 1.7 (Latin) / 2.1 (Nastaliq).
- **Spacing:** 4px base — 4/8/12/16/24/32/48/64/96.
- **Radii:** 6 (controls) / 10 (cards) / 16 (modals). **Elevation:** 3 soft warm-tinted
  shadow levels; borders preferred over shadows in dark mode.
- **Breakpoints:** Tailwind defaults (640/768/1024/1280/1536).
- **A11y:** WCAG 2.1 AA contrast, visible focus rings (`--q-accent` 2px offset), full
  keyboard nav, reduced-motion variants. Non-negotiable.

## 8. Security Baseline

Helmet + strict CSP · CORS allowlist per app origin · Argon2id · JWT rotation with reuse
detection · Zod/class-validator at every boundary · TypeORM parameterization only (no raw
string interpolation, enforced in review) · pre-signed uploads with content-type/size
validation + image re-encoding (strips EXIF/GPS) · RBAC (`user < moderator < admin <
super_admin`) via decorators + guards · audit log on every admin mutation · rate limiting
(Redis) · secrets via env only (no secrets in repo; `.env.example` documents shape) ·
Sentry scrubbing + Pino redaction of PII/tokens. Full threat model in
`13_SecurityArchitecture.md`.

## 9. Delivery & Operations

- **Docker:** multi-stage builds per app (pnpm fetch → build → distroless/alpine runtime,
  non-root). Frontends build to static bundles served by nginx.
- **docker-compose:** default profile = infra only (postgres 16, redis 7, minio, mailpit)
  — apps run via `pnpm dev` for hot reload; `--profile full` runs everything containerized.
- **CI (GitHub Actions):** `ci.yml` — pnpm + turbo cache → lint → typecheck → test →
  build, on PR + main. Conventional-commit title check on PRs. Deploy workflows are
  environment-templated (staging auto on main, production on tag + manual approval).
- **Environments:** local → staging → production. Migrations run as a deploy step
  (never at app boot).
- **Observability:** Pino JSON → stdout → collector; Sentry (BE + FE, release-tagged
  sourcemaps); request IDs propagated `frontend → API → queue jobs`; `/health` +
  `/health/ready` (Terminus, Phase 1) for orchestrator probes.

## 10. Canonical Reference (contract for all documents & scaffold)

**Ports/URLs (dev):** API `4000` (`/api/v1`, docs at `/docs`) · frontend `5173` ·
admin `5174` · postgres `5432` (`qalam` / user `qalam`) · redis `6379` · MinIO `9000`
(console `9001`, bucket `qalam-media`) · mailpit SMTP `1025` / UI `8025`.

**Env vars (backend):** `NODE_ENV`, `PORT`, `APP_URL`, `ADMIN_URL` (CORS allowlist),
`API_URL`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`,
`JWT_REFRESH_SECRET`, `JWT_REFRESH_TTL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `SMTP_URL`,
`SENTRY_DSN`, `LOG_LEVEL`.
**Frontend/admin:** `VITE_API_URL`, `VITE_SENTRY_DSN`, `VITE_APP_ENV`.

**Route map (frontend):** `/` · `/feed` (tabs: following/trending/latest/discover — tab in
URL) · `/p/:slug` · `/@:username` · `/write`, `/write/:draftId` · `/search` ·
`/tag/:slug`, `/genre/:slug` · `/me/{drafts,stats,bookmarks,lists,collections}` ·
`/settings/{profile,account,appearance}` · `/auth/{login,register,forgot-password,reset-password}`.
**Admin:** `/login` · `/dashboard` · `/users` · `/pieces` · `/reports` ·
`/card-templates` · `/prompts` · `/languages` · `/featured` · `/analytics` ·
`/moderators` · `/roles` · `/audit-logs`.

**Product decisions locked by the brief:** email+password & Google auth (Apple later) ·
AI and payments entirely Phase 2 · Postgres FTS · in-app notifications only · no offline ·
private accounts supported · permanent username, single pen name · one language per piece ·
editor marks: bold, italic, underline, alignment, blockquote, lists, footnotes, mentions,
hashtags · publishing: draft → preview → publish with title, subtitle, cover image,
featured quote, tags, genre, language, visibility, scheduled publish · feed tabs:
Following/Trending/Latest/Discover · search by writer/title/tag/genre/language · social:
like, clap, bookmark, collections, reading lists, share, repost, quote, write response ·
analytics: views, reads, reading time, completion, shares, followers, traffic, countries,
devices · admin: dashboard, users, pieces, reports, card templates, daily prompts,
languages, featured writers, analytics, moderators, roles, audit logs.

**E12.8 build amendment (System Settings).** The admin completion track (E12.5 users,
E12.6 moderation, E12.7 reports/audit) is extended with a **System Settings** backend —
beyond the brief's locked admin list above (which named settings/config as neither in nor
out). Backs Phase-4 Epic A7 (admin settings UI); additive-only over the frozen `v1` contract
(docs 25), no reader-API change:

- Two new tables — **`settings`** (a generic key-value configuration store) and
  **`feature_flags`** (per-flag rollout) — see `04_DatabaseDesign.md` §3.8. Deliberately
  schema-flexible: a new setting is a new ROW (boot-seeded from a TypeScript catalogue), never
  a new column, so Phase-2+ config (AI, Payments, Mobile, Creator Economy) lands without a
  migration (§1.7 open-set rule).
- Endpoints under `/admin/settings`, `/admin/feature-flags`, `/admin/maintenance`; gated on
  the existing `settings.manage` PBAC grant (admin+, already in `@qalam/shared`). Reuses the
  shared audit trail (every mutation → `audit_logs`) and Redis cache (DB 0, invalidated on
  write). **Maintenance mode** is the `maintenance.*` settings rows — no separate table.
- Secrets stay in env only (ADR §8) — the store holds **non-secret operational config** only.

**E12.9 build amendment (Platform Analytics).** The admin completion track is extended
with **administrator platform analytics** — insights about the whole platform, distinct
from the writer/reader analytics on `/analytics/*`. Additive-only over frozen `v1`; **no new
tables** (reuses the E10 analytics read-model + snapshots):

- New endpoints under `/admin/analytics/*` — `overview`, `users`, `content`, `engagement`,
  `moderation`, `system`, and a streaming `export` (CSV/JSON). Served by a thin
  `AdminAnalyticsController` in the **existing `AnalyticsModule`**; all logic lives in
  `AnalyticsService` (no `PlatformAnalyticsModule`/`AdminAnalyticsService` created).
- Reuses without duplication: the analytics read-model (`AnalyticsQueryRepository`,
  extended with platform aggregations), `ModerationService.getStatistics` (E12.7) for the
  moderation section, the `@Global` `QueueRegistry` (system queue/worker depth), Redis INFO
  (cache hit ratio), and `pg_database_size` (DB storage). Gated on `analytics.view` (PBAC);
  the export is audited (`analytics.export`).
- Caching reuses `AnalyticsCacheService` (Redis DB 0, short TTL) and the **existing** cron +
  cache-warmer (the analytics warm target now also warms the admin overview + system caches);
  no new queue/job introduced.
- **Honest gaps (no mock data):** geo/device are not captured by the tracking model → Top
  Countries/Devices return empty and the country/device/platform filters are inert; object
  storage (MinIO) usage is not tracked; per-node API-request/error-rate live in the in-memory
  Prometheus `/metrics` (returned null here, not cross-node aggregated).

**E7 build amendment (Social & Curation).** The engagement epic added, beyond the
brief's locked social list above:

- **Comments + threaded replies** (max nesting depth 3). Not in the original locked list
  (18 §risk-6 named comments as scope creep to resist); added as a first-class Phase-1
  engagement surface at product request. New `comments` table (soft-deletable,
  self-referential `parent_id` adjacency list); a deleted comment persists as a tombstone
  so its replies stay visible. See `04_DatabaseDesign.md` §3.4.
- A dedicated **`shares` table** (append-only, `share_channel` native enum) backing the
  existing `piece_stats.shares_count`. Phase 1 stores the count only — no analytics
  dashboard (that stays Phase 1.5+). The brief already listed `share`; this records the
  physical model chosen.
- `piece_stats.comments_count` (for the new comments) and `collections.is_default` (the
  auto-created "Favorites" collection every user gets) — both recorded in `04` §3.4/§3.5.

Reading lists, reposts, and quotes from the locked list remain **unbuilt** (deferred to a
later E7 slice); this amendment does not remove them.

**E6 build amendment (Feeds & Discovery).** Feeds reuse existing entities — **no new
tables** (the brief's optional `FeedScore`/`TrendingCache` were judged unnecessary):

- **Trending is computed on-the-fly and cached in Redis** (DB 0) as a top-N ranked
  snapshot with a short TTL (the recompute cadence), then keyset-paginated in memory. This
  deviates from `18` E6 task 4 / `04` §7 layer 3, which envisioned a BullMQ `trending-score`
  job persisting `piece_stats.trending_score` — background workers are out of scope for this
  epic, so the column stays unused for now and the job remains the future path (same score
  formula, swap the compute trigger). The scoring weights are **env-configurable**
  (`TRENDING_*`); the algorithm lives in `feed/scoring/trending-scoring.ts`.
- **Featured writers** are derived heuristically (recent engagement) pending the
  `featured_writers` table + editorial curation (E10) — the endpoint contract is stable.
- Discovery caches (featured writers, trending tags, popular-writers first page) use the
  same Redis DB 0 + TTL; explicit `FeedCacheService.invalidate*()` methods exist for a future
  domain-event wiring. New supporting indexes (`04` §3.2/§3.14): `idx_pieces_author_published`,
  `idx_piece_stats_claps`, `idx_piece_stats_comments`. Search is **not** part of this epic (E8).

**E11 build amendment (Asynchronous Processing Infrastructure).** The dedicated
`src/infrastructure/` module (Queue · Worker · Scheduler · Cache · Monitoring) turns on the
BullMQ layer the earlier epics deferred, activating the previously-unused paths noted above.
No new database tables.

- **Queue catalogue extended.** The six canonical queues (§3 Queues row) are unchanged and
  authoritative. Three queues are added: **`cache`** (warming / refresh / weekly
  optimization), **`maintenance`** (token / notification / soft-delete cleanup + weekly
  `ANALYZE`), and **`ai`** (registered placeholder for Phase 2 — **no worker**). `emails`
  stays registered for parity but keeps no worker in Phase 1 (transactional mail is still the
  synchronous `MailService` — email delivery is out of scope here). All nine live in Redis DB 1.
- **Deferred workers now built.** `scheduled-publish` (per-minute reconciliation sweep +
  delayed per-piece job, both re-verifying at fire time and reusing `PiecesService.publish`),
  `trending-score` (recompute → materialize into the DB-0 cache — the E6 amendment's "future
  path"), and `analytics-rollup` (hourly + nightly `AnalyticsService.generateSnapshots`).
- **Cron via BullMQ job schedulers** (`upsertJobScheduler`, idempotent on boot) — no
  `@nestjs/schedule`. Cadences env-configurable (`CRON_*`): every-minute publish sweep,
  hourly trending + analytics, daily cleanup + nightly rollup, weekly DB maintenance + cache
  optimization.
- **Typed job contract.** Every job has a compile-time payload (`JobPayloads`, keyed by job
  name like `DomainEventMap`) and a job→queue binding (`JOB_QUEUE`), so `enqueue(job, data)` is
  type-checked end to end — a wrong-shaped payload or a job on the wrong queue is a compile
  error, not a runtime cast. Each job is a **handler class** (`AbstractJobHandler`) with a `zod`
  `validate` (payload DTO check at the queue boundary — a malformed/stale job throws
  `UnrecoverableError` and dead-letters immediately instead of burning retries) and a `handle`
  (reuses an exported service). One `@Processor` per queue dispatches to its handlers by job
  name — "one worker per queue, one handler per job" without splitting the queue topology.
  Per-job retry overrides (`JOB_RETRY`) layer over the per-queue policy. Logging/metrics stay
  centralized in the base processor.
- **Producer seam.** Business modules stay decoupled: they publish jobs through the
  `JobEnqueuer` port (`common/queue`, injected `@Optional()`), never importing infrastructure.
  The infra `EventBridgeService` subscribes to the in-process `DomainEventBus` and enqueues
  **cache-invalidation only** (publish/archive → invalidate discovery + trending) — it does
  not re-create notifications/analytics rows (those keep their synchronous listeners; async
  fan-out would double-write).
- **Cache strategy.** Generic `CacheService` (DB 0): read-through with single-flight stampede
  lock, write-invalidate, prefix/flush clear, and warming. Full flush is safe at DB
  granularity because DB 0 is cache-only (§3).
- **Admin monitoring APIs** (`/api/v1/admin/*`, PBAC): reads gated on `admin.dashboard`,
  mutations (job retry, cache clear/warm) on `system.manage`. In-process JSON monitoring
  replaces the docs-14 `bull-board` mount to avoid an undeclared dependency (frozen-lockfile
  Docker stability); the metrics taxonomy (depth-by-state, oldest-waiting age, worker count)
  is preserved for the Phase 1.5 Prometheus export.

**E12 build amendment (Production Hardening).** No business changes; security /
observability / deployment / release readiness only. Full report: `docs/24`.

- **Rate limiting is now global.** `RateLimitGuard` is an APP_GUARD (registered
  after `JwtAuthGuard`), so every endpoint is limited — its declared `@RateLimit`
  tier, or the new `apiDefault` (300/min user-or-ip) baseline. Idempotent per
  request (route-level `@UseGuards(RateLimitGuard)` is now redundant but harmless),
  health/metrics-exempt, and disabled by `RATE_LIMIT_ENABLED=false` for load tests.
  This closes the pre-E12 gap where ~50 endpoints (incl. a public write) were
  unlimited.
- **Sentry** is initialized in `instrument.ts` (first import; no-op without DSN) —
  10% traces, `sendDefaultPii:false`, id-only user, `/auth/*` body + secret
  scrubbing mirroring `logger/redaction.ts` (the single redaction source, docs 14
  §1.6). 5xx captured in the exception filter with the `requestId` tag.
- **Health** expanded from 2 to 7 probes (`/health/{live,ready,database,redis,
storage,queues}`); storage is degraded-not-dead (not in the hard readiness gate).
  **`/metrics`** ships now (hand-rolled Prometheus text, token-gated) rather than
  waiting for the 1.5 `prom-client` rollout — same fixed taxonomy.
- **DB connection pool** made explicit + env-tunable (`DB_POOL_*`); index added on
  `notifications.actor_id`.
- **Dependency security**: nodemailer 6→9 and a `multer ≥2.2.0` pnpm override clear
  all HIGH advisories; `pnpm audit --prod --audit-level high` is a CI gate.
- **Deployment/CI**: `docker-compose.prod.yml` (restart/limits/grace/healthchecks),
  Dockerfile `HEALTHCHECK` + pinned pnpm, and CI jobs for audit + gitleaks +
  migration up/down validation + image build (plus a manual e2e workflow).
- **Backend Freeze v1** (`docs/25`): post-E12 the API surface is frozen at `v1`.
  Future work (AI, subscriptions, admin, reading experience, clients) is
  **additive-only** — no breaking change to the `v1` envelope, error codes,
  permissions, or schema semantics; a genuine breaking change requires a new API
  version (`/api/v2`). This is the governing contract for all subsequent epics.

**Version pins (caret ranges):** NestJS ^11 · TypeORM ^0.3 · React ^19 · Vite ^7 ·
AntD ^5 · Tailwind ^4 · TanStack Query ^5 · Zustand ^5 · RHF ^7 · Zod ^3.24 (v4 blocked
by `@hookform/resolvers` peer range — migrate when supported) · TipTap ^3 · ESLint ^9 ·
Prettier ^3 · Turborepo ^2 · Jest ^29 · Vitest ^3 · tsup ^8.
