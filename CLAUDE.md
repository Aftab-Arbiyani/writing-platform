# CLAUDE.md — Qalam Engineering Handbook

**Qalam** (قلم / क़लम — "the pen") is a global creative writing platform: a premium writing
sanctuary for Hindi and Urdu writers first, global multilingual writers later. This file is
the permanent engineering handbook for humans and AI alike. When in doubt, the master ADR
wins: **`docs/00_ArchitectureDecisions.md`**.

## Current phase

**Phase 1 — MVP: ✅ COMPLETE (closed 2026-07-09).** Phase 0 (docs + scaffold) is complete.
The backend API is **frozen at `v1`** — see `docs/25_BackendFreeze.md`; from here all work is
**additive-only** (any breaking change requires a new API version `/api/v2`). Per-epic detail
lives in the auto-memory phase tracker + `docs/18_DevelopmentRoadmap.md`; this is the summary.

**Delivered (backend):** E1 Auth & Identity · E2 Profiles & Follow · E3+E4 Writing Engine
(drafts + publishing) · E6 Feeds & Discovery · E7 Social & Curation (engagement) · E8 Search ·
E9 Notifications · PBAC authorization · E10-Analytics · E11 Asynchronous Processing
(BullMQ queues/workers/scheduler/cache/monitoring) · E12 Production Hardening (security,
observability, deployment, CI/CD, docs 19–25). The backend is production-ready: 272 unit
tests, `nest build` + `docker build` green, 7 health probes, `/metrics`, Sentry, global rate
limiting. Readiness report: `docs/24_BackendReadinessReport.md`.

**Deferred out of Phase 1 (NOT built — revisit in a later phase if still wanted):** E5 Reading
experience; the E10-Admin dashboard/moderation UI + card templates (admin **APIs** are partial
— monitoring, system-notifications, and analytics exist; the full moderation workflow does
not); and within-epic deferrals (`reading_lists`, reposts, quotes; cross-actor notification
aggregation).

**Next: Phase 2** (AI, payments/subscriptions/monetization, Apple login) — **not yet started;
do not implement until explicitly planned.** When it begins, build as new modules + additive
endpoints/columns that never break the frozen `v1` contract (`docs/25` §8). The React frontend
and the separate Flutter app consume `v1` via `openapi.json` → `@qalam/api-types`.

## Monorepo map

| Path                 | What                                                                       | Stack                                                                  |
| -------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `backend/`           | API + BullMQ workers (modular monolith)                                    | NestJS 11, TypeORM, PostgreSQL 16, Redis, Pino                         |
| `frontend/`          | Reader/writer app                                                          | React 19, Vite 7, AntD 5 + Tailwind 4, TanStack Query, Zustand, TipTap |
| `admin/`             | Admin panel (same stack, leaner)                                           | React 19, Vite 7, AntD-heavy                                           |
| `packages/shared`    | Domain vocabulary: enums, error codes, limits, regexes, API envelope types | zero-dep TS                                                            |
| `packages/utils`     | Pure functions only                                                        | zero-dep TS                                                            |
| `packages/api-types` | Wire contract (OpenAPI-generated + manual)                                 | TS                                                                     |
| `packages/ui`        | Design tokens (`--q-*`), AntD theme, primitives (Phase 1)                  | TS + CSS                                                               |
| `packages/config`    | tsconfig / eslint / prettier presets                                       | —                                                                      |
| `infrastructure/`    | Dockerfiles, nginx                                                         | —                                                                      |
| `docs/`              | Architecture volumes 00–18 (00 is the master)                              | —                                                                      |

Mobile (Flutter) lives in a **separate repository** — never add it here.

## Commands

```bash
docker compose up -d          # infra: postgres:5432, redis:6379, minio:9000, mailpit:8025
pnpm install                  # workspace install (pnpm 9, Node 24)
pnpm dev                      # all apps via turbo (api:4000, frontend:5173, admin:5174)
pnpm build | lint | typecheck | test    # turbo across the workspace
pnpm --filter backend migration:generate src/database/migrations/<Name>
```

## Hard rules (violations are review-blockers)

1. **Strict TypeScript everywhere.** No `any` (use `unknown` + narrowing). No non-null
   assertions outside tests.
2. **RTL is day one.** Urdu is right-to-left. Only CSS **logical** properties/classes
   (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`). Physical `ml-/mr-/pl-/pr-/left-/right-`
   are banned.
3. **Tokens only.** No raw hex/px in components — use `--q-*` tokens (via Tailwind theme or
   AntD theme). Dark mode must work for every surface you touch.
4. **Server state lives in TanStack Query, never Zustand.** URL is the source of truth for
   tabs/filters. Forms are RHF + Zod.
5. **All HTTP goes through the centralized api-client** (`src/lib/api-client.ts`). No `fetch`
   in components. All responses use the envelope
   `{ success, data, meta } | { success:false, error:{ code, … } }`; codes come from
   `@qalam/shared` `ERROR_CODES`.
6. **Backend layering:** controller → service → repository. Validation lives in DTOs
   (class-validator). Only repositories touch query builders. **No cross-module repository
   imports** — modules talk via exported services/events.
7. **Database:** migrations only (`synchronize: false` forever). **Always create migrations
   with `pnpm --filter backend migration:generate src/database/migrations/<Name>` — never
   hand-author a migration file or invent/hand-pick a timestamp.** A real `Date.now()` prefix
   keeps run-order correct and the diff keeps entities and schema in lockstep; set up the
   entities + a running DB first rather than falling back to hand-writing. Never edit a merged
   migration — generate a new one. snake_case columns, UUIDv7 app-generated PKs, soft delete
   only where `docs/04` says so. No `COUNT(*)` on hot paths — use `piece_stats`.
8. **Domain invariants:** username is permanent (never build an edit path); one pen name;
   one language per piece; claps cap at 50/user/piece; AI & payments are Phase 2 — nothing
   ships early.
9. **Security:** TypeORM parameterization only (no SQL string interpolation); secrets via
   env only; every admin mutation writes an audit log; never log tokens/passwords/emails.
10. **Packages stay disjoint:** `shared` = vocabulary, `utils` = pure functions, `api-types`
    = wire contract, `ui` = look, `config` = build presets. Apps import packages, never the
    reverse; packages never import apps.

## Conventions quick-sheet

- Files kebab-case (`piece-card.tsx`, `pieces.service.ts`); classes PascalCase; constants
  SCREAMING_SNAKE; booleans `is/has/can`-prefixed.
- Conventional commits with the scope list in `commitlint.config.mjs`; squash-merge, trunk-based,
  branches `feat/…` `fix/…` live < 3 days. PR titles are conventional (checked in CI).
- Frontend is feature-first: `features/<name>/{api,components,hooks,stores,types}` — a
  feature must be deletable with one `rm -rf`.
- Tests: Jest in `backend/` (`*.spec.ts`), Vitest in frontends/packages. Services, guards,
  and utils must be tested (80% target on services/utils).
- New backend module → follow `backend/src/modules/README.md`; new shared component →
  charter in `docs/08_ComponentLibrary.md`.

## Where decisions live

`docs/00` master ADR · `02` system architecture · `04` database (full ERD) · `05` API
standards · `07` design system (tokens are law) · `11` routing · `12` state management ·
`13` security · `16` coding standards · `17` git workflow · `18` roadmap (epic breakdown).

If you change an architectural decision, update `docs/00` **in the same PR** — the ADR is
never allowed to drift from reality.
