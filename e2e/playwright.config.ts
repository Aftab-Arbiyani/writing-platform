import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Local overrides from e2e/.env (optional — every value has a working default).
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const CI = !!process.env.CI;

// Reuse already-running app servers instead of spawning them. True locally always, and
// opt-in under CI via E2E_REUSE_SERVER=1 — the Phase-5 visual baseline run drives the apps
// from inside the pinned Playwright Docker image (`--network host`) while the Vite `preview`
// servers run on the host, so Playwright must attach to them, not try to boot them in-container.
const REUSE_SERVER = !CI || process.env.E2E_REUSE_SERVER === '1';

const FRONTEND_URL = process.env.E2E_BASE_URL_FRONTEND ?? 'http://localhost:5173';
const ADMIN_URL = process.env.E2E_BASE_URL_ADMIN ?? 'http://localhost:5174';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';

const FRONTEND_STATE = '.auth/frontend.json';
const ADMIN_STATE = '.auth/admin.json';

// Phase-5 responsive specs live in `tests/**/responsive/` and run ONLY in the mobile/tablet
// viewport projects below — the desktop engine projects ignore them (a responsive spec at
// desktop width proves nothing). Visual specs (`*.visual.spec.ts`) DO run in the desktop
// engine projects, so Playwright namespaces one baseline per engine (docs/e2e/10 §2.2).
const RESPONSIVE_ONLY = /responsive\//;

// The UI-quality specs (a11y + visual) are the ones worth re-running in dark mode: they are the
// only ones that assert on *appearance*, which is what a theme changes. Functional specs would
// just retest the same behaviour through differently-coloured pixels (docs/e2e/10 §3.3).
const UI_QUALITY_ONLY = /(a11y|visual)\.spec\.ts$/;

// Tablet width on Chromium (iPad-class viewport). The docs' example names iPad Mini, but that
// device is WebKit — pinning tablet to Chromium keeps the responsive subset locally runnable
// (WebKit needs host OS libs, CI-only), while still exercising the tablet breakpoint.
const CHROMIUM_TABLET = {
  ...devices['Desktop Chrome'],
  viewport: { width: 820, height: 1180 },
} as const;

/**
 * Browser E2E for the frontend (:5173) and admin (:5174) apps.
 * See docs/e2e/ — 01_Architecture (this file's contract) and 07_CI.
 *
 * Projects: two setup projects mint storageState, then each app runs across all
 * three engines (chromium/firefox/webkit), depending on its setup project.
 *
 * NOTE: this config owns only the two Vite servers (webServer block). The
 * backend + infra (Postgres/Redis/MinIO/Mailpit) must already be healthy —
 * bring them up with `pnpm e2e:up` (scripts/stack-up.sh) before running.
 */
