import { freshLogin } from '../../../fixtures/auth';
import { test, expect } from '../../../fixtures/test';
import { AppNav } from '../../../pages/frontend/app-nav';
import { LoginPage } from '../../../pages/shared/login-page';
import { expectNoHorizontalScroll, isNarrowerThan } from '../../../pages/shared/viewport';

/**
 * Frontend responsive (docs/e2e/06 Phase 5, [10 §3]). Runs ONLY in the mobile + tablet viewport
 * projects (frontend-mobile, frontend-tablet — see playwright.config `testMatch: /responsive\//`).
 *
 * This spec used to characterize a tracked ~24px (mobile) / ~40px (tablet) overflow within a bound
 * rather than gate on zero. That debt is FIXED (docs/e2e/10 §8.2): the frontend skips Tailwind's
 * preflight, which also skipped its `box-sizing: border-box` reset, so every `w-full` + `px-*`
 * container resolved to `100% + padding` and overflowed its parent by exactly its padding; the UA
 * body margin was unreset on top. Both are now set in frontend/src/styles/global.css, every reader
 * page measures 0px of overflow, and this spec holds the same strict zero-scroll gate as admin.
 */

test.describe('@phase5 @responsive frontend (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('reader pages do not scroll horizontally', async ({ page, api, data }) => {
    // Seed a piece so the feed renders real content (a wide card would be an additional culprit).
    await api.createPublishedPiece({ title: data.pieceTitle() });

    const pages: ReadonlyArray<{ path: string; ready: () => Promise<void> }> = [
      {
        path: '/feed?tab=latest',
        ready: async () =>
          void (await expect(page.getByRole('region', { name: 'Latest feed' })).toBeVisible({
            timeout: 30_000,
          })),
      },
      {
        path: '/write',
        ready: async () =>
          void (await expect(page.getByLabel('Title')).toBeVisible({ timeout: 30_000 })),
      },
      {
        path: '/me',
        ready: async () =>
          void (await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
            timeout: 30_000,
          })),
      },
      {
        path: '/settings/profile',
        ready: async () =>
          void (await expect(page.getByLabel('Pen name')).toBeVisible({ timeout: 30_000 })),
      },
    ];

    for (const { path, ready } of pages) {
      await page.goto(path);
      await ready();
      await expectNoHorizontalScroll(page, `frontend ${path}`);
    }
  });

  test('primary navigation is reachable at this viewport', async ({ page }) => {
    await page.goto('/feed?tab=latest');
    await expect(page.getByRole('region', { name: 'Latest feed' })).toBeVisible({
      timeout: 30_000,
    });

    if (isNarrowerThan(page)) {
      // < md: the bottom tab bar carries primary nav — it must be visible and its destinations must
      // point where they should. (Reachability by presence + correct href; a plain click can be
      // intercepted by a feed card's full-card overlay link, itself tracked as layering debt.)
      const primary = page.getByRole('navigation', { name: 'Primary' });
      await expect(primary).toBeVisible();
      const write = primary.getByRole('link', { name: 'Write' });
      await expect(write).toBeVisible();
      await expect(write).toHaveAttribute('href', '/write');
    } else {
      // >= md (tablet): the top bar carries nav; the account menu is its authenticated marker,
      // and the mobile tab bar is hidden.
      await new AppNav(page).expectAuthenticated();
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    }
  });
});

test.describe('@phase5 @responsive frontend login (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a writer can log in at this viewport', async ({ page }) => {
    const login = new LoginPage(page, { loginPath: '/auth/login', rememberLabel: 'Remember me' });
    await login.goto();
    await login.loginAs(
      process.env.E2E_WRITER_EMAIL ?? 'writer@qalam.local',
      process.env.E2E_WRITER_PASSWORD ?? 'ChangeMe!Writer1',
    );
    await page.waitForURL('**/feed');
    await new AppNav(page).expectAuthenticated();
  });
});
