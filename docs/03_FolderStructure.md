# 03 — Folder Structure

> **Derives from:** `00_ArchitectureDecisions.md` (the master ADR, §2 Monorepo & Toolchain,
> §3 Backend, §6 Frontend). This document is the map of the repository: what lives where,
> why, and — most importantly — what is _allowed to import what_. Structure that isn't
> enforced is decoration; the boundary rules in §5 are lint- and review-enforced.

---

## 1. Top-Level Layout

The repo root keeps its existing directory name, `platfrom`. One pnpm 9 workspace, one
Turborepo 2 task graph, three deployable apps, five internal packages.

```
platfrom/                          # repo root (existing dir name kept — ADR §2)
├── .github/                       # GitHub platform files — MUST live at root (see §7)
│   └── workflows/
│       ├── ci.yml                 # pnpm + turbo cache → lint → typecheck → test → build
│       │                          #   on PR + main; conventional-commit title check on PRs
│       └── deploy-*.yml           # environment-templated: staging auto on main,
│                                  #   production on tag + manual approval
├── backend/                       # NestJS API + BullMQ workers (one deployable) → §2
├── frontend/                      # Reader/writer app, React 19 + Vite 7      → §3
├── admin/                         # Admin panel, React 19 + Vite 7            → §3.3
├── packages/                      # The five @qalam/* internal packages       → §4
│   ├── shared/                    # @qalam/shared    — domain constants, enums, error codes
│   ├── api-types/                 # @qalam/api-types — OpenAPI-generated + handwritten API types
│   ├── ui/                        # @qalam/ui        — design tokens, AntD theme, primitives
│   ├── config/                    # @qalam/config    — tsconfig/eslint/prettier presets
│   └── utils/                     # @qalam/utils     — pure functions (slugify, readingTime…)
├── infrastructure/
│   ├── docker/                    # Dockerfiles per app: multi-stage pnpm fetch → build →
│   │                              #   distroless/alpine runtime, non-root (ADR §9)
│   └── nginx/                     # reverse-proxy configs: dev + prod templates
│                                  #   (app.qalam.* / admin.qalam.* / api.qalam.*)
├── docs/                          # 00–18 architecture documents; 00 is the master ADR
├── docker-compose.yml             # default profile: infra only (postgres 16, redis 7,
│                                  #   minio, mailpit) — apps run via `pnpm dev`;
│                                  #   `--profile full` containerizes everything
├── turbo.json                     # task graph: build/lint/typecheck/test; dependsOn ^build
├── pnpm-workspace.yaml            # workspace globs: backend, frontend, admin, packages/*
├── package.json                   # root scripts, husky + lint-staged + commitlint wiring
├── .nvmrc                         # Node 24 LTS (engines >= 22)
├── .env.example                   # documents the env shape (ADR §10) — never real secrets
└── CLAUDE.md                      # engineering handbook (AI + human onboarding)
```

**Why a monorepo:** the API contract (`@qalam/api-types`), design tokens (`@qalam/ui`),
and domain vocabulary (`@qalam/shared`) are shared by three apps. In separate repos those
would drift by version lag; in one workspace, a contract change and all its consumers
change in a single reviewed PR. pnpm's strict `node_modules` means nothing can depend on
a package it doesn't declare (no phantom dependencies — ADR §2).

---

## 2. Backend (`backend/`)

