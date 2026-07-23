import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { FeedPage } from '../../pages/frontend/feed-page';

/**
 * Frontend feed — load, paginate, open (docs/e2e/06 Phase 2). Runs authenticated as
 * the seeded writer (shared storageState) but drives the public Latest tab, so the
 * pieces arranged here appear regardless of the writer's follow graph.
 *
 * Pagination note: the feed page size is 20, so we arrange 21 fresh published pieces
 * via the API to guarantee a second page exists on any DB state (docs/e2e/02 §4).
 *
 * "Open a piece" note: the reader/piece view (`/p/:slug`) is a later frontend epic
 * (frontend/src/lib/routes.ts) and is not yet routed — clicking a card navigates to
 * the canonical piece path but currently renders NotFound. We assert the feed→reader
 * LINK is wired to the right URL; the reader-page render assertion is deferred to the
 * epic that ships it (tracked in docs/e2e/06 §2.1 + README status).
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
    // Arrange: enough fresh published pieces to force a second page. `openTarget` is
    // the one we later click, kept as its own definite value for a clean assertion.
    const openTarget = data.pieceTitle();
    const titles = [openTarget, ...Array.from({ length: FEED_PAGE_SIZE }, () => data.pieceTitle())];
    await Promise.all(titles.map((title) => api.createPublishedPiece({ title })));

    const feed = new FeedPage(page);
    await feed.gotoLatest();
    await feed.expectLoaded();

    // Paginate: scrolling loads the next page, so the rendered count grows.
    const firstPage = await feed.articleCount();
    await feed.loadMore();
    expect(await feed.articleCount()).toBeGreaterThan(firstPage);

    // Open a piece: after loadMore every arranged piece is rendered, so any title is
    // present. The card links to /p/:slug (reader render deferred — see file header).
    await feed.openPiece(openTarget);
    await expect(page).toHaveURL(/\/p\//);
  });
});
