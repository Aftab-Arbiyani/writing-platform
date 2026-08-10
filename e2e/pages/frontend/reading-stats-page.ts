import { type Locator, type Page, expect } from '@playwright/test';

/**
 * The reader's own stats (W7c, docs/45 §4.4 row 4) — route `/me/reading`.
 *
 * A READER surface, and the reason it exists as its own route: before W7c these figures rendered
 * only as a section of the WRITER dashboard at `/me/stats`, so the sole way to see what you had
 * READ was a page headed "Your writing's reach". The page object therefore exposes the writer
 * dashboard's markers too — asserting their ABSENCE here is what proves the separation.
 *
 * Auth-gated: `GET /analytics/readers/me` identifies the reader from the JWT, so the route sits
 * inside `RequireAuth` and a signed-out visit bounces to sign-in carrying `returnTo`.
 *
 * Unlike the writer dashboard, this page has NO empty state to resolve to: a new reader's zeroes
 * are true, so the tiles always render. The only outcome it rejects is the load-error panel.
 */
export class ReadingStatsPage {
  constructor(private readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Your reading' });
  }

  /** A `MetricCard` label — present once the aggregate has arrived, at any value including 0. */
  private tile(label: string): Locator {
    return this.page.getByText(label, { exact: true });
  }

  get piecesRead(): Locator {
    return this.tile('Pieces read');
  }
  get readingTime(): Locator {
    return this.tile('Reading time');
  }
  get completedReads(): Locator {
    return this.tile('Completed reads');
  }
  get currentStreak(): Locator {
    return this.tile('Current streak');
  }
  get longestStreak(): Locator {
    return this.tile('Longest streak');
  }
  get bookmarks(): Locator {
    return this.tile('Bookmarks');
  }

  get favouriteGenres(): Locator {
    return this.page.getByRole('heading', { name: 'Favourite genres' });
  }
  get favouriteLanguages(): Locator {
    return this.page.getByRole('heading', { name: 'Favourite languages' });
  }

  /** The link across to the writer surface, named for ITS audience. */
  get writerStatsLink(): Locator {
    return this.page.getByRole('button', { name: 'Your writing’s stats' });
  }

  private get loadError(): Locator {
    return this.page.getByText("Couldn't load your analytics.", { exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/me/reading');
    // Generous first-render wait for the Vite dev cold-compile of this lazy route (local only).
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Assert the reader aggregate rendered — all five always-present figures, both ranked lists, and
   * no error panel. Zeroes count as rendered: for a reader who has read nothing they are TRUE, and
   * the page must show them rather than hide itself.
   */
  async expectResolved(): Promise<void> {
    await expect(this.piecesRead).toBeVisible({ timeout: 30_000 });
    await expect(this.readingTime).toBeVisible();
    await expect(this.completedReads).toBeVisible();
    await expect(this.currentStreak).toBeVisible();
    await expect(this.longestStreak).toBeVisible();
    await expect(this.favouriteGenres).toBeVisible();
    await expect(this.favouriteLanguages).toBeVisible();
    await expect(this.loadError).toHaveCount(0);
  }

  /**
   * Assert this is unmistakably the reader surface: no writer metric appears, and the writer
   * dashboard is reachable as a separate, differently-named destination.
   */
  async expectNotTheWriterDashboard(): Promise<void> {
    await expect(this.page.getByRole('heading', { level: 1, name: 'Your stats' })).toHaveCount(0);
    await expect(this.page.getByText('Total views', { exact: true })).toHaveCount(0);
    await expect(this.page.getByText('Followers gained', { exact: true })).toHaveCount(0);
    await expect(this.page.getByText('Top performer', { exact: true })).toHaveCount(0);
    await expect(this.writerStatsLink).toBeVisible();
  }
}