```
backend/
├── src/
│   ├── main.ts                    # bootstrap ONLY: helmet + strict CSP, CORS allowlist,
│   │                              #   URI versioning (/api/v1), global pipes (DTO
│   │                              #   validation), global exception filter, Swagger →
│   │                              #   /docs (non-prod), Pino logger. No business logic.
│   ├── app.module.ts              # composition root: config, database, redis, modules
│   │
│   ├── config/                    # HOW the app is configured
│   │   ├── env.schema.ts          # Zod schema — every env var validated, boot fails fast
│   │   │                          #   on any missing/malformed value (ADR §3)
│   │   └── …                      # app / database / redis / jwt / storage config factories,
│   │                              #   each a typed slice consumed via @nestjs/config
│   │
│   ├── common/                    # cross-cutting, domain-agnostic code — if it knows
│   │   │                          #   about "pieces" or "users", it does NOT belong here
│   │   ├── filters/               # global exception filter → error envelope (ADR §5)
│   │   ├── interceptors/          # response envelope, request-id propagation, logging
│   │   ├── decorators/            # @CurrentUser(), @Roles(), @Public(), @IdempotencyKey()
│   │   ├── guards/                # JWT auth guard, RBAC guard (user<moderator<admin<super_admin)
│   │   ├── base/                  # AppException (catalogue-coded domain errors),
│   │   │                          #   BaseEntity (uuidv7 id, created_at, updated_at,
│   │   │                          #   deleted_at where the domain needs it)
│   │   └── types/                 # shared backend-internal types (cursor, envelope, …)
│   │
│   ├── database/                  # persistence machinery — NOT domain logic
│   │   ├── data-source.ts         # TypeORM DataSource for the CLI (migrations); apps and
│   │   │                          #   CLI share one config; SnakeNamingStrategy
│   │   ├── migrations/            # generated, reviewed (/migration-check), immutable once
│   │   │                          #   merged; synchronize:false ALWAYS, even in dev (ADR §4)
│   │   └── seeds/                 # idempotent dev/staging seed scripts
│   │
│   └── modules/                   # the domain — Phase 1 target state (planned):
│       ├── auth/                  # sessions, JWT rotation, Google OAuth, Argon2id
│       ├── users/                 # identity, profiles, follows, roles, visibility guards
│       ├── pieces/                # the written work: lifecycle, reposts, responses
│       ├── taxonomy/              # languages, genres, tags
│       ├── engagement/            # likes, claps, bookmarks + piece_stats counters
│       ├── collections/           # collections + reading lists
│       ├── feeds/                 # Following / Trending / Latest / Discover composition
│       ├── search/                # SearchService over Postgres FTS (Meilisearch seam)
│       ├── notifications/         # in-app notifications + fan-out worker
│       ├── analytics/             # analytics_events ingestion, rollups, dashboards
│       ├── moderation/            # reports, moderation actions, audit logs
│       ├── media/                 # pre-signed uploads, media records, sharp worker
│       ├── prompts/               # daily writing prompts
│       └── admin/                 # admin BFF: dashboards, card templates, featured writers
│
├── test/                          # e2e (Supertest; Testcontainers later — ADR §3)
├── package.json                   # NestJS ^11, TypeORM ^0.3, Jest 29, nestjs-pino…
└── tsconfig.json                  # extends @qalam/config/tsconfig/nest
```

### 2.1 The canonical module anatomy

Every module in `modules/` has the same internal shape — learn one, know all fourteen:

```
modules/pieces/                    # (illustrative — Phase 1)
├── pieces.module.ts               # wires providers; EXPORTS only the service surface
├── pieces.controller.ts           # HTTP only: routes, DTO in/out, guards — zero logic
├── pieces.service.ts              # domain logic; the ONLY thing other modules may inject
├── pieces.repository.ts           # the ONLY TypeORM surface (custom repo via DataSource);
│                                  #   query builders live here and nowhere else (ADR §3)
├── entities/                      # piece.entity.ts, piece-stats.entity.ts… PRIVATE to
│                                  #   this module — never imported across module lines
├── dto/                           # create-piece.dto.ts, update-piece.dto.ts,
│                                  #   query-piece.dto.ts — class-validator owns validation
└── processors/                    # (only in modules that own queues) BullMQ processors,
                                   #   e.g. scheduled-publish.processor.ts
```

**Why this rigidity:** the module boundary rules (`02_SystemArchitecture.md` §3) are only
checkable if every module exposes the same, small public surface — its module file and
exported services. Entities and repositories being private is what makes the monolith
modular instead of merely foldered.

---

## 3. Frontend (`frontend/`) and Admin (`admin/`)

### 3.1 Frontend layout — feature-first

