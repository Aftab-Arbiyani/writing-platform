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

**Version pins (caret ranges):** NestJS ^11 · TypeORM ^0.3 · React ^19 · Vite ^7 ·
AntD ^5 · Tailwind ^4 · TanStack Query ^5 · Zustand ^5 · RHF ^7 · Zod ^3.24 (v4 blocked
by `@hookform/resolvers` peer range — migrate when supported) · TipTap ^3 · ESLint ^9 ·
Prettier ^3 · Turborepo ^2 · Jest ^29 · Vitest ^3 · tsup ^8.
