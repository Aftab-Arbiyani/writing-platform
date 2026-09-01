# E2E 01 — Architecture

> **Status:** Binding. Defines the physical shape of the E2E system: the `e2e/` workspace package,
> how the two apps map to Playwright _projects_, the runtime stack topology, and the
> `playwright.config.ts` design. Conventions for writing tests inside this structure live in
> [02_Conventions](./02_Conventions.md).

---

## 1. One package, two apps, three browsers

E2E lives in a **single new workspace package** — `e2e/` — added to `pnpm-workspace.yaml` and
`turbo.json`. It is **not** placed inside `frontend/` or `admin/`, because it tests _both_ and must
own a shared harness (fixtures, auth setup, stack scripts).

```
platfrom/
  e2e/
    package.json              # @playwright/test only; scripts: test, test:ui, test:headed, report, codegen
    playwright.config.ts      # projects: setup-* , then frontend/admin × {chromium, firefox, webkit}
    .auth/                    # gitignored — saved storageState per app/role
    .env.example             # E2E_BASE_URL_FRONTEND, _ADMIN, E2E_API_URL, creds override
    fixtures/
      test.ts                 # extends base test: authed page, api helper, unique-data factory
      api.ts                  # backend REST helper (create/reset test data via API)
      data.ts                 # unique-data factory (timestamp + worker-index suffixing)
    setup/
      frontend.setup.ts       # login as seeded writer (Remember me ON) → .auth/frontend.json
      admin.setup.ts          # login as super-admin → .auth/admin.json
    pages/                    # page objects (one class per screen/region)
      shared/                 # LoginPage, and any cross-app regions
      frontend/               # EditorPage, FeedPage, ProfilePage, SearchPage, SettingsPage…
      admin/                  # UsersPage, ModerationPage, DashboardPage, AuditLogPage…
    tests/
      frontend/               # auth.spec, writing.spec, feed.spec, search.spec, profile.spec…
      admin/                  # auth.spec, users.spec, moderation.spec, dashboard.spec…
    scripts/
      stack-up.sh             # docker infra + backend up → wait health → migration:run → seed (+ e2e seed)
      stack-down.sh           # tear the stack down
    utils/
      mailpit.ts              # read verification/reset emails from Mailpit API
```

**Why one package:** the frontend and admin share the _same_ backend, the _same_ auth mechanism, and
the _same_ stack lifecycle. Duplicating fixtures and setup across two packages would drift. Playwright
_projects_ give us per-app isolation inside one config, which is exactly the seam we want.

---

## 2. Playwright projects — the core mechanism

A Playwright **project** is a named test configuration (which files, which browser, which base URL,
which stored auth, which dependencies). We use projects for **three orthogonal concerns**:

