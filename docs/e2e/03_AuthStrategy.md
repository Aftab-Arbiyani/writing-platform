# E2E 03 — Authentication Strategy

> **Status:** Binding. Auth is the mechanism that makes the whole suite fast: every test starts already
> logged in via a **saved session**, so we never repeat UI logins. This document specifies how sessions
> are produced, stored, reused, and which specs deliberately opt out to test login fresh. Grounded in
> the real app: login route `/auth/login`, guards `require-auth`/`require-guest`, httpOnly refresh
> cookie + `bootstrapSession()` silent restore, seed super-admin `admin@qalam.local`.

---

## 1. The problem storageState solves

If every test logged in through the UI, we'd pay a full login round-trip (form fill → API → redirect →
session bootstrap) hundreds of times, across three browsers — minutes of pure overhead, and every one a
chance to flake. Playwright's `storageState` lets us **log in once per role**, snapshot the browser
storage (cookies + `localStorage`), and **inject it into every test's context** so tests open
_already authenticated_.

**Why this is safe here:** the app already supports silent session restore. On boot, `bootstrapSession()`
uses the httpOnly refresh cookie (persisted when "Remember me" is on) to mint a fresh access token — so
a restored `storageState` yields a genuinely working session without a visible login.

---

## 2. Roles we snapshot

| Role            | Setup file                | Credentials source                                                          | storageState file     | Used by projects |
| --------------- | ------------------------- | --------------------------------------------------------------------------- | --------------------- | ---------------- |
| **Writer**      | `setup/frontend.setup.ts` | seeded e2e writer ([04](./04_TestData.md)) via env                          | `.auth/frontend.json` | `frontend-*`     |
| **Super-admin** | `setup/admin.setup.ts`    | seed default `admin@qalam.local` / `ChangeMe!SuperAdmin1` (env-overridable) | `.auth/admin.json`    | `admin-*`        |

Later phases may add more admin roles (moderator-only, plain reader) as additional setup files +
storageState + projects when a workflow needs a _different_ permission level. Keep the count minimal —
one snapshot per **distinct permission level actually exercised**, not one per user.

> **Credentials rule (MUST):** no credentials hardcoded in specs. Setup files read from env
> (`E2E_WRITER_EMAIL`, `E2E_WRITER_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`) with the seed
> defaults as fallback in non-prod. Mirrors how the backend super-admin seed reads
> `SUPER_ADMIN_*` env (`backend/src/database/seeds/super-admin.seed.ts`).

---

## 3. Setup projects — how the snapshot is produced

Each setup file is a Playwright _project_ (not a real test) that logs in through the **real UI** and
saves the state. It runs as a `dependency` of the app projects, so it's guaranteed to complete first.

```ts
// setup/frontend.setup.ts  (design shape)
import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../pages/shared/login-page';

const authFile = '.auth/frontend.json';

setup('authenticate as writer', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto(); // /auth/login
  await login.fill({
    email: process.env.E2E_WRITER_EMAIL ?? 'writer@qalam.local',
    password: process.env.E2E_WRITER_PASSWORD ?? 'ChangeMe!Writer1',
  });
  await login.tickRememberMe(); // persists the httpOnly refresh cookie
  await login.submit();
  await page.waitForURL('**/feed'); // redirect proves auth succeeded
  await expect(page.getByRole('button', { name: /account|profile/i })).toBeVisible();
  await page.context().storageState({ path: authFile }); // snapshot cookies + localStorage
});
```

- **MUST** tick **Remember me** — that's what persists the refresh cookie so the restored state can
  silently re-bootstrap. Without it the snapshot expires with the access token.
- **MUST** assert a post-login signal (URL + an authed-only element) before snapshotting. **Why:**
  snapshotting a half-loaded/failed login saves a broken session that fails every downstream test with
  a confusing error far from the cause.
- The admin setup is identical with super-admin creds and `waitForURL('**/dashboard')` (or the admin
  landing route).

---

## 4. How real specs consume the session

App projects declare `storageState` + `dependencies` ([01 §5](./01_Architecture.md)); every test in
them gets a pre-authenticated `page`:

```ts
// projects config (excerpt)
{ name: 'frontend-chromium',
  use: { baseURL: 'http://localhost:5173', storageState: '.auth/frontend.json' },
  dependencies: ['setup-frontend'] }
```

```ts
// tests/frontend/feed.spec.ts — no login code; already authed
test('writer sees their published piece in the feed', async ({ page }) => {
  await page.goto('/feed'); // already logged in
  // ...
});
```

**Rule (MUST):** authed specs never call login through the UI. If a spec needs to log in via the UI, it
belongs in an auth spec (§6) that opts out of stored state.

### 4.1 Fresh login per test (MUST for authed specs) — the rotating-refresh reality

