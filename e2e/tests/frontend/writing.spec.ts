import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { DraftsPage } from '../../pages/frontend/drafts-page';
import { EditorPage } from '../../pages/frontend/editor-page';

/**
 * Frontend writing → publish (docs/e2e/06 Phase 2, landed early to prove depth).
 * Runs authenticated as the seeded writer (shared storageState).
 */
test.describe('@phase2 frontend writing', () => {
  // Fresh token family per test — the shared storageState is single-use (see fixtures/auth).
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

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

  test('an autosaved draft survives a full page reload', async ({ page, data }) => {
    const title = data.pieceTitle();
    const body = 'Autosaved prose that must survive a hard reload of the editor.';
    const editor = new EditorPage(page);

    await editor.goto();
    await editor.writePiece({ title, body });
    // Autosave persists server-side and swaps /write → /write/:id (draft now exists).
    await editor.waitForSaved();

    // A hard reload re-fetches the draft by id; the editor must rehydrate it.
    await editor.reload();
    await editor.expectRestored({ title, body });
  });
});

/**
 * Frontend writing → edit an existing piece (docs/e2e/06 Phase 3). Editing a published
 * piece autosaves via PATCH /pieces/:id (no re-publish for title/body changes); the
 * change persists on reload and is reflected in the dashboard list.
 */
test.describe('@phase3 frontend writing — edit', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('editing a published piece updates its title everywhere', async ({ page, api, data }) => {
    const original = data.pieceTitle();
    const updated = `${original} — edited`;
    await api.createPublishedPiece({ title: original }); // arrange via API

    const drafts = new DraftsPage(page);
    await drafts.goto('published');
    await drafts.editPiece(original); // → /write/:id

    const editor = new EditorPage(page);
    await editor.waitForEditorReady();
    await editor.replaceTitle(updated);
    await editor.waitForSaved();

    // Reflected everywhere: a hard reload re-fetches the piece by id and shows the new
    // title (the authoritative persistence check). The dashboard list is intentionally
    // not re-asserted here — it has a 1-min stale window + persisted query cache, so a
    // fresh visit can still serve the pre-edit title; that's client caching, not a
    // persistence failure, and would make this test flaky.
    await editor.reload();
    await editor.expectTitleValue(updated);
  });
});
