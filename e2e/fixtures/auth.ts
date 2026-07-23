import { type Page, expect } from '@playwright/test';

/**
 * Per-test fresh authentication (docs/e2e/03). The backend uses **rotating refresh
 * tokens with reuse-detection** (token.service `rotate`): a refresh token is single-use,
 * and presenting an already-used one revokes the whole family. The web app keeps its
 * access token in memory and re-derives it from the httpOnly `qalam_rt` cookie on every
 * cold load — so a single static `storageState` shared across tests is consumed by the
 * first test's boot-refresh and rejected for every later test (→ the login screen).
 *
 * The fix: each test logs in through its OWN browser-context request (which shares the
 * context cookie jar), minting a fresh token family for that context alone. The app's
 * boot-refresh then succeeds, and no test can invalidate another's session.
 */
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';

const CREDENTIALS = {
  writer: {
    email: process.env.E2E_WRITER_EMAIL ?? 'writer@qalam.local',
    password: process.env.E2E_WRITER_PASSWORD ?? 'ChangeMe!Writer1',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'admin@qalam.local',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe!SuperAdmin1',
  },
} as const;

export type AuthRole = keyof typeof CREDENTIALS;

/**
 * Authenticate `page`'s context by logging in fresh as `role`. Call in a `beforeEach`
 * of authenticated specs BEFORE the first navigation — the `qalam_rt` cookie lands in
 * the context jar so the app boots signed in.
 */
export async function freshLogin(page: Page, role: AuthRole): Promise<void> {
  const { email, password } = CREDENTIALS[role];
  const res = await page.request.post(`${API_URL}/auth/login`, { data: { email, password } });
  expect(res.ok(), `fresh ${role} login failed (${res.status()})`).toBeTruthy();
}
