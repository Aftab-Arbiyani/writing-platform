import { freshLogin } from '../../fixtures/auth';
import { test } from '../../fixtures/test';
import { AppNav } from '../../pages/frontend/app-nav';
import { ResiliencePage } from '../../pages/frontend/resilience-page';

/**
 * Frontend resilience: error / empty / offline states (docs/e2e/06 Phase 4 —
 * `app/pages/offline`, `route-error`, `not-found`). The defect class here is the app
 * mishandling a bad URL or a dropped connection, which the functional happy-paths never
 * hit. Runs authenticated as the seeded writer so every surface renders inside the app shell.
 */
test.describe('@phase4 frontend resilience', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('an unrouted path renders the not-found page with a way back', async ({ page, data }) => {
    const resilience = new ResiliencePage(page);
    // A unique, definitely-unrouted path (the router's catch-all → NotFound).
    await resilience.gotoUnknownAndExpectNotFound(`/no-such-route-${data.username()}`);
  });

  test('the offline page renders as a routed surface', async ({ page }) => {
    const resilience = new ResiliencePage(page);
    await resilience.gotoOfflineAndExpectRendered();
  });

  test('the offline banner appears when the browser goes offline and clears on reconnect', async ({
    page,
    context,
  }) => {
    const resilience = new ResiliencePage(page);
    const nav = new AppNav(page);

    // Load the authenticated shell first, then drop the connection: the app store's
    // window `offline` listener flips `isOnline`, surfacing the passive banner.
    await page.goto('/feed');
    await nav.expectAuthenticated();
    await resilience.expectOfflineBannerHidden();

    await context.setOffline(true);
    await resilience.expectOfflineBannerVisible();

    await context.setOffline(false);
    await resilience.expectOfflineBannerHidden();
  });
});