1. **Auth setup** (run once, produce `storageState`) — `setup-frontend`, `setup-admin`.
2. **App** (which app's `baseURL` + stored session) — frontend vs admin.
3. **Browser engine** — chromium, firefox, webkit.

The app × browser combination produces **6 real test projects** (2 apps × 3 engines), each depending
on its app's setup project:

```
setup-frontend ─┐
                ├─▶ frontend-chromium   (baseURL :5173, storageState .auth/frontend.json)
                ├─▶ frontend-firefox
                └─▶ frontend-webkit

setup-admin ────┐
                ├─▶ admin-chromium      (baseURL :5174, storageState .auth/admin.json)
                ├─▶ admin-firefox
                └─▶ admin-webkit
```

`dependencies: ['setup-frontend']` guarantees the writer session is saved **before** any frontend
spec runs. Setup projects run in Chromium only (auth is engine-agnostic; the saved cookie/state works
across engines) — see [03_AuthStrategy §5](./03_AuthStrategy.md).

**Why projects, not separate configs:** projects share reporters, fixtures, retries, and the
`webServer` block, and Playwright parallelizes across all of them with one `--workers` pool. Separate
configs would fragment the run and the HTML report.

---

## 3. Stack topology — what's running during a run

```
┌─────────────────────────────────────────────────────────────────────┐
│ Playwright runner (Node)                                              │
│   spawns browsers: Chromium / Firefox / WebKit                        │
└───────────────┬───────────────────────────────┬─────────────────────┘
                │ navigates                       │ navigates
        ┌───────▼────────┐               ┌────────▼───────┐
        │ frontend :5173 │               │  admin :5174   │   ← Vite dev servers (webServer block)
        │ (Vite/preview) │               │  (Vite/preview)│
        └───────┬────────┘               └────────┬───────┘
                │  /api/v1                          │  /api/v1
                └───────────────┬──────────────────┘
                        ┌───────▼────────┐
                        │ backend :4000  │   ← real NestJS (docker-compose)
                        └───────┬────────┘
             ┌──────────────────┼───────────────────┬──────────────┐
        ┌────▼────┐        ┌────▼────┐         ┌─────▼────┐   ┌─────▼─────┐
        │Postgres │        │  Redis  │         │  MinIO   │   │  Mailpit  │
        │ :5432   │        │ :6379   │         │  :9000   │   │  :1025/UI │
        └─────────┘        └─────────┘         └──────────┘   └───────────┘
```

- **Infra + backend** are brought up by `scripts/stack-up.sh` (docker-compose), which also runs
  `migration:run` and the seeds (base + e2e-fixtures — see [04_TestData](./04_TestData.md)).
- **Both frontend apps** are started by Playwright's `webServer` block (see §5), pointed at the real
  backend via `VITE_API_URL`.
- **Mailpit** captures verification/reset emails so auth flows are deterministic ([00 §6](./00_Overview.md)).

> The apps talk to the backend over `/api/v1`. In dev the Vite server proxies `/api` → `:4000`
> (`frontend/vite.config.ts`, `admin/vite.config.ts`), so E2E can use a relative API base and avoid
> CORS. The API base is asserted once in the smoke phase.

---

## 4. Two run modes — dev loop vs CI

| Mode      | Apps served by                                                                        | Backend/infra by       | Command                                 |
| --------- | ------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------- |
| **Local** | Playwright `webServer` (Vite dev, `reuseExistingServer: true`)                        | `pnpm e2e:up` (docker) | `pnpm e2e:up && pnpm e2e:ui`            |
| **CI**    | Playwright `webServer` (`vite preview` on built output, `reuseExistingServer: false`) | GH services + step     | `web-e2e.yml` (see [07_CI](./07_CI.md)) |

**Why `preview` (built output) in CI, `dev` locally:** CI must test what ships — the production bundle,
`target: es2022`, code-split chunks — where engine-specific minification/module bugs surface. Local dev
favors fast HMR reload and the same servers you're already running. The config chooses per `process.env.CI`.

---

## 5. `playwright.config.ts` — the design contract

The config is the single source of truth for run behavior. It must encode:

```ts
// e2e/playwright.config.ts  (design shape — not final code)
import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;
const FE = process.env.E2E_BASE_URL_FRONTEND ?? 'http://localhost:5173';
const AD = process.env.E2E_BASE_URL_ADMIN ?? 'http://localhost:5174';

export default defineConfig({
  testDir: './tests',
  // Determinism & safety
  fullyParallel: true,
  forbidOnly: CI, // a stray test.only fails CI, never silently narrows the run
  retries: CI ? 2 : 0, // retry only in CI; locally a flake must be seen
  workers: CI ? '50%' : undefined, // leave headroom for 3 browser engines
  timeout: CI ? 90_000 : 30_000, // per-test budget — MUST exceed expect.timeout, see below
  // Diagnostics (see 08_Runbook)
  reporter: CI ? [['html'], ['github'], ['list']] : [['html'], ['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  expect: { timeout: CI ? 30_000 : 10_000 },

  projects: [
    // 1) setup — produce storageState (chromium only)
    { name: 'setup-frontend', testMatch: /setup\/frontend\.setup\.ts/ },
    { name: 'setup-admin', testMatch: /setup\/admin\.setup\.ts/ },

    // 2) frontend × 3 engines
    {
      name: 'frontend-chromium',
      testDir: './tests/frontend',
      use: { ...devices['Desktop Chrome'], baseURL: FE, storageState: '.auth/frontend.json' },
      dependencies: ['setup-frontend'],
    },
    { name: 'frontend-firefox', /* Desktop Firefox */ dependencies: ['setup-frontend'] },
    { name: 'frontend-webkit', /* Desktop Safari  */ dependencies: ['setup-frontend'] },

    // 3) admin × 3 engines
    {
      name: 'admin-chromium',
      testDir: './tests/admin',
      use: { ...devices['Desktop Chrome'], baseURL: AD, storageState: '.auth/admin.json' },
      dependencies: ['setup-admin'],
    },
    { name: 'admin-firefox', dependencies: ['setup-admin'] },
    { name: 'admin-webkit', dependencies: ['setup-admin'] },
  ],

  webServer: [
    {
      command: CI
        ? 'pnpm --filter frontend preview --port 5173 --strictPort'
        : 'pnpm --filter frontend dev',
      url: FE,
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: { VITE_API_URL: process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1' },
    },
    {
      command: CI
        ? 'pnpm --filter admin preview --port 5174 --strictPort'
        : 'pnpm --filter admin dev',
      url: AD,
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: { VITE_API_URL: process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1' },
    },
  ],
});
```

Binding config invariants (reviewers block on violations):

1. `forbidOnly: CI` — a committed `test.only` must fail CI, never silently shrink coverage.
2. `retries: 0` **locally** — a flake must be visible to the author, not auto-hidden.
3. `trace: 'on-first-retry'` — traces cost disk; capture them exactly when a test misbehaves.
4. The `webServer` block does **not** boot the backend/infra — that is `stack-up.sh`'s job. The config
   only owns the two Vite servers. **Why:** the runner should not race docker health; the stack must be
   proven healthy _before_ Playwright starts (`stack-up.sh` polls health).
5. `baseURL` per project — specs use relative paths (`page.goto('/feed')`) so the same spec is
   app-scoped by its project, never hardcoding host/port.
6. **`timeout` > `expect.timeout`, in every branch.** The per-test budget must strictly exceed the
   per-assertion budget. When the two are equal, one slow `expect` can consume everything the test
   has, and the test dies on "Test timeout of Nms exceeded" **with no failed assertion to read** —
   which looks like a hang or an engine defect and is neither.

   This invariant was learned the expensive way, and the shape of the mistake is why it is written
   here rather than only in the config. `timeout` was **absent** from this sample and from the real
   config until 2026-08-31, so the budget was Playwright's own default of 30 s. That was safe while
   assertions were capped at 10 s, and it silently stopped being safe the moment `expect.timeout` was
   raised to 30 s under CI for its own good reasons — the two became equal, and CI run #30 failed on
   it. See [48 §3.25h](../48_PlatformParityRegister.md). **Raising one means raising the other.**

   A value that is merely large is not the point; it should be _derived_. The documented worst case
   for a slow-but-passing test is one navigation (`navigationTimeout`) plus one slow assertion
   (`expect.timeout`), with arrange still to fit — which is what 90 s under CI clears.

---

## 6. Workspace + task wiring

- **`pnpm-workspace.yaml`** — add `- e2e` to `packages:`.
- **`turbo.json`** — add an `e2e` task (`{ "cache": false }`; E2E is never cached — it depends on live
  infra state, not just source).
- **Root `package.json` scripts:**

  | Script            | Does                                                        |
  | ----------------- | ----------------------------------------------------------- |
  | `pnpm e2e:up`     | `e2e/scripts/stack-up.sh` — infra+backend up, migrate, seed |
  | `pnpm e2e:down`   | `e2e/scripts/stack-down.sh` — tear down                     |
  | `pnpm e2e`        | `pnpm --filter e2e test` — run all projects headless        |
  | `pnpm e2e:ui`     | `pnpm --filter e2e test:ui` — Playwright UI mode            |
  | `pnpm e2e:report` | open the last HTML report                                   |

- **`.gitignore`** — add `e2e/.auth/`, `e2e/test-results/`, `e2e/playwright-report/`, `e2e/blob-report/`.

**Why `cache: false` for the e2e task:** turbo caches on input hashes; E2E's real input is the running
database's state, which turbo can't hash. Caching would return stale green.

---

## 7. What this architecture deliberately avoids

- **No app-level network stubbing harness.** Real API only ([00 §4.2](./00_Overview.md)).
- **No shared mutable global fixture** beyond the seeded baseline — per-test data is unique ([04](./04_TestData.md)).
- **No second config file.** Everything is projects in one config.
- **No Testcontainers here.** The backend E2E roadmap (docs 18) may adopt Testcontainers; browser E2E
  uses the existing `docker-compose` stack via `stack-up.sh`. If/when Testcontainers lands, `stack-up.sh`
  is the single place that changes.
