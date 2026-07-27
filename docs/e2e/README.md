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

## Progress

- **Phase 1 (Smoke + Auth):** harness + auth specs landed on all three engines (see [06 §3](./06_PhasePlan.md)).
- **Phase 2 (Core journeys):** **live-validated on Chromium + Firefox** (frontend draft-persistence + feed
  load/paginate/open-link; admin view-user + grant/revoke role — see [06 §4](./06_PhasePlan.md)). The live run
  found + fixed three real defects (cold-load infinite scroll, storageState-vs-rotating-refresh, DataFactory
  collisions). WebKit pending host OS libs (CI-only); PR-gate promotion pending.
- **Phase 3 (Depth):** **live-validated on Chromium + Firefox** — edit piece, search, profile view/edit,
  follow, notifications, change-password, silent-refresh; admin moderation (+ cross-app takedown), audit log,
  RBAC boundary (see [06 §5](./06_PhasePlan.md)). WebKit pending host OS libs (CI-only); PR-gate promotion pending.
- **Phase 4 (The rest):** **live-validated on Chromium + Firefox** (20/20 green) — frontend analytics stats,
  discover/For-You, and resilience (not-found, offline shell, live offline banner); admin Analytics /
  Operations / Security / System dashboards render real data (see [06 §6](./06_PhasePlan.md)). **AI-assistant
  and monetization rows deferred** — no client UI shipped yet. The full **functional** matrix is otherwise
  complete. WebKit pending host OS libs (CI-only); PR-gate promotion pending.
- **Phase 5 (UI quality):** **LANDED — live-validated on all three engines** (Chromium, Firefox **and
  WebKit**, 83 tests) inside the pinned Playwright image. Accessibility (axe WCAG A/AA + keyboard-only
  auth/publish), responsive (mobile + tablet), and visual regression (27 committed per-engine baselines,
  masked dynamic regions). **Both debt registers are now empty (2026-07-27):** `color-contrast`,
  `label`, `aria-hidden-focus` and the reader-shell horizontal overflow were each root-caused to a
  real app defect and fixed — the design tokens and AntD's derived muted colours now clear AA, the
  admin tables are labelled, and the frontend's missing `box-sizing: border-box` (a casualty of
  skipping Tailwind preflight) is restored, taking every reader page to 0px overflow. The suite
  gates with **no downgraded rules** and both apps hold the strict zero-scroll bar; see
  [06 §7](./06_PhasePlan.md) + [10 §8](./10_UIQuality.md). Full functional + UI-quality matrix
  complete; PR-gate promotion pending.
- **CI gate (open):** the suite has been validated locally only — `web-e2e.yml` had **never run**,
  because its `push: [main]` trigger could not match this repo's `develop` work and the backend was
  started before its migrations (fatal at bootstrap). Both are fixed; the remaining step is three
  green runs, then flipping on `pull_request` — see [07 §6.1](./07_CI.md). The release-gate
  checklist itself is written up in [docs/22](../22_ReleaseChecklist.md).

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
