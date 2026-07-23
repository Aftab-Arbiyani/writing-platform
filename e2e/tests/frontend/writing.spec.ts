import { test, expect } from '../../fixtures/test';
import { EditorPage } from '../../pages/frontend/editor-page';

/**
 * Frontend writing → publish (docs/e2e/06 Phase 2, landed early to prove depth).
 * Runs authenticated as the seeded writer (shared storageState).
 */
test.describe('@phase2 frontend writing', () => {
  test('a writer publishes a draft and it appears in their published list', async ({
    page,
    data,
  }) => {
    const title = data.pieceTitle();
    const editor = new EditorPage(page);

    await editor.goto();
    await editor.writePiece({
      title,
      body: 'A short story written by the end-to-end suite to prove the publish flow works.',
    });
    await editor.publish();

    // The publish flow lands on the published-drafts list; the new piece shows there.
    await expect(page.getByText(title)).toBeVisible();
  });
});
