import { type Locator, type Page, expect } from '@playwright/test';

/**
 * The reader feed (docs/e2e app map, `features/feed`). The signed-in default tab is
 * "Following" (empty for a writer who follows nobody), so this PO drives the public
 * **Latest** tab — newest published pieces, visible regardless of who you follow.
 *
 * Pagination is infinite-scroll (page size 20): a `role="status"` "Loading more"
 * spinner appears while the next page fetches, driven by an `aria-hidden` sentinel
 * at the list foot, so `loadMore()` scrolls to the bottom and waits for growth.
 */
export class FeedPage {
  constructor(private readonly page: Page) {}

  private get feed(): Locator {
    // The success-state list is a named <section> ("Latest feed" on the latest tab).
    return this.page.getByRole('region', { name: 'Latest feed' });
  }
  private get articles(): Locator {
    // Each PieceCard renders as an <article>; scope to the feed so the Discover rail
    // (a separate region) can never inflate the count.
    return this.feed.getByRole('article');
  }
  private pieceLink(title: string): Locator {
    return this.feed.getByRole('link', { name: title });
  }

  async gotoLatest(): Promise<void> {
    // The tab is URL-driven (useFeedParams), so navigate straight to it.
    await this.page.goto('/feed?tab=latest');
    // Generous first-render wait: Vite dev cold-compile + the first feed fetch (local only).
    await expect(this.feed).toBeVisible({ timeout: 30_000 });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.articles.first()).toBeVisible();
  }

  async articleCount(): Promise<number> {
    return this.articles.count();
  }

  /**
   * Trigger infinite scroll and wait for the next page to render. Re-scrolls on each
   * poll (the sentinel fires ~800px early) until the article count grows past `before`.
   */
  async loadMore(): Promise<void> {
    const before = await this.articleCount();
    await expect
      .poll(
        async () => {
          // Scroll the window to the foot — the infinite-scroll sentinel is a page-level
          // element watched by an IntersectionObserver against the viewport, so moving the
          // window (not a child container) is what fires fetchNextPage. String form keeps
          // this off the DOM lib (the e2e tsconfig has no `dom` types).
          await this.page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
          return this.articleCount();
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(before);
  }

  /** Click a piece card by its title. Navigates to the canonical piece path. */
  async openPiece(title: string): Promise<void> {
    await this.pieceLink(title).click();
  }

  /** Assert a piece with the given title is present in the (newest-first) Latest feed. */
  async expectPieceVisible(title: string): Promise<void> {
    await expect(this.pieceLink(title)).toBeVisible();
  }

  /** Assert a piece with the given title is absent from the Latest feed (e.g. after takedown). */
  async expectPieceNotVisible(title: string): Promise<void> {
    await expect(this.pieceLink(title)).toHaveCount(0);
  }
}
