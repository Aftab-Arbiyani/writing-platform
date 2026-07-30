# Contributing to Qalam

Thanks for contributing. This guide is the practical workflow; the engineering
rules live in [`CLAUDE.md`](./CLAUDE.md) and the architecture in [`docs/`](./docs).
When in doubt, the master ADR wins: [`docs/00_ArchitectureDecisions.md`](./docs/00_ArchitectureDecisions.md).

## Prerequisites

- **Node 24** (`.nvmrc`), **pnpm 9.12** (`corepack enable`), Docker.

## Setup

```bash
corepack enable
pnpm install
cp backend/.env.example backend/.env         # fill required secrets
docker compose up -d                          # postgres, redis, minio, mailpit
pnpm --filter backend migration:run
pnpm --filter backend seed
pnpm dev                                       # api:4000, frontend:5173, admin:5174
```

## Everyday commands

```bash
pnpm build | lint | typecheck | test          # turbo across the workspace
pnpm --filter backend test                     # unit tests (no infra needed)
pnpm --filter backend test:e2e                 # e2e (needs docker infra up)
pnpm --filter backend migration:create src/database/migrations/<Name>
pnpm --filter backend migration:run | migration:revert
```

## Branching & commits

- Trunk-based: branch off `main` as `feat/…` or `fix/…`; keep it < 3 days; squash-merge.
- **Conventional commits** with the scope list in `commitlint.config.mjs`
  (enforced by husky locally and the `pr-title` check in CI).

## Code standards (review-blockers — see CLAUDE.md "Hard rules")

- **Strict TypeScript**: no `any` (use `unknown` + narrowing); no non-null `!`
  outside tests.
- **Backend layering**: controller → service → repository. Validation in DTOs
  (class-validator). Only repositories touch query builders. **No cross-module
  repository imports** — modules talk via exported services or events/queues.
- **Database**: migrations only (`synchronize:false` forever). Never edit a merged
  migration — add a new one. Every migration needs a working `down()` (CI validates
  up→down→up). snake_case columns, UUIDv7 app-generated PKs.
- **Security**: TypeORM parameterization only; secrets via env; never log
  tokens/passwords/emails; every new `@Public()` endpoint is a security-review item
  and needs a validated DTO + a rate-limit tier (or the `apiDefault` baseline).
- **New module** → follow `backend/src/modules/README.md`. **New async job** →
  follow `backend/src/infrastructure/README.md` (typed `JobPayloads` + a handler).

## Tests

- Jest in `backend/` (`*.spec.ts` unit, `*.e2e-spec.ts` e2e); Vitest in
  frontends/packages. Services, guards, and utils must be tested (80% target on
  services/utils). Unit tests mock at the seam and need no infra.

## Before you open a PR

- [ ] `pnpm lint typecheck test build` all green.
- [ ] New/changed endpoints have Swagger decorators (`@ApiOperation`, responses)
      and the right guard/permission + rate-limit tier.
- [ ] DB change: generated a migration, verified `up`/`down`, ran `/migration-check`.
- [ ] No secret/PII in logs; `pnpm audit --prod --audit-level high` clean.
- [ ] Updated `docs/00` if you changed an architectural decision (the ADR must
      never drift from reality).

## Where things live

| Area                               | Path                                                       |
| ---------------------------------- | ---------------------------------------------------------- |
| Backend modules                    | `backend/src/modules/*` (README with the module checklist) |
| Async infra (queues/workers/cache) | `backend/src/infrastructure/` (README)                     |
| Shared vocabulary                  | `packages/shared` (enums, error codes, limits, rate tiers) |
| Docs                               | `docs/` (index in `docs/README.md`)                        |
