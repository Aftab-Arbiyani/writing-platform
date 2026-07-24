import { freshLogin } from '../../fixtures/auth';
import { test } from '../../fixtures/test';
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
});
