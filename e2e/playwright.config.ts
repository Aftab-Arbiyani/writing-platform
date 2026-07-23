import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Local overrides from e2e/.env (optional — every value has a working default).
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const CI = !!process.env.CI;

const FRONTEND_URL = process.env.E2E_BASE_URL_FRONTEND ?? 'http://localhost:5173';
const ADMIN_URL = process.env.E2E_BASE_URL_ADMIN ?? 'http://localhost:5174';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';

const FRONTEND_STATE = '.auth/frontend.json';
const ADMIN_STATE = '.auth/admin.json';

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
  fullyParallel: true,
  forbidOnly: CI, // a stray test.only fails CI, never silently narrows the run
  retries: CI ? 2 : 0, // retry only in CI; locally a flake must be seen
  workers: CI ? '50%' : undefined, // leave headroom for three engines
  reporter: CI
    ? [['html', { open: 'never' }], ['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  expect: { timeout: 10_000 },

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

    // 2) frontend × 3 engines
    {
      name: 'frontend-chromium',
      testDir: './tests/frontend',
      use: { ...devices['Desktop Chrome'], baseURL: FRONTEND_URL, storageState: FRONTEND_STATE },
      dependencies: ['setup-frontend'],
    },
    {
      name: 'frontend-firefox',
      testDir: './tests/frontend',
      use: { ...devices['Desktop Firefox'], baseURL: FRONTEND_URL, storageState: FRONTEND_STATE },
      dependencies: ['setup-frontend'],
    },
    {
      name: 'frontend-webkit',
      testDir: './tests/frontend',
      use: { ...devices['Desktop Safari'], baseURL: FRONTEND_URL, storageState: FRONTEND_STATE },
      dependencies: ['setup-frontend'],
    },

    // 3) admin × 3 engines
    {
      name: 'admin-chromium',
      testDir: './tests/admin',
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_URL, storageState: ADMIN_STATE },
      dependencies: ['setup-admin'],
    },
    {
      name: 'admin-firefox',
      testDir: './tests/admin',
      use: { ...devices['Desktop Firefox'], baseURL: ADMIN_URL, storageState: ADMIN_STATE },
      dependencies: ['setup-admin'],
    },
    {
      name: 'admin-webkit',
      testDir: './tests/admin',
      use: { ...devices['Desktop Safari'], baseURL: ADMIN_URL, storageState: ADMIN_STATE },
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
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: { VITE_API_URL: API_URL },
    },
    {
      command: CI
        ? 'pnpm --filter admin preview --port 5174 --strictPort'
        : 'pnpm --filter admin dev',
      url: ADMIN_URL,
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
