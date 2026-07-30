import { freshLogin } from '../../fixtures/auth';
import { test } from '../../fixtures/test';
import { WriterStatsPage } from '../../pages/frontend/analytics-page';

/**
 * Frontend writer analytics (docs/e2e/06 Phase 4, `features/analytics` — route `/me/stats`).
 * Runs as the seeded writer. The dashboard reads real `/analytics/dashboard` aggregates
 * (docs mobile `m9`: lifetime-only, snapshots are on-demand so growth is often empty) and
 * resolves to one of two real-data states: the overview KPI cards (a writer with published
 * work) OR the "no published pieces" empty state. Either proves the read + render path;
 * the only failure the spec rejects is the load-error panel.
 *
 * We arrange a published piece first so the populated branch is the expected outcome, but
 * `expectResolved` accepts the empty state too — the point is that the analytics READ path
 * renders real data without erroring, not that a specific number appears.
 */
test.describe('@phase4 frontend analytics', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('the writer stats dashboard renders real analytics data', async ({ page, api, data }) => {
    // Arrange one published piece so the writer has lifetime aggregates to show.
    await api.createPublishedPiece({ title: data.pieceTitle() });

    const stats = new WriterStatsPage(page);
    await stats.goto();
    await stats.expectResolved();
  });
});
