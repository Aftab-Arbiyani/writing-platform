import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { SearchPalette } from '../../pages/frontend/search-palette';

/**
 * Frontend search (docs/e2e/06 Phase 3, `features/search`). Arranges a uniquely-titled
 * published piece, finds it through the command palette, and asserts the suggestion
 * links to the canonical piece path. The reader view (`/p/:slug`) is a later frontend
 * epic, so we assert the navigation target, not a rendered reader page (as in feed).
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

    // Links to the canonical piece path (reader render deferred to the reader epic).
    await expect(page).toHaveURL(/\/p\//);
  });
});
