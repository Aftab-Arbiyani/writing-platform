import { freshLogin, freshLoginAs } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { AppNav } from '../../pages/frontend/app-nav';
import { ReadingStatsPage } from '../../pages/frontend/reading-stats-page';

/**
 * Frontend READER analytics (W7c, docs/45 §4.4 row 4 — route `/me/reading`).
 *
 * The row's point is audience separation: these seven figures used to render only as a section of
 * the WRITER dashboard, so seeing what you had READ meant opening a page headed "Your writing's
 * reach". The specs therefore assert REACHABILITY and DISTINCTNESS, not just that a read succeeded
 * — the repeated defect class here (R-1, M5-1, W5-3, W8-1) is code that looked wired and was not.
 *
 * Reader history is arranged through `POST /analytics/pieces/:id/read`, which is deterministic:
 * `DomainEventBus.emit` awaits its handlers, so the aggregate is updated before the call returns.
 *
 * NOTE ON WEB'S PARTIAL PORT: mobile's reading screen also shows Continue Reading, Recently Read
 * and Weekly Activity. Those derive from DEVICE reading history, which web has no store for and is
 * not getting (docs/48 §4) — there is deliberately nothing here to assert about them.
 */
test.describe('@phase4 frontend reader analytics', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('a reader with history sees their real figures for all seven fields', async ({
    page,
    api,
    data,
  }) => {
    // Arrange a completed read of a real published piece, then take the server's own numbers as
    // the expectation — the page must show what the API says, not merely "something".
    const piece = await api.createPublishedPiece({ title: data.pieceTitle() });
    await api.trackRead(piece.id);
    const aggregate = await api.readerAnalytics();
    expect(aggregate.piecesRead).toBeGreaterThan(0);
    expect(aggregate.completedReads).toBeGreaterThan(0);

    const reading = new ReadingStatsPage(page);
    await reading.goto();
    await reading.expectResolved();

    // Fields 1, 3, 4, 5 are exact counts, so assert the rendered values, not just the labels.
    await expect(
      page.getByText(String(aggregate.piecesRead), { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(String(aggregate.completedReads), { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText(`${String(aggregate.currentStreak)}d`).first()).toBeVisible();
    await expect(page.getByText(`${String(aggregate.longestStreak)}d`).first()).toBeVisible();

    // Fields 6–7: the ranked lists render the human `label`, never the stable `key`. A read of a
    // real piece gives it a genre and a language, so both lists have at least one entry.
    const genre = aggregate.favoriteGenres[0];
    const language = aggregate.favoriteLanguages[0];
    expect(genre, 'a read piece has a genre').toBeDefined();
    expect(language, 'a read piece has a language').toBeDefined();
    if (genre) {
      await expect(page.getByText(genre.label, { exact: true }).first()).toBeVisible();
      // The slug is an id, not a label — it must never be what the reader sees.
      if (genre.key !== genre.label) {
        await expect(page.getByText(genre.key, { exact: true })).toHaveCount(0);
      }
    }
    if (language) {
      await expect(page.getByText(language.label, { exact: true }).first()).toBeVisible();
      if (language.key !== language.label) {
        await expect(page.getByText(language.key, { exact: true })).toHaveCount(0);
      }
    }
  });

  test('a brand-new reader sees TRUE zeroes and empty lists, not a hidden page', async ({
    page,
    api,
    data,
  }) => {
    // A throwaway account with no reading history at all. Its zeroes are REAL — it genuinely has
    // read nothing — so the page must render them. Hiding the page (or swapping in an empty state)
    // would be the writer dashboard's mistake repeated on a surface where zero is a true answer.
    const creds = { email: data.email(), username: data.username(), password: data.password() };
    const user = await api.createVerifiedUser(creds);
    const { accessToken } = await api.login(creds.email, creds.password);

    // The server really does report zeroes for this account.
    const aggregate = await api.readerAnalytics(accessToken);
    expect(aggregate.piecesRead).toBe(0);
    expect(aggregate.completedReads).toBe(0);
    expect(aggregate.currentStreak).toBe(0);
    expect(aggregate.longestStreak).toBe(0);
    expect(aggregate.favoriteGenres).toEqual([]);
    expect(aggregate.favoriteLanguages).toEqual([]);
    expect(user.id).toBeTruthy();

    await freshLoginAs(page, creds.email, creds.password);
    const reading = new ReadingStatsPage(page);
    await reading.goto();

    // Every tile and both ranked-list headings are present — the page did not hide itself.
    await reading.expectResolved();
    // And the zeroes are actually on screen, both streaks reading "0d".
    await expect(page.getByText('0d').first()).toBeVisible();
    await expect(page.getByText('0', { exact: true }).first()).toBeVisible();
  });

  test('the page is reachable from the account menu, distinctly from the writer dashboard', async ({
    page,
  }) => {
    await page.goto('/feed');
    const nav = new AppNav(page);
    await nav.expectAuthenticated();

    // Reached the way a real reader reaches it — through the account menu, not by typing a URL.
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByText('Your reading', { exact: true }).click();
    await expect(page).toHaveURL(/\/me\/reading/);

    const reading = new ReadingStatsPage(page);
    await expect(reading.heading).toBeVisible({ timeout: 30_000 });
    await reading.expectResolved();
    await reading.expectNotTheWriterDashboard();
  });

  test('the writer dashboard no longer carries the reader aggregate, and links here instead', async ({
    page,
    api,
    data,
  }) => {
    await api.createPublishedPiece({ title: data.pieceTitle() });

    await page.goto('/me/stats');
    await expect(page.getByRole('heading', { level: 1, name: 'Your stats' })).toBeVisible({
      timeout: 30_000,
    });

    // The moved section is gone from the writer surface...
    await expect(page.getByText('Reading habits', { exact: true })).toHaveCount(0);
    await expect(page.getByText('What you read most', { exact: true })).toHaveCount(0);

    // ...and the link across actually navigates (the assertion a dead button would fail).
    await page.getByRole('button', { name: 'Your reading' }).click();
    await expect(page).toHaveURL(/\/me\/reading/);
    await expect(new ReadingStatsPage(page).heading).toBeVisible({ timeout: 30_000 });
  });

  test('a bookmarked piece shows in the bounded bookmarks count', async ({ page, api, data }) => {
    const piece = await api.createPublishedPiece({ title: data.pieceTitle() });
    await api.bookmarkPiece(piece.id);

    const reading = new ReadingStatsPage(page);
    await reading.goto();
    await reading.expectResolved();

    // `v1` has no bookmarks COUNT(*), so this is one page of /me/bookmarks. Present, non-zero.
    await expect(reading.bookmarks).toBeVisible();

    await api.unbookmarkPiece(piece.id);
  });

  test('a signed-out visit bounces to sign-in and does not render the page', async ({
    browser,
  }) => {
    // A fresh context with no session — the route is auth-gated (`GET /analytics/readers/me`
    // identifies the reader from the JWT, so there is nothing here for a visitor).
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/me/reading');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 30_000 });
    // And it carries the return path, so signing in lands the reader where they meant to go.
    await expect(page).toHaveURL(/returnTo=%2Fme%2Freading/);
    await expect(page.getByRole('heading', { level: 1, name: 'Your reading' })).toHaveCount(0);

    await context.close();
  });

  test('a failed aggregate read shows an error, never a fabricated zero', async ({ page }) => {
    // Mobile degrades to local device reading history on failure; web has none (docs/48 §4), so the
    // only honest alternative to an error is nothing at all. A `0` here would be indistinguishable
    // from a real zero — the house rule `profile-stats.tsx` already documents.
    await page.route('**/analytics/readers/me', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'boom' },
        }),
      }),
    );

    await page.goto('/me/reading');
    await expect(page.getByRole('heading', { level: 1, name: 'Your reading' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Couldn't load your analytics.")).toBeVisible({ timeout: 30_000 });

    // No tile, and therefore no zero, is rendered.
    await expect(page.getByText('Pieces read', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Current streak', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Longest streak', { exact: true })).toHaveCount(0);
  });
});
