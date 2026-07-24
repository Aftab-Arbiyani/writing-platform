import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Frontend resilience surfaces (docs/e2e/06 Phase 4 — `app/pages/*`): the not-found page,
 * the offline page, and the live offline banner. These are the "works but the network or the
 * URL went wrong" states functional happy-paths never exercise.
 *
 * - not-found: any unrouted path renders `NotFound` in the shell (also the router's 404
 *   `errorElement` branch — `RouteErrorBoundary` maps a 404 Response to this same page).
 * - offline page: the `/offline` destination. In the built app this resolves to the static
 *   PWA fallback (`public/offline.html`, the service-worker offline shell) rather than the
 *   React `Offline` route — so the spec asserts the offline shell rendered (heading + retry),
 *   tolerant of which of the two surfaces the runtime serves.
 * - offline banner: `OfflineBanner` (role=status) driven by the app store's window
 *   online/offline listeners — the live signal when the browser context goes offline.
 */
export class ResiliencePage {
  constructor(private readonly page: Page) {}

  private get notFoundTitle(): Locator {
    return this.page.getByText('This page has wandered off.', { exact: true });
  }
  private get backToFeed(): Locator {
    return this.page.getByRole('button', { name: 'Back to the feed' });
  }
  private get offlinePageTitle(): Locator {
    // The built app serves the static PWA fallback (`public/offline.html`) at `/offline` —
    // the service worker's offline shell, which shadows the React `Offline` route. Its copy
    // ("You’re offline", curly apostrophe, no period, as an <h1>) differs from the SPA
    // component, so match by role + a case-insensitive substring rather than exact text.
    return this.page.getByRole('heading', { name: /offline/i });
  }
  private get tryAgain(): Locator {
    return this.page.getByRole('button', { name: /try again/i });
  }
  private get offlineBanner(): Locator {
    // The passive offline notice ("You're offline — reconnecting…"), rendered only while
    // the app store's `isOnline` is false. Matched by role + substring to sidestep the
    // curly apostrophe / em-dash / ellipsis entities in the copy.
    return this.page.getByRole('status').filter({ hasText: /offline/i });
  }

  /** Navigate to an unrouted path and assert the 404 page rendered (with its exit). */
  async gotoUnknownAndExpectNotFound(path: string): Promise<void> {
    await this.page.goto(path);
    await expect(this.notFoundTitle).toBeVisible({ timeout: 30_000 });
    await expect(this.backToFeed).toBeVisible();
  }

  /** Navigate to the routed offline surface and assert it rendered (with its retry). */
  async gotoOfflineAndExpectRendered(): Promise<void> {
    await this.page.goto('/offline');
    await expect(this.offlinePageTitle).toBeVisible({ timeout: 30_000 });
    await expect(this.tryAgain).toBeVisible();
  }

  async expectOfflineBannerVisible(): Promise<void> {
    await expect(this.offlineBanner).toBeVisible();
  }

  async expectOfflineBannerHidden(): Promise<void> {
    await expect(this.offlineBanner).toBeHidden();
  }
}