```
frontend/
├── src/
│   ├── app/                       # application shell — the ONLY place that knows about
│   │   │                          #   everything
│   │   ├── providers/             # QueryClientProvider, AntD ConfigProvider (theme +
│   │   │                          #   direction), theme/dir effects, error boundary, Sentry
│   │   └── router/                # React Router v7 route tree (data APIs); URL is the
│   │                              #   source of truth for tabs/filters/search (ADR §6)
│   │
│   ├── features/                  # ★ feature-first: one folder per product capability;
│   │   │                          #   a feature is deletable with one `rm -rf` (ADR §6)
│   │   ├── auth/                  # login, register, forgot/reset password
│   │   ├── editor/                # TipTap 3 editor, custom extensions (footnotes,
│   │   │                          #   mentions, hashtags), autosave, publish flow
│   │   ├── reading/               # the piece page (/p/:slug): typography per script,
│   │   │                          #   dir handling, footnote rendering
│   │   ├── feed/                  # /feed tabs following|trending|latest|discover (tab in URL)
│   │   ├── profile/               # /@:username, follows, pen name
│   │   ├── search/                # /search across writers/titles/tags/genres/languages
│   │   ├── engagement/            # like, clap, bookmark, repost, quote, response UI
│   │   ├── collections/           # collections + reading lists (/me/lists, /me/collections)
│   │   ├── notifications/         # in-app notification tray + unread badge
│   │   ├── analytics/             # writer dashboard (/me/stats)
│   │   └── settings/              # /settings/{profile,account,appearance}
│   │   #
│   │   # each feature has the same internal shape:
│   │   #   features/<name>/
│   │   #   ├── api/               # TanStack Query hooks for this feature; the only
│   │   #   │                      #   place its endpoints are called
│   │   #   ├── components/        # feature-private components
│   │   #   ├── hooks/             # feature-private hooks
│   │   #   └── stores/            # feature-private Zustand slices (client state only —
│   │   #                          #   server state lives in TanStack Query, never mirrored)
│   │
│   ├── components/                # app-wide COMPOSITES shared across features (e.g.
│   │                              #   PieceCard, UserBadge) — more specific than @qalam/ui
│   │                              #   primitives, less specific than any one feature
│   ├── lib/
│   │   └── api-client.ts          # centralized typed fetch wrapper: envelope unwrapping,
│   │                              #   error-code mapping, auth/refresh handling, request
│   │                              #   IDs. NO ad-hoc fetches in components (ADR §6)
│   └── main.tsx                   # Vite entry
├── index.html
├── package.json                   # React ^19, Vite ^7, TanStack Query ^5, Zustand ^5,
│                                  #   RHF ^7, Zod ^4, TipTap ^3, Vitest ^3
└── tsconfig.json                  # extends @qalam/config/tsconfig/react
```

**Why feature-first, not type-first:** a `components/` + `hooks/` + `api/` split by _kind_
scatters every product change across the tree and makes dead code undetectable.
Feature-first keeps each capability's api/components/hooks/stores together, so ownership
is obvious and deletion is `rm -rf src/features/<name>` plus removing its routes — the
deletability test is the boundary test.

### 3.2 Where state lives (the three-way split)

| State kind   | Home                                          | Rule                                                                                   |
| ------------ | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Server state | TanStack Query v5                             | Never mirrored into Zustand — one cache, one invalidation model (ADR §6)               |
| Client state | Zustand v5 slices (theme, editor UI, session) | Feature-private slices live in the feature; truly global slices are rare and justified |
| URL state    | React Router v7                               | Tabs, filters, search queries — shareable and back-button-correct by construction      |

### 3.3 Admin (`admin/`)

Identical skeleton and rules — `app/`, `features/`, `components/`, `lib/api-client.ts` —
with its own feature set mirroring the admin route map (ADR §10): `dashboard`, `users`,
`pieces`, `reports`, `card-templates`, `prompts`, `languages`, `featured`, `analytics`,
`moderators`, `roles`, `audit-logs`. Admin leans harder on AntD (tables, forms, pickers)
and uses offset pagination (`?page&limit`) because staff tables need totals. **Why a
separate app, not a route branch:** a different audience, threat model, and deploy
cadence — and admin code should be physically incapable of shipping in the reader bundle.

---

## 4. The Five Packages (`packages/`)

Each package: `src/`, built with **tsup (ESM + `.d.ts`)**, consumed as `workspace:*`.
Turborepo's `dependsOn: ^build` guarantees packages build before their consumers. **Why
built, not source-consumed:** source consumption breaks the NestJS tsc pipeline; building
keeps every consumer — Vite, Nest, future RN/CLI — uniform (ADR §2).

