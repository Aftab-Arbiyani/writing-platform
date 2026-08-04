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

  // ── AF4 recommendation shelves (W5, docs/45 §4) ────────────────────────────

  /**
   * One recommendation shelf, addressed by its heading. `DiscoverSection` renders its title as an
   * `h2` and the shelf's items as a list beneath it, so the section is scoped by walking up from the
   * heading rather than by a landmark it does not have.
   */
  private shelfItems(title: string): Locator {
    return this.page
      .getByRole('heading', { level: 2, name: title })
      .locator('xpath=ancestor::section[1]')
      .getByRole('listitem');
  }

  /**
   * A shelf rendered, with every card explaining itself.
   *
   * `reason` is the string the server actually sends for that kind (`RecommendationService`), and
   * asserting it is what separates a recommendation from a ranked list: AF4's design law is that
   * every item says why it surfaced, and the reason is the one field `RecommendationCardView`
   * renders unconditionally.
   */
  async expectRecommendationShelf(title: string, reason: string): Promise<void> {
    const items = this.shelfItems(title);
    await expect(items.first()).toBeVisible({ timeout: 30_000 });
    await expect(items.first()).toContainText(reason);
  }

  /**
   * The shelves are **silent** — not empty, not an explanation — while the flag is down, for a
   * signed-out reader, or when the recommender answers nothing. The discover page is a public
   * editorial surface that works without AI, so explaining an AI feature nobody asked for would be
   * noise; this asserts that silence, which is the majority state of every deployment.
   */
  async expectNoRecommendationShelves(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { level: 2, name: 'Recommended for you' }),
    ).toHaveCount(0);
    await expect(this.page.getByRole('heading', { level: 2, name: 'Pick up next' })).toHaveCount(0);
  }
}
