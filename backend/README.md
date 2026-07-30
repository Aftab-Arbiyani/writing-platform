# Qalam Backend

NestJS 11 modular monolith — REST API under `/api/v1` plus in-process BullMQ
workers. This is the **foundation only**: bootstrap, Zod-validated env config,
Pino logging, the ADR §5 response/error envelopes, and TypeORM/BullMQ wiring.
Feature modules land in Phase 1 — see [`src/modules/README.md`](src/modules/README.md).

## Run (dev)

```bash
# 1. Infra first (postgres 16, redis 7, minio, mailpit) — from the repo root
docker compose up -d

# 2. Environment
cp .env.example .env        # replace secrets: openssl rand -base64 32

# 3. Install + run (pnpm workspace, from repo root)
pnpm install
pnpm --filter backend dev   # http://localhost:4000/api/v1 — Swagger at /docs (non-prod)
```

## Migrations

The TypeORM CLI runs through `typeorm-ts-node-commonjs` — the binary bundled
with `typeorm` that registers `ts-node` (CommonJS mode, hence the dev deps
`ts-node` + `tsconfig-paths`) so it can execute the TypeScript data source
directly. The `-d src/database/data-source.ts` flag points every command at
that data source; `migration:generate` additionally takes the output file path
as a positional argument:

```bash
pnpm migration:generate src/database/migrations/<Name>  # diff entities → new migration
pnpm migration:run                                      # apply pending migrations
pnpm migration:revert                                   # roll back the most recent one
```

`synchronize: false` **always** (including dev). Never edit a merged migration —
create a new one. Migrations run as a deploy step, never at app boot.

## Seed

Idempotent seed runner (`src/database/seeds/run-seeds.ts`), run **after** migrations:
RBAC roles, PBAC permissions, taxonomy (languages/genres), and the **bootstrap
super-admin**. Safe to re-run (insert-if-missing; never overwrites admin edits).

```bash
pnpm seed   # ts-node run-seeds.ts (boots the app context, so infra must be up)
```

The super-admin is created from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_USERNAME` /
`SUPER_ADMIN_PASSWORD` (argon2id-hashed, never logged). In **dev** these default to
`admin@qalam.local` / `superadmin` / `ChangeMe!SuperAdmin1` (with a change-me warning);
in **production** the step is skipped unless all three are set — no default-credential
admin ever lands in prod. Re-running only ensures the role, never resets the password
(docs 04 §9).

## Conventions

- Module layout, boundaries, and patterns: `src/modules/README.md`, plus
  `docs/02_BackendArchitecture.md` and `docs/16_ModuleConventions.md`.
- Every response uses the ADR §5 envelope: `{ success: true, data, meta? }` /
  `{ success: false, error: { code, message, details, requestId } }`.
- Version note: the backend pins `zod@^3.24` (safest with today's NestJS
  ecosystem) while the ADR pins `zod@^4` for the frontend — same validation
  vocabulary, two majors, tracked for convergence.