| Package            | One-line responsibility | Contains                                                                                                                                                                                                                     | Must NOT contain                                                   |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `@qalam/shared`    | _What the domain knows_ | Enums (`PieceStatus`, `Visibility`, `Role`), error-code catalogue (`AUTH_INVALID_CREDENTIALS`, `PIECE_SCHEDULE_IN_PAST`…), limits (`MAX_CLAPS_PER_USER = 50`), regexes (`USERNAME_REGEX`)                                    | Functions with behavior; anything UI or wire-format                |
| `@qalam/utils`     | _How to compute_        | Pure, dependency-free functions: `slugify`, `readingTime`, cursor helpers…                                                                                                                                                   | Domain constants; anything with I/O, framework, or runtime deps    |
| `@qalam/api-types` | _The wire contract_     | Types generated from the backend's exported `openapi.json` (`openapi-typescript`) + handwritten request/response helpers. Flutter generates Dart models from the same spec — one contract, three consumers                   | Runtime logic; UI types; duplicated enums (re-use `@qalam/shared`) |
| `@qalam/ui`        | _How it looks_          | Design tokens as CSS variables (`--q-*`, ADR §7), the AntD theme object, the Tailwind preset, shared primitives. The **single token source** feeding both AntD `ConfigProvider` and Tailwind — no drift, no specificity wars | Feature components; API calls; app state                           |
| `@qalam/config`    | _How we build_          | `tsconfig/{base,nest,react}`, `eslint/{base,nest,react}` (ESLint 9 flat), `prettier` preset                                                                                                                                  | Anything imported at runtime                                       |

**The disjointness rule:** each piece of knowledge has exactly one package that may own
it. The test for placement is the italicized question — _what the domain knows / how to
compute / the wire contract / how it looks / how we build_. If a candidate answers two
questions, split it. **Why:** overlap is how "shared" packages decay into junk drawers
that everything depends on and nobody can change.

---

## 5. Import Boundary Rules

Dependencies point in exactly one direction. Enforced by ESLint (import restrictions) and
review; violations are build failures, not style notes.

```
        frontend      admin        backend           ← apps (leaves; nothing imports them)
            │           │             │
            ▼           ▼             ▼
        ┌────────────────────────────────────┐
        │  @qalam/ui     @qalam/api-types    │       ← may use shared/utils
        │        │             │             │
        │        ▼             ▼             │
        │  @qalam/shared   @qalam/utils      │       ← dependency-free floor
        └────────────────────────────────────┘
             @qalam/config (build-time only — everyone extends it, nobody imports it at runtime)
```

| #   | Rule                                                                                                                                                                                                                | Why                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Apps may import packages. Packages never import apps.** No exceptions.                                                                                                                                            | The moment a package knows about an app, every other consumer inherits that app's assumptions and the package is no longer shared — it's entangled.                  |
| 2   | **Apps never import other apps.** Cross-app sharing goes _down_ into a package.                                                                                                                                     | frontend↔admin coupling would recreate the drift the monorepo exists to kill.                                                                                        |
| 3   | **`@qalam/shared` and `@qalam/utils` are dependency-free** — no runtime deps, no workspace deps.                                                                                                                    | They are the floor of the graph; anything they pulled in, the entire platform (including Flutter-adjacent codegen tooling) would pull in.                            |
| 4   | **`@qalam/ui` and `@qalam/api-types` may depend on `shared`/`utils` only** — never on each other.                                                                                                                   | Keeps look and wire-contract independent; keeps the graph a shallow tree, not a web.                                                                                 |
| 5   | **`@qalam/config` is build-time only.**                                                                                                                                                                             | Presets are extended by tooling, not executed by apps.                                                                                                               |
| 6   | **Backend: no cross-module entity/repository imports** — exported services or events only (ADR §1).                                                                                                                 | This is the modular monolith's load-bearing wall; see `02_SystemArchitecture.md` §3.                                                                                 |
| 7   | **Frontend/admin: features never import from other features.** Shared UI moves down to `components/` (or `@qalam/ui`); shared logic to `lib/` or a package. `app/` composes features; features never import `app/`. | Preserves the `rm -rf` deletability test — a feature with inbound feature imports can't be deleted, and one importing `app/` has inverted the composition direction. |
| 8   | **No ad-hoc `fetch` in components** — every request goes through `lib/api-client.ts` and per-feature query hooks typed by `@qalam/api-types`.                                                                       | One choke point for envelope handling, auth refresh, error-code mapping, and request-ID propagation.                                                                 |

---

## 6. Where Future Code Goes — Worked Examples

Described, not implemented. These are the recipes reviewers hold PRs against.

### 6.1 Adding backend module X (example: `prompts`, Phase 1)

