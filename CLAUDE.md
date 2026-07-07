# CLAUDE.md — Qalam Engineering Handbook

**Qalam** (قلم / क़लम — "the pen") is a global creative writing platform: a premium writing
sanctuary for Hindi and Urdu writers first, global multilingual writers later. This file is
the permanent engineering handbook for humans and AI alike. When in doubt, the master ADR
wins: **`docs/00_ArchitectureDecisions.md`**.

## Current phase

**Phase 0 — Foundation.** Only documentation and scaffold exist. There are **no features,
no controllers/services, no entities, no screens** yet. Phase 1 epics (E1–E10) are defined
in `docs/18_DevelopmentRoadmap.md`. Do not implement Phase 2 concerns (AI, payments, Apple
login) anywhere.

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
7. **Database:** migrations only (`synchronize: false` forever); never edit a merged
   migration — create a new one. snake_case columns, UUIDv7 app-generated PKs, soft delete
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
