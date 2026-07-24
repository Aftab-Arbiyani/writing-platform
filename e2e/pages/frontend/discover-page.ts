import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Discovery screen (docs/e2e/06 Phase 4, `features/search` discover-page — route `/discover`,
 * the `m3` "For You" surface). Every section is a real backend read (`/discover/*`,
 * `/feed/trending`) and hides itself when empty. Featured/trending content is admin/engagement
 * driven, so a freshly-seeded stack legitimately has none — the page then shows its own
 * "Nothing to discover yet." empty state. Both outcomes are correct resolutions of the real
 * reads; the only failure the spec rejects is the "Couldn't load discovery." error panel.
 */
export class DiscoverPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Discover' });
  }
  private get anySection(): Locator {
    // Each DiscoverSection renders its title as an <h2> (Featured pieces / Trending now / …).
    return this.page.getByRole('heading', { level: 2 });
  }
  private get emptyState(): Locator {
    return this.page.getByText('Nothing to discover yet.', { exact: true });
  }
  private get loadError(): Locator {
    return this.page.getByText("Couldn't load discovery.", { exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/discover');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /** Assert the page resolved to a real-data state (a section rendered OR the empty state), never an error. */
  async expectResolved(): Promise<void> {
    await expect(this.anySection.first().or(this.emptyState)).toBeVisible();
    await expect(this.loadError).toHaveCount(0);
  }
}