1. **Confirm the boundary.** Does `prompts` own state (yes: `daily_prompts`) and a
   coherent responsibility? If a "module" would own no tables and only orchestrate
   others, it may really be a service inside an existing module — `feeds` is the rare,
   deliberate exception.
2. Create `backend/src/modules/prompts/` with the canonical anatomy (§2.1):
   `prompts.module.ts`, `prompts.controller.ts`, `prompts.service.ts`,
   `prompts.repository.ts`, `entities/daily-prompt.entity.ts`, `dto/`.
3. Entity extends the base columns (UUIDv7 app-generated id, `created_at`, `updated_at`;
   soft delete only if the domain needs recoverability — ADR §4). snake_case columns,
   plural table name.
4. Generate a migration into `backend/src/database/migrations/`; review it
   (`/migration-check`); never edit a merged migration — create a new one.
5. DTOs carry all validation; controller stays logic-free; Swagger decorators on every
   route so `/docs` and the exported `openapi.json` stay truthful.
6. Register in `app.module.ts`. Export from `prompts.module.ts` **only** the service
   surface other modules may consume.
7. Needs async work (e.g. scheduled prompt publication)? Add a processor under
   `processors/` against an existing queue, or add a queue to the ADR §3 catalogue
   _first_ — the ADR is the queue registry.
8. New error codes go to the `DOMAIN_REASON` catalogue in `@qalam/shared` (e.g.
   `PROMPT_NOT_FOUND`); new domain enums likewise.
9. Tests: Jest unit tests beside the code; e2e in `backend/test/`.
10. Regenerate `openapi.json` → `@qalam/api-types` so all consumers see the new contract
    in the same PR.

### 6.2 Adding frontend feature Y (example: `prompts` UI)

1. Create `frontend/src/features/prompts/` with `api/`, `components/`, `hooks/` (and
   `stores/` only if it has real client state — server state stays in TanStack Query).
2. `api/` gets query/mutation hooks built on `lib/api-client.ts`, typed by the freshly
   regenerated `@qalam/api-types`. No fetch calls anywhere else.
3. Components use `@qalam/ui` primitives and tokens; **CSS logical properties only**
   (`ms-*`/`me-*` — `ml-*`/`mr-*` are lint-banned) so the feature is RTL-correct by
   construction; both themes verified (tokens make this nearly automatic).
4. Route lands in `app/router/` with the URL carrying any tab/filter state (URL is the
   source of truth — ADR §6).
5. Forms: React Hook Form + Zod resolver, schema shared with the API layer.
6. Cross-feature reuse discovered mid-build? Move the shared piece _down_ — to
   `components/` if visual and app-specific, to `@qalam/ui` if a primitive, to a package
   if universal. Never import across `features/`.
7. Vitest + Testing Library specs beside the code.
8. **Exit check:** `rm -rf src/features/prompts` plus deleting its route entries must be
   the entire removal. If anything else breaks, a boundary was violated — fix it before
   merge.

The same recipe applies to `admin/` features, one for each admin route.

---

## 7. Note: `.github/` Lives at Root

The original brief placed CI under `infrastructure/github/`. That is not possible:
**GitHub only discovers workflows in `.github/workflows/` at the repository root** — a
platform requirement, not a preference. So the brief's intent is realized as `.github/`
at root (ADR §2), and `infrastructure/` keeps what is genuinely ours to relocate:
`docker/` and `nginx/`. Treat `.github/` as infrastructure that happens to live upstairs;
its contents follow the same review standards as everything under `infrastructure/`.

---

## 8. Orientation Cheat Sheet

| I want to…                             | Go to                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Change an env var's shape              | `backend/src/config/env.schema.ts` (+ `.env.example`)                      |
| Add a domain error code / enum / limit | `packages/shared/src`                                                      |
| Change a color, radius, or font token  | `packages/ui` (tokens feed AntD _and_ Tailwind)                            |
| See the wire contract                  | `packages/api-types` (regenerated from `openapi.json`)                     |
| Add a backend capability               | `backend/src/modules/<module>/` per §6.1                                   |
| Add a user-facing capability           | `frontend/src/features/<feature>/` per §6.2                                |
| Add/modify a DB table                  | Entity in its module + new migration in `backend/src/database/migrations/` |
| Touch request routing / TLS            | `infrastructure/nginx/`                                                    |
| Change CI                              | `.github/workflows/`                                                       |
| Understand any decision                | `docs/00_ArchitectureDecisions.md` — always first                          |
