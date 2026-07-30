import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { ReaderPage } from '../../pages/frontend/reader-page';
import { SearchPalette } from '../../pages/frontend/search-palette';

/**
 * Frontend search (docs/e2e/06 Phase 3, `features/search`). Arranges a uniquely-titled
 * published piece, finds it through the command palette, and follows the suggestion all the
 * way to the rendered reader view — the same deferral the feed spec discharges, now that
 * `/p/:slug` ships (W1, docs/45 §4.1; docs/e2e/06 §4).
 */
test.describe('@phase3 frontend search', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('a published piece is findable in search and links to its page', async ({
    page,
    api,
    data,
  }) => {
    const title = data.pieceTitle(); // e.g. "E2E Piece <uniq>" — a distinctive token
    await api.createPublishedPiece({ title });

    // Land on a page with the top bar (the command trigger lives there) before opening search.
    await page.goto('/feed');
    const search = new SearchPalette(page);
    await search.open();
    await search.type(title);

    // The piece surfaces as a suggestion (its accessible name is exactly the title).
    await search.expectPieceOption(title);
    await search.openOption(title);

    // Navigates to the canonical piece path AND renders the piece there.
    await expect(page).toHaveURL(/\/p\//);
    await new ReaderPage(page).expectRendered(title);
  });
});
