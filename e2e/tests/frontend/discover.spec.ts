import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { DiscoverPage } from '../../pages/frontend/discover-page';

/**
 * Frontend discovery / "For You" (docs/e2e/06 Phase 4, `m3` contract — route `/discover`).
 * Runs as the seeded writer. Every section is a real backend read (`/discover/*`,
 * `/feed/trending`) that hides itself when empty; featured/trending content is
 * admin/engagement-driven, so a freshly-seeded stack legitimately shows the page's own
 * "Nothing to discover yet." empty state. Both a rendered section and the empty state are
 * correct resolutions of the real reads — the only failure rejected is the load-error panel.
 *
 * We arrange a published piece to give the discovery reads something to potentially surface,
 * but the assertion does not require it to appear in any specific section (ranking/featuring
 * is engagement-driven and non-deterministic on a cold stack — see the page-object header).
 */
test.describe('@phase4 frontend discover', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('the discover surface renders its real-data reads without erroring', async ({
    page,
    api,
    data,
  }) => {
    await api.createPublishedPiece({ title: data.pieceTitle() });

    const discover = new DiscoverPage(page);
    await discover.goto();
    await discover.expectResolved();
  });

  /**
   * The two AF4 recommendation shelves W5 adds above the editorial ones (docs/45 §4, docs/36).
   *
   * **Only two, where mobile's AI screen has five** — trending, authors and genres would run the same
   * services the editorial sections below already render, so shipping them would print the same rows
   * twice on one page (recorded in 48 §4.1). The two asserted here are the ones that add something.
   *
   * Both tests hold the AI feature-flag lock ([fixtures/feature-flags.ts]): the flags are global rows
   * contended by `writing-tools.spec.ts` in parallel workers.
   */
  /**
   * D5 deleted the case that sat here: "the shelves stay silent while the AF4 flag is down". The
   * recommender calls no model, so the flag protected nothing and is gone. The shelves' real gate is
   * a SESSION, and the anonymous case below now asserts it — including that no request is made,
   * which the flag test could not have caught.
   */

  test('the recommendation shelves render, explained, for a signed-in reader', async ({
    page,
    api,
    data,
  }) => {
    // The shelves read `DiscoveryService.getPieces`, whose default kind is Latest — so one published
    // piece is enough to give both of them something to say.
    await api.createPublishedPiece({ title: data.pieceTitle() });

    const discover = new DiscoverPage(page);
    await discover.goto();
    // The reasons are the server's own, per kind (`RecommendationService.byKind`) — asserting
    // them is what makes these recommendations rather than a second copy of the feed.
    await discover.expectRecommendationShelf(
      'Recommended for you',
      'Recommended for you from across Umberleaf',
    );
    await discover.expectRecommendationShelf('Pick up next', 'Popular reads to pick up next');
  });
});

/**
 * The same page, signed out — the state D5 made the shelves' only gate.
 *
 * **The request assertion is the load-bearing half.** `/ai/recommendations` still needs a session,
 * and a 401 on a public page is not harmless: the api layer's `onUnauthorized()` drops the session
 * on the way past (48 §3.25). Before D5 the feature flag happened to prevent the request; now the
 * auth gate has to do it on purpose, and a render-only check would pass either way.
 */
test.describe('@phase4 frontend discover (signed out)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the shelves are silent, and ask for nothing', async ({ page, api, data }) => {
    await api.createPublishedPiece({ title: data.pieceTitle() });

    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/ai/recommendations')) requested.push(request.url());
    });

    const discover = new DiscoverPage(page);
    await discover.goto();
    await discover.expectResolved();
    // Silent, not empty and not explained: this is a public editorial surface that works without
    // recommendations.
    await discover.expectNoRecommendationShelves();

    expect(
      requested,
      'an authenticated read on a public page 401s, and a 401 outside /auth ends the session',
    ).toEqual([]);
  });
});