**Discovered live (2026-07-23):** a single static `storageState` shared across many tests does **not** work
with this backend's auth model, and this was the top cause of Phase-2 failures. The web app keeps its access
token **in memory** and re-derives it from the httpOnly `qalam_rt` cookie on every cold load; the backend
uses **rotating refresh tokens with reuse-detection** (`token.service.rotate`). So the first test's boot-
refresh rotates (consumes) the snapshot's cookie, and every later test that restores the same snapshot
presents an already-used token → the family is revoked → the app drops to the login screen.

The fix (binding for authed specs): each test **logs in fresh into its own browser context** before the
first navigation, minting its own token family. Use the helper and a `beforeEach`:

```ts
// e2e/fixtures/auth.ts → freshLogin(page, 'writer' | 'admin')
test.beforeEach(async ({ page }) => {
  await freshLogin(page, 'writer'); // page.request login → qalam_rt in this context's jar
});
```

The setup projects + `storageState` are still declared (they also carry the `qalam-admin-remember` /
`qalam-*` localStorage the app needs to attempt the boot-refresh); `freshLogin` simply replaces the stale
cookie with an unused one so the boot-refresh succeeds and no test can invalidate another's session. **Why
not disable rotation for tests:** reuse-detection is a security property under test — weakening it in the
E2E backend would hide the very behaviour we ship.

---

## 5. Cross-engine reuse — one snapshot, three browsers

Setup projects run in **Chromium only**; the resulting `storageState` JSON (cookies + localStorage) is
plain data and is injected into Firefox and WebKit contexts identically. Auth state is not
engine-specific — a JWT cookie is a JWT cookie.

**Why not run setup per engine:** it triples setup cost for zero benefit; the session payload is
engine-agnostic. If a future engine-specific cookie quirk appears (e.g. WebKit SameSite handling), we
add a per-engine setup _only for that engine_, documented here.

> **Caveat:** `storageState` captures state at snapshot time. If a test _mutates_ the writer's own
> account (e.g. changes their own password/email in a settings spec), it invalidates the shared session
> for later tests. **Rule:** account-mutating specs create a **throwaway user** via the `api` fixture and
> log in as them within the test — never mutate the shared writer. See [04 §throwaway-users](./04_TestData.md).

---

## 6. Fresh-auth specs — the ones that DO log in

The auth flows themselves must be tested through the real UI, so `auth.spec.ts` **opts out** of stored
state and drives login/register/forgot/reset fresh:

```ts
// tests/frontend/auth.spec.ts
import { test, expect } from '../../fixtures/test';
test.use({ storageState: { cookies: [], origins: [] } }); // start logged OUT

test('a user can log in with valid credentials', async ({ page }) => {
  /* ... */
});
test('login rejects an invalid password with a field error', async ({ page }) => {
  /* ... */
});
test('a guarded route redirects an anonymous user to /auth/login', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/auth\/login/); // require-auth guard
});
test('an authed user hitting /auth/login is redirected away', async ({ page }) => {
  /* require-guest */
});
```

Auth specs to cover (Phase 1 — see [06_PhasePlan](./06_PhasePlan.md)):

| Flow                    | Frontend                                               | Admin                                                       |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Login (valid/invalid)   | ✅ writer login, wrong-password error                  | ✅ super-admin login, wrong-password error                  |
| Register + verify email | ✅ register → read Mailpit link → verify → land authed | — (admin accounts are provisioned, not self-registered)     |
| Forgot / reset password | ✅ request → Mailpit link → set new password → login   | ✅ (same flow if admin supports it)                         |
| Guarded route redirect  | ✅ `require-auth` → `/auth/login`                      | ✅ unauthorized → forbidden/redirect                        |
| Guest-only redirect     | ✅ `require-guest` (authed → away from /auth/login)    | ✅                                                          |
| Logout                  | ✅ session cleared, guarded route now redirects        | ✅                                                          |
| RBAC boundary           | —                                                      | ✅ a non-super-admin cannot reach a super-admin-only screen |

Email flows read the message from **Mailpit** (`utils/mailpit.ts`) — see [00 §6](./00_Overview.md) and
[04](./04_TestData.md).

---

## 7. Token expiry & refresh — a deliberate test

One spec (Phase 3) explicitly exercises **silent refresh**: with a short-lived access token, perform an
action after the access token would have expired and assert it still succeeds (the refresh cookie
minted a new one) — and, conversely, that a _revoked/expired refresh_ forces a redirect to login.
**Why:** silent refresh is the highest-value, least-visible auth integration; a component test can't
prove the real cookie round-trip works across a real navigation.

---

## 8. Security invariants asserted in E2E

- A guarded route with **no** session redirects to `/auth/login` (not a blank/errored page).
- An **expired/absent** session cannot read authed API data through the app (the app shows the
  logged-out state, not stale cached private data).
- An admin-only route is **not reachable** by a writer session (project isolation makes this natural:
  a `frontend`-role storageState hitting an admin route must be rejected).

These are lightweight but catch the worst regressions (a guard silently removed). Deep authz testing
remains the backend's job (`backend/test/permissions.e2e-spec.ts`); E2E asserts the _app wiring_ honors it.
