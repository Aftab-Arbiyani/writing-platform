import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { FeedPage } from '../../pages/frontend/feed-page';
import { ModerationPage } from '../../pages/admin/moderation-page';

/**
 * Admin moderation (docs/e2e/06 Phase 3, §8 cross-app). Reports are arranged via API
 * (a throwaway reporter files against a writer's published piece), the decision is made
 * through the admin UI, and the deepest assertion — a takedown removing the piece from
 * the reader feed — spans both apps against the shared backend.
 */
const FRONTEND_URL = process.env.E2E_BASE_URL_FRONTEND ?? 'http://localhost:5173';

test.describe('@phase3 admin moderation', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('the queue lists a reported piece and a takedown hides it from the reader feed', async ({
    page,
    api,
    data,
    browser,
  }) => {
    // Arrange: a uniquely-titled published piece + a throwaway reporter's report.
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });
    const reporter = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    const reporterToken = await api.loginToken(reporter.email, reporter.password);
    const report = await api.report(
      { entityType: 'piece', entityId: piece.id, reason: 'spam' },
      reporterToken,
    );

    // The piece is visible in the public Latest feed before the takedown (fresh context).
    const before = await browser.newContext({
      baseURL: FRONTEND_URL,
      storageState: { cookies: [], origins: [] },
    });
    const beforeFeed = new FeedPage(await before.newPage());
    await beforeFeed.gotoLatest();
    await beforeFeed.expectPieceVisible(title);
    await before.close();

    // Act: resolve the report as a takedown ("Remove content") via the admin UI.
    const moderation = new ModerationPage(page);
    await moderation.goto();
    await moderation.expectReportListed(report.id);
    await moderation.resolve(report.id, 'Remove content');

    // Assert the server-side side effect.
    expect((await api.getReport(report.id)).status).toBe('resolved');

    // Cross-app: the piece is gone from the reader feed.
    const after = await browser.newContext({
      baseURL: FRONTEND_URL,
      storageState: { cookies: [], origins: [] },
    });
    const afterFeed = new FeedPage(await after.newPage());
    await afterFeed.gotoLatest();
    await afterFeed.expectPieceNotVisible(title);
    await after.close();
  });

  test('dismissing a report resolves it without removing the piece', async ({
    page,
    api,
    data,
  }) => {
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });
    const reporter = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    const reporterToken = await api.loginToken(reporter.email, reporter.password);
    const report = await api.report(
      { entityType: 'piece', entityId: piece.id, reason: 'spam' },
      reporterToken,
    );

    const moderation = new ModerationPage(page);
    await moderation.goto();
    await moderation.resolve(report.id, 'Dismiss report');

    // Dismissed → report closed; the piece stays published (still in the feed).
    expect((await api.getReport(report.id)).status).toBe('dismissed');
  });
});
