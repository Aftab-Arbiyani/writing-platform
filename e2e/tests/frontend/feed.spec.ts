import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { FeedPage } from '../../pages/frontend/feed-page';
import { ReaderPage } from '../../pages/frontend/reader-page';

/**
 * Frontend feed — load, paginate, open (docs/e2e/06 Phase 2). Runs authenticated as
 * the seeded writer (shared storageState) but drives the public Latest tab, so the
 * pieces arranged here appear regardless of the writer's follow graph.
 *
 * Pagination note: the feed page size is 20, so we arrange 21 fresh published pieces
 * via the API to guarantee a second page exists on any DB state (docs/e2e/02 §4).
 *
 * "Open a piece": the reader view `/p/:slug` shipped in W1 (docs/45 §4.1), so this asserts
 * the full journey — the card navigates AND the piece renders. That discharges the deferral
 * this spec carried since Phase 2, when only the link URL could be checked (docs/e2e/06 §4).
 */
const FEED_PAGE_SIZE = 20;

test.describe('@phase2 frontend feed', () => {
  // Fresh token family per test — the shared storageState is single-use (see fixtures/auth).
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('the latest feed loads, paginates on scroll, and a piece links to its page', async ({
    page,
    api,
    data,
  }) => {
    // Arrange: enough fresh published pieces to force a second page.
    const titles = Array.from({ length: FEED_PAGE_SIZE }, () => data.pieceTitle());
    await Promise.all(titles.map((title) => api.createPublishedPiece({ title })));

    // The click target is published LAST, and awaited on its own, so it is the newest piece in
    // a newest-first feed and therefore on page one. Publishing it inside the batch above made
    // its position depend on how the concurrent creates interleaved — and on how many pieces
    // the rest of the suite published in parallel, which under a full run could push it past
    // the two loaded pages entirely. That was a real (and observed) source of flake.
    const openTarget = data.pieceTitle();
    await api.createPublishedPiece({ title: openTarget });

    const feed = new FeedPage(page);
    await feed.gotoLatest();
    await feed.expectLoaded();

    // Paginate: scrolling loads the next page, so the rendered count grows.
    const firstPage = await feed.articleCount();
    await feed.loadMore();
    expect(await feed.articleCount()).toBeGreaterThan(firstPage);

    // Open a piece: the card navigates to /p/:slug and the reader renders it there.
    await feed.openPiece(openTarget);
    await expect(page).toHaveURL(/\/p\//);
    await new ReaderPage(page).expectRendered(openTarget);
  });
});
