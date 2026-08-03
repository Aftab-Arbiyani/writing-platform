import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { AssistantPanel } from '../../pages/frontend/assistant-panel';
import { EditorPage } from '../../pages/frontend/editor-page';

/**
 * The exact passage the stub AI provider streams — `STUB_PASSAGE` in
 * `backend/src/modules/ai/providers/adapters/stub.adapter.ts`. Duplicated as a literal for the same
 * reason the monetization spec hardcodes `499` from the pricing config: the suite asserts against the
 * value the server is expected to produce, and a shared import would let both sides move together
 * without anything noticing. If this string ever needs updating, that is the signal it was meant to
 * be — the stub's output is a constant precisely because a visual baseline depends on it.
 */
const STUB_SUGGESTION =
  'This paragraph came from the stub AI provider, not from a language model. ' +
  'It is a fixed passage streamed one fragment at a time so the assistant, its accumulation of ' +
  'deltas, and the accept path can all be exercised end to end without calling a vendor. ' +
  'Nothing here was generated, and nothing about it will change between runs.';

/**
 * The in-editor AI panel (W2/AF2, docs/45 §4.2) — `features/ai`'s first user-facing surface,
 * mounted by the `/write` route.
 *
 * **Both halves of this row are now asserted.** The panel, its editor wiring and its availability
 * gating were always real here; what was missing was a generated suggestion, and the reason was
 * environmental rather than a client gap — ~~the E2E stack configures no AI provider, so there is
 * nothing to generate one~~. That premise was the same one W4 corrected for payments: the module had
 * no inert port, it *refused*, because every adapter is credential-gated. `StubAdapter` fills that
 * gap ([06 §6]) — it streams a fixed passage with no vendor behind it, off unless `AI_STUB_ENABLED`
 * says otherwise, which this stack sets alongside `AI_DEFAULT_PROVIDER=stub`.
 *
 * Nothing is mocked at the app boundary ([README §invariants]): the request travels the real flags,
 * the real orchestrator, the real prompt/context assembly, the real SSE endpoint and the client's
 * real delta accumulation. Only the vendor HTTP call is replaced, which is precisely the inert-port
 * shape the third-party allowance ([00 §6]) permits.
 *
 * So this file asserts the flag-down contract (every deployment's starting state), the panel's
 * safety around the writing surface, AND — in the serial block below — a suggestion streaming in and
 * landing in the draft.
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

  /**
   * **Serial, and it has to be** — the same reason the monetization spec's flag block is
   * ([monetization.spec.ts]). The AI flags are single global rows shared by every worker, the suite
   * runs `fullyParallel` across 8 of them, and these three tests disagree about what those rows
   * should say: two assert the flag-down surface, the third raises them. Run in parallel they race,
   * and the failure is the confusing kind — "AI is turned off" appearing in a test that just enabled
   * it. `describe.serial` pins them to one worker in order. Everything outside this block is
   * flag-independent (the panel opens and the editor keeps working either way) and stays parallel.
   */
  test.describe.serial('the AI feature flags', () => {
    test('it explains itself instead of offering dead controls when AI is off', async ({
      page,
    }) => {
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

    /**
     * **The leg that had never been asserted: a suggestion generated, streamed, and applied.**
     *
     * Every hop is the real one. The flags are raised through the admin API (server-side rows, not a
     * client switch), `POST /ai/completions/stream` runs the real orchestrator, and the panel's text
     * arrives only through `aiApi.stream`'s SSE deltas — there is no other way for it to appear, so
     * the final text matching in full is an assertion that every chunk arrived and concatenated in
     * order. What is NOT real is the vendor: `StubAdapter` streams a fixed passage instead of calling
     * one, which is the inert port [00 §6] allows and [06 §6] specifies.
     *
     * Only `writing_assistant` is raised, not every AI flag — the Craft Coach test above shares this
     * worker and asserts its own flag is still down, and enabling features nothing asserts would make
     * the suite's own arrangement broader than its claims.
     */
    test('a suggestion streams into the panel and lands in the draft', async ({
      page,
      api,
      data,
    }) => {
      const previous = await api.enableAiFeatures(['feature.ai.writingAssistant.enabled']);
      try {
        const editor = new EditorPage(page);
        await editor.goto();

        // The assistant refuses to act on an empty document (`nothingToWorkWith` disables every
        // quick action), so the draft has to exist before the panel can be driven — which is also
        // the realistic order: a writer asks for help with something they have written.
        const title = data.pieceTitle();
        await editor.writePiece({
          title,
          body: 'The lamp guttered twice before the door opened.',
        });
        await editor.waitForSaved();

        const panel = new AssistantPanel(page);
        await panel.open();
        // Asserted before acting: a flag that failed to flip must read as "AI is off", not as a
        // mysteriously dead button 30 seconds later.
        await panel.expectAvailable();

        await panel.runQuickAction('Continue writing');
        await panel.expectSuggestion(STUB_SUGGESTION);

        // ACCEPT — the half that makes this a writing feature rather than a chat window. The
        // assistant hands text to the editor's registered target; nothing in `features/ai` touches
        // the document (docs/45 §4.2).
        //
        // The autosave listener is armed BEFORE the click, because the draft has already saved once
        // and the indicator therefore still reads "Saved" — waiting on that would pass instantly and
        // the reload below would race the debounce (see `waitForNextAutosave`).
        const autosaved = editor.waitForNextAutosave();
        await panel.acceptSuggestion();
        await editor.expectBodyContains(STUB_SUGGESTION);

        // And it is really in the draft, not just painted into the DOM: the insert goes through the
        // editor's own commands, so autosave persists it with no AI-specific branch anywhere, and a
        // reload reads it back from the server.
        await autosaved;
        await editor.reload();
        await editor.expectBodyContains(STUB_SUGGESTION);
      } finally {
        await api.restoreFeatureFlags(previous);
      }
    });
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