export default defineConfig({
  testDir: './tests',
  /**
   * The run starts and ends with every AI feature flag DARK — the state AF1 seeds and the majority of
   * these specs assert (`setup/ai-flags.global.ts`). The per-test mutex restores flags it raised, but a
   * worker killed mid-test runs no `finally` at all, and a leaked raised flag then fails the next run's
   * flag-down assertions for a reason unrelated to the code under test. These two hooks make that
   * unrecoverable-by-design case recoverable.
   */
  globalSetup: './setup/ai-flags.global.ts',
  globalTeardown: './setup/ai-flags.teardown.ts',
  fullyParallel: true,
  forbidOnly: CI, // a stray test.only fails CI, never silently narrows the run
  retries: CI ? 2 : 0, // retry only in CI; locally a flake must be seen
  workers: CI ? '50%' : undefined, // leave headroom for three engines
  reporter: CI
    ? [['html', { open: 'never' }], ['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],

  /**
   * **A missing visual baseline FAILS. It is never written.** (docs/e2e/10 §8.3, [48 T-8].)
   *
   * Playwright's default is `'missing'`: a spec with no committed baseline silently writes one from
   * whatever browser happens to be running, prints "A snapshot doesn't exist …, writing actual", and
   * then passes on the next run. On a dev machine that mints a **host-rendered** baseline, which §8.3
   * forbids outright — baselines are only valid from `mcr.microsoft.com/playwright:v1.61.1-noble`.
   *
   * That happened four times (W3a, W3c, the tokens pass, W4) before this line existed. Three of the
   * four were caught and the files deleted; the failure mode is that the fourth is not, and a wrong
   * baseline is worse than none because it turns the whole visual dimension into a tautology.
   *
   * `'none'` makes the default posture refuse. The **only** thing that may mint is the `web-e2e`
   * workflow's `web-e2e-visual` job, which runs inside the pinned image and passes an explicit
   * `--update-snapshots` — a CLI flag, so it overrides this. Nothing else can, including
   * `--ignore-snapshots`, which merely skips comparison.
   *
   * Consequence, and it is the intended one: a newly added visual spec **fails until its baseline is
   * minted by that workflow**. A red spec asking for a baseline is the correct state; a green one that
   * invented its own is not.
   */
  updateSnapshots: 'none',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  expect: {
    timeout: 10_000,
    // Phase-5 visual defaults (docs/e2e/10 §2.2): disable animations + hide the caret so a
    // blinking cursor/transition never flips a run red, and allow a small pixel-ratio budget
    // for sub-pixel AA noise. Per-spec `mask:` covers genuinely volatile regions.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },

  projects: [
    // 1) setup — produce storageState (chromium only; auth state is engine-agnostic)
    {
      name: 'setup-frontend',
      testDir: './setup',
      testMatch: 'frontend.setup.ts',
      use: { ...devices['Desktop Chrome'], baseURL: FRONTEND_URL },
    },
    {
      name: 'setup-admin',
      testDir: './setup',
      testMatch: 'admin.setup.ts',
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_URL },
    },

    // 2) frontend × 3 engines (desktop; responsive specs excluded — they run in the
    //    viewport projects below. Visual + functional specs run here, one baseline/engine.)
    {
      name: 'frontend-chromium',
      testDir: './tests/frontend',
      testIgnore: RESPONSIVE_ONLY,
      use: { ...devices['Desktop Chrome'], baseURL: FRONTEND_URL, storageState: FRONTEND_STATE },
      dependencies: ['setup-frontend'],
    },
    {
      name: 'frontend-firefox',
      testDir: './tests/frontend',
      testIgnore: RESPONSIVE_ONLY,
      use: { ...devices['Desktop Firefox'], baseURL: FRONTEND_URL, storageState: FRONTEND_STATE },
      dependencies: ['setup-frontend'],
    },
    {
      name: 'frontend-webkit',
      testDir: './tests/frontend',
      testIgnore: RESPONSIVE_ONLY,
      use: { ...devices['Desktop Safari'], baseURL: FRONTEND_URL, storageState: FRONTEND_STATE },
      dependencies: ['setup-frontend'],
    },

    // 3) admin × 3 engines (desktop; responsive excluded as above)
    {
      name: 'admin-chromium',
      testDir: './tests/admin',
      testIgnore: RESPONSIVE_ONLY,
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_URL, storageState: ADMIN_STATE },
      dependencies: ['setup-admin'],
    },
    {
      name: 'admin-firefox',
      testDir: './tests/admin',
      testIgnore: RESPONSIVE_ONLY,
      use: { ...devices['Desktop Firefox'], baseURL: ADMIN_URL, storageState: ADMIN_STATE },
      dependencies: ['setup-admin'],
    },
    {
      name: 'admin-webkit',
      testDir: './tests/admin',
      testIgnore: RESPONSIVE_ONLY,
      use: { ...devices['Desktop Safari'], baseURL: ADMIN_URL, storageState: ADMIN_STATE },
      dependencies: ['setup-admin'],
    },

    // 4) Phase-5 responsive viewport projects (docs/e2e/10 §3). The curated responsive
    //    subset (`tests/**/responsive/`) re-runs at mobile + tablet widths, Chromium-only
    //    (local-runnable; WebKit tablet is CI-only). Same page objects, same storageState.
    {
      name: 'frontend-mobile',
      testDir: './tests/frontend',
      testMatch: RESPONSIVE_ONLY,
      use: { ...devices['Pixel 7'], baseURL: FRONTEND_URL, storageState: FRONTEND_STATE },
      dependencies: ['setup-frontend'],
    },
    {
      name: 'frontend-tablet',
      testDir: './tests/frontend',
      testMatch: RESPONSIVE_ONLY,
      use: { ...CHROMIUM_TABLET, baseURL: FRONTEND_URL, storageState: FRONTEND_STATE },
      dependencies: ['setup-frontend'],
    },
    {
      name: 'admin-mobile',
      testDir: './tests/admin',
      testMatch: RESPONSIVE_ONLY,
      use: { ...devices['Pixel 7'], baseURL: ADMIN_URL, storageState: ADMIN_STATE },
      dependencies: ['setup-admin'],
    },
    {
      name: 'admin-tablet',
      testDir: './tests/admin',
      testMatch: RESPONSIVE_ONLY,
      use: { ...CHROMIUM_TABLET, baseURL: ADMIN_URL, storageState: ADMIN_STATE },
      dependencies: ['setup-admin'],
    },

    // 5) Dark-mode projects (docs/e2e/10 §3.3). Both apps resolve their default `system` theme
    //    from `prefers-color-scheme`, so `colorScheme: 'dark'` is all it takes to stamp
    //    `data-theme="dark"` on <html> before first paint. Chromium-only and UI-quality-only:
    //    a theme changes appearance, not behaviour, and three engines × two themes buys little
    //    over one engine × two themes. Playwright namespaces snapshots by project, so these get
    //    their own baselines (`*-frontend-dark-linux.png`) with no collision.
    {
      name: 'frontend-dark',
      testDir: './tests/frontend',
      testMatch: UI_QUALITY_ONLY,
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        baseURL: FRONTEND_URL,
        storageState: FRONTEND_STATE,
      },
      dependencies: ['setup-frontend'],
    },
    {
      name: 'admin-dark',
      testDir: './tests/admin',
      testMatch: UI_QUALITY_ONLY,
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        baseURL: ADMIN_URL,
        storageState: ADMIN_STATE,
      },
      dependencies: ['setup-admin'],
    },
  ],

  // CI serves the built output (what ships); locally reuse the running dev servers.
  webServer: [
    {
      command: CI
        ? 'pnpm --filter frontend preview --port 5173 --strictPort'
        : 'pnpm --filter frontend dev',
      url: FRONTEND_URL,
      reuseExistingServer: REUSE_SERVER,
      timeout: 120_000,
      env: {
        VITE_API_URL: API_URL,
        // AF6/W3 collaboration ships dark (docs/49 §2.2) — default `false` in `config/env.ts`, so
        // without this the suite would only ever see the "Collaboration is off" state. The server's
        // own master flag fails open, so enabling it here exercises the real surface.
        VITE_ENABLE_COLLABORATION: 'true',
        // AF5/W4 monetization ships dark for the same reason (docs/45 §4) — without this the billing
        // surfaces would all render "Plans aren't available yet" and the `af5` row would prove nothing.
        //
        // This is only the CLIENT switch. The platform's own `feature.payments.enabled` flag is
        // server-side and pre-seeded OFF, and the monetization spec toggles it per test through the
        // admin API, restoring it afterwards — so the two are deliberately not conflated here.
        VITE_ENABLE_MONETIZATION: 'true',
      },
    },
    {
      command: CI
        ? 'pnpm --filter admin preview --port 5174 --strictPort'
        : 'pnpm --filter admin dev',
      url: ADMIN_URL,
      reuseExistingServer: REUSE_SERVER,
      timeout: 120_000,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
