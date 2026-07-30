# Backend Tests

Two suites, two runners of the _same_ runner (Jest 29, ADR §3 / docs 16 §7):

| Suite           | Location                    | Config               | Command         | Infra needed        |
| --------------- | --------------------------- | -------------------- | --------------- | ------------------- |
| **Unit**        | `src/**/*.spec.ts`          | `jest.config.ts`     | `pnpm test`     | none                |
| **Integration** | `src/**/*.spec.ts` (mocked) | `jest.config.ts`     | `pnpm test`     | none (mock at seam) |
| **E2E**         | `test/**/*.e2e-spec.ts`     | `test/jest-e2e.json` | `pnpm test:e2e` | Postgres + Redis    |

Coverage: `pnpm test:cov`. CI runs the **unit** suite only (`turbo test`); e2e is
run locally against `docker compose up -d` until Testcontainers automates real
Postgres/Redis in CI (Phase 1.5, docs 18).

## What must be tested (docs 16 §7.1)

Services (every public method, happy + error), guards/interceptors/filters (every
branch), and `@qalam/*` utils are **mandatory** (≥ 80%). Controllers get an e2e
smoke per module (envelope shape, status, validation rejection). Pure-presentational
code is skipped.

## Conventions

- Unit specs colocate with source (`cursor.util.spec.ts`), AAA pattern, one
  behavior per test (docs 16 §7.3).
- `test/utils/create-test-app.ts` boots the app with the real global wiring
  (envelope filter/interceptor, validation pipe) for e2e.
- `test/factories/` — `<entity>.factory.ts` builders returning valid-by-default
  objects (docs 16 §7.4). Empty until entities land in Phase 1.
- Mock at the boundary you own: services mock repositories; never mock the unit
  under test's internals.
