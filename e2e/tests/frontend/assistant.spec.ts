import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { AssistantPanel } from '../../pages/frontend/assistant-panel';
import { EditorPage } from '../../pages/frontend/editor-page';

/**
 * The in-editor AI panel (W2/AF2, docs/45 §4.2) — `features/ai`'s first user-facing surface,
 * mounted by the `/write` route.
 *
 * **What this spec can and cannot prove.** The panel, its wiring to the editor, and its
 * availability gating are all real and asserted here against the real stack. A model-backed
 * *suggestion* is not: the AI feature flags are dark-launched (AF1 seeds them disabled) and the
 * E2E stack configures no AI provider, so there is nothing to generate one. Stubbing the
 * completion endpoint is not an option — [README §invariants] forbids faking success at the app
 * boundary, and the third-party allowance ([00 §6]) is for running against an inert *port*, which
 * the AI module does not yet have. That gap is a stack item, recorded in [06 §6], not a client
 * gap: the flags flipping on is the only thing standing between this panel and a suggestion.
 *
 * So what is asserted is the contract that is actually live: the assistant opens over the editor,
 * explains itself when AI is off, and never damages the writing surface it sits on.
 */
test.describe('@phase4 frontend AI assistant', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('the assistant opens over the editor and closes again', async ({ page }) => {
    const editor = new EditorPage(page);
    await editor.goto();

    const panel = new AssistantPanel(page);
    await panel.open();
    await expect(panel.assistantTab).toBeVisible();
    await expect(panel.coachTab).toBeVisible();

    await panel.close();
  });

  test('it explains itself instead of offering dead controls when AI is off', async ({ page }) => {
    const editor = new EditorPage(page);
    await editor.goto();

    const panel = new AssistantPanel(page);
    await panel.open();
    await panel.expectUnavailable();
  });

  test('the Craft Coach is a separate, separately-gated tab', async ({ page }) => {
    const editor = new EditorPage(page);
    await editor.goto();

    const panel = new AssistantPanel(page);
    await panel.open();
    await panel.selectTab('Craft Coach');

    // Craft Coach carries its own flag, so it resolves its own availability.
    await panel.expectUnavailable();
  });

  test('the editor still writes and autosaves with the assistant mounted', async ({
    page,
    data,
  }) => {
    // The regression that matters most: W2 adds a slot, a toggle and a target registration to
    // the editor. None of it may cost the writer their draft.
    const editor = new EditorPage(page);
    await editor.goto();

    const panel = new AssistantPanel(page);
    await panel.open();
    await panel.close();

    const title = data.pieceTitle();
    await editor.writePiece({ title, body: 'A line written with the assistant mounted.' });
    await editor.waitForSaved();

    await editor.reload();
    await editor.expectRestored({
      title,
      body: 'A line written with the assistant mounted.',
    });
  });
});
