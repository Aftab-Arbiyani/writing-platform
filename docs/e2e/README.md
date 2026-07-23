# Browser E2E — Documentation Suite

> **Status:** Binding. This suite governs the browser end-to-end (E2E) test effort for the
> **frontend** (reader/writer app, `:5173`) and **admin** (staff panel, `:5174`) apps.
> It mirrors the engineering-doc discipline of `docs/00–44`: every rule here is enforceable
> by config, by the Playwright runner, or by review checklist. Where this suite and the master
> ADR (`docs/00_ArchitectureDecisions.md`) disagree, the ADR wins and this suite gets fixed.

Real full-stack browser E2E: Playwright drives Chromium **and** Firefox **and** WebKit through
the actual built apps, which talk to a **real** NestJS backend on real Postgres/Redis/MinIO
(via `docker-compose`). One dedicated `e2e/` workspace package covers both apps as separate
Playwright _projects_ so they share fixtures, auth setup, and helpers.

## Read in this order

| #   | Doc                                                     | What                                                                                    |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 00  | [Overview](./00_Overview.md)                            | Goals, non-goals, testing philosophy, the test pyramid, scope in/out                    |
| 01  | [Architecture](./01_Architecture.md)                    | The `e2e/` package, Playwright projects, stack topology, `playwright.config`            |
| 02  | [Conventions](./02_Conventions.md)                      | **Binding rules** — page objects, naming, fixtures, assertions, anti-patterns           |
| 03  | [Auth Strategy](./03_AuthStrategy.md)                   | `storageState` setup projects, roles, fresh-auth specs, session restore                 |
| 04  | [Test Data](./04_TestData.md)                           | The e2e-fixtures seed, unique-data factory, isolation, cleanup                          |
| 05  | [Selectors](./05_Selectors.md)                          | Selector priority, `data-testid` policy, AntD + TipTap specifics                        |
| 06  | [Phase Plan](./06_PhasePlan.md)                         | **The roadmap** — phased coverage matrix per app, exit criteria per phase               |
| 07  | [CI](./07_CI.md)                                        | `web-e2e.yml`, browser matrix, sharding, artifacts, failure diagnostics                 |
| 08  | [Runbook](./08_Runbook.md)                              | Local commands, trace viewer, debugging, troubleshooting, flake policy                  |
| 09  | [Data-Safety Guard Rails](./09_DataSafetyGuardrails.md) | **Binding** — soft-delete only, never hard-delete, no dropped DB/table/column           |
| 10  | [UI Quality](./10_UIQuality.md)                         | Phase 5 — visual regression, responsive (mobile/tablet), accessibility (axe + keyboard) |

## The one-paragraph summary

We test **real user workflows in real browsers against a real backend**. Every test starts from
a known seeded state, logs in via a saved session (`storageState`) rather than repeating UI logins,
drives the app through page objects with role/label/test-id selectors, and asserts on user-visible
outcomes. Coverage grows **phase by phase** (smoke → core → depth → rest → **UI quality**), and every
spec runs on **all three browser engines** from Phase 1. Phases 1–4 are functional; the final **Phase 5**
adds visual regression, responsive, and accessibility. Failures produce a clickable trace, screenshot,
and video.

## The three cross-cutting invariants

1. **Real stack, no mocks at the app boundary.** The browser hits the real app; the app hits the
   real API. We do not stub network responses to fake success. (Exception: uncontrollable third
   parties — see [00 §6](./00_Overview.md).)
2. **Deterministic state, isolated per test.** Seed provides the fixed baseline; anything a test
   creates is uniquely suffixed so parallel workers and all three browsers never collide.
3. **Auth is set up once per role, not per test.** Setup projects save `storageState`; real specs
   reuse it. Only the auth specs themselves log in through the UI.

Plus one **binding data-safety guard rail** ([09](./09_DataSafetyGuardrails.md)): the suite **never
hard-deletes data and never drops a database, table, or column** — removal is soft-delete only, and
delete-flow tests _assert the soft-delete happened_. Isolation comes from unique data, not deletion.

## Scope of changes to app/backend source

This effort is **almost entirely additive** (a new `e2e/` package + a CI workflow). The only
substantive source changes are: (1) an idempotent **e2e-fixtures seed** in the backend (non-prod
guarded), and (2) a **small, reviewable set of `data-testid`** attributes where AntD/TipTap DOM is
ambiguous. Both are specified — and bounded — in [04](./04_TestData.md) and [05](./05_Selectors.md).
