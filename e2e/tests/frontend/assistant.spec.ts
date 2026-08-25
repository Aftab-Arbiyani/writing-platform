import { freshLogin } from '../../fixtures/auth';
import { asEntitledWriter } from '../../fixtures/entitlements';
import { AI_FLAG_TEST_TIMEOUT_MS, withAiFeatures, withAiFlags } from '../../fixtures/feature-flags';
import { test, expect } from '../../fixtures/test';
import { PromptLibraryPage } from '../../pages/frontend/ai-pages';
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
 * Every test that drives the panel's INSIDES runs as an entitled writer
 * ([fixtures/entitlements.ts]) — D3 put both AF2 surfaces behind `ai_writing`, which free does not
 * include, so the seeded writer meets an upgrade wall where the controls used to be. The flag-down
 * and editor-safety tests deliberately do NOT take it: they assert what a writer without AI sees.
 */
const AI_WRITING = 'ai_writing';

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

  /**
   * **The master flag has to be UP for this to be reachable at all, and that is B5's doing.**
   * Before B5 the editor always rendered the AI trigger and the panel explained itself when the
   * flags were down; B5 hides the trigger entirely whenever AI is off for the instance or for the
   * account (`editor-page.tsx`, `docs/45` §4.10 — no stranded entry points). The AI flags ship dark
   * ([setup/ai-flags.global.ts]), so a test that opens this panel now has to raise the master switch
   * first, exactly as the two W9 a11y scans do ([a11y.spec.ts]).
   *
   * An EMPTY feature list raises the master and nothing else — this test is about the drawer opening
   * and closing, which no per-feature flag governs.
   */
  test('the assistant opens over the editor and closes again', async ({ page }) => {
    test.setTimeout(AI_FLAG_TEST_TIMEOUT_MS);
    await withAiFeatures([], 'assistant: opens and closes', async () => {
      const editor = new EditorPage(page);
      await editor.goto();

      const panel = new AssistantPanel(page);
      await panel.open();
      await expect(panel.assistantTab).toBeVisible();
      await expect(panel.coachTab).toBeVisible();

      await panel.close();
    });
  });

  /**
   * **Serial, and it has to be** — the same reason the monetization spec's flag block is
   * ([monetization.spec.ts]). The AI flags are single global rows shared by every worker, the suite
   * runs `fullyParallel` across 8 of them, and these three tests disagree about what those rows
   * should say: two assert the flag-down surface, the third raises them. Run in parallel they race,
   * and the failure is the confusing kind — "AI is turned off" appearing in a test that just enabled
   * it. `describe.serial` pins them to one worker in order. Everything outside this block is
   * flag-independent (the panel opens and the editor keeps working either way) and stays parallel.
   *
   * **`describe.serial` is no longer sufficient on its own, and W5 is why.** It orders these three
   * tests against each other and against nothing else; the AF4 surfaces (`ai-search.spec.ts`,
   * discover's shelves, the reader's recommender) raise the same master row from *other files*, which
   * no `describe` modifier can order. Each test below therefore also holds the AI feature-flag lock
   * ([fixtures/feature-flags.ts]) — the flag-down ones so that "down" is true rather than likely, the
   * raising one so nobody observes it raised.
   */
  test.describe.serial('the AI feature flags', () => {
    // The lock queue is part of each test's own budget (see AI_FLAG_TEST_TIMEOUT_MS).
    test.describe.configure({ timeout: AI_FLAG_TEST_TIMEOUT_MS });

    /**
     * **This assertion INVERTED at B5, and the test's old name is what gave it away.**
     * "It explains itself instead of offering dead controls" was the pre-B5 contract: the trigger
     * was always there and the panel carried the explanation. B5 went further and removed the
     * control — a Sparkles button fronting four "AI is off" notices is the stranded entry point
     * `docs/45` §4.10 forbids — so the honest assertion is now that there is **no** control to be
     * dead. Same claim as the old name made, enforced one step earlier.
     *
     * `withAiFlags` (lock, raise nothing) is still right: this asserts the shipped dark state, and
     * the lock is what makes "the flags are down" true rather than merely likely.
     */
    test('it offers no AI entry point at all when AI is off', async ({ page }) => {
      await withAiFlags('assistant: AI off', async () => {
        const editor = new EditorPage(page);
        await editor.goto();

        const panel = new AssistantPanel(page);
        await panel.expectNoEntryPoint();
      });
    });

    /**
     * **Three arrangements, because two later features each invalidated this test's original
     * one-liner** — and neither failed it at the time, which is the whole problem:
     *
     * - **B5** (2026-08-08) hid the editor's AI trigger while AI is off, so "everything dark" can
     *   no longer even open the panel.
     * - **D3** (2026-08-17) put both AF2 tabs behind the `ai_writing` entitlement, and the gate
     *   wraps the whole tab body — so a free writer gets "AI writing is on Plus and above"
     *   whatever the flags say, and the flag notice this test is about is unreachable.
     *
     * Run without all three the test proved nothing about the coach's own flag: the copy it
     * asserted came from the master switch (pre-B5), and would have come from the entitlement wall
     * (post-D3). With the master up and `ai_writing` granted, "Not available yet" is attributable
     * to `feature.ai.craftCoach.enabled` alone — which is what the name claims.
     *
     * The entitlement rides an admin OVERRIDE on a throwaway account rather than a subscription:
     * same Entitlement Service and same snapshot the client gates on ([fixtures/api.ts]), with no
     * once-per-account state to collide with on a re-run. A fresh user rather than the seeded
     * writer so a leaked grant cannot quietly disarm D3's assertions in another spec — the flag
     * hazard [fixtures/feature-flags.ts] is written against, in entitlement form.
     */
    test('the Craft Coach is a separate, separately-gated tab', async ({ page, api, data }) => {
      await asEntitledWriter({ page, api, data }, AI_WRITING, async () => {
        await withAiFeatures(
          ['feature.ai.writingAssistant.enabled'],
          'assistant: coach gated',
          async () => {
            const editor = new EditorPage(page);
            await editor.goto();

            const panel = new AssistantPanel(page);
            await panel.open();
            await panel.selectTab('Craft Coach');

            // Craft Coach carries its own flag, so it resolves its own availability — and with the
            // master switch up and the entitlement granted, this notice can only be that flag.
            await panel.expectFeatureOff();
          },
        );
      });
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
      await asEntitledWriter({ page, api, data }, AI_WRITING, async () => {
        await withAiFeatures(
          ['feature.ai.writingAssistant.enabled'],
          'assistant: streamed suggestion',
          async () => {
            const editor = new EditorPage(page);
            await editor.goto();

            // The assistant refuses to act on an empty document (`nothingToWorkWith` disables every
            // quick action), so the draft has to exist before the panel can be driven — which is
            // also the realistic order: a writer asks for help with something they have written.
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
            // assistant hands text to the editor's registered target; nothing in `features/ai`
            // touches the document (docs/45 §4.2).
            //
            // The autosave listener is armed BEFORE the click, because the draft has already saved
            // once and the indicator therefore still reads "Saved" — waiting on that would pass
            // instantly and the reload below would race the debounce (see `waitForNextAutosave`).
            const autosaved = editor.waitForNextAutosave();
            await panel.acceptSuggestion();
            await editor.expectBodyContains(STUB_SUGGESTION);

            // And it is really in the draft, not just painted into the DOM: the insert goes through
            // the editor's own commands, so autosave persists it with no AI-specific branch
            // anywhere, and a reload reads it back from the server.
            await autosaved;
            await editor.reload();
            await editor.expectBodyContains(STUB_SUGGESTION);
          },
        );
      });
    });

    /**
     * A Prompt Library preset arrives in the Ask AI field (W8 C2).
     *
     * **Here rather than in `ai-surfaces.spec.ts` because it needs the flag.** The prompt library
     * itself is flag-independent, but the assistant tab renders a notice instead of its controls while
     * `feature.ai.writingAssistant.enabled` is down — so the field to assert on does not exist at the
     * seeded default. Keeping this one test in the serial block leaves that whole file parallel.
     *
     * What this closes: mobile can only copy a preset to the clipboard
     * (`prompt_library_screen.dart:92,116`), which needs a secure context and can be denied outright.
     * Web hands it over directly, and the hand-off is only real if the editor actually receives it —
     * a spec that checked the store would pass while the panel ignored it.
     *
     * Nothing is sent: the box is filled, and the writer still edits and chooses when to run it.
     */
    test('a prompt-library preset lands in the assistant’s Ask AI field', async ({
      page,
      api,
      data,
    }) => {
      await asEntitledWriter({ page, api, data }, AI_WRITING, async () => {
        await withAiFeatures(
          ['feature.ai.writingAssistant.enabled'],
          'assistant: prompt library hand-off',
          async () => {
            const library = new PromptLibraryPage(page);
            await library.goto();
            await library.expectResolved();
            await library.useInAssistant('Essay');

            // Straight to the editor — the surface that has the manuscript the preset will act on.
            await expect(page).toHaveURL(/\/write$/);

            // The assistant disables its actions on an empty document, so give it something to work
            // on before asserting the panel is live (the precondition `expectAvailable` documents).
            const editor = new EditorPage(page);
            await editor.writePiece({
              title: data.pieceTitle(),
              body: 'The argument turns on a single unexamined assumption.',
            });
            await editor.waitForSaved();

            const panel = new AssistantPanel(page);
            await panel.open();
            await panel.expectAvailable();
            await expect(panel.activePanel.getByRole('textbox', { name: 'Ask AI' })).toHaveValue(
              'Sharpen the argument in this passage and make the reasoning clearer.',
            );
          },
        );
      });
    });
  });

  /**
   * **T-7 was filed as a flake and was not one** (48 §3.22c, closed 2026-08-24). It failed for the
   * same deterministic reason as the two tests above: `panel.open()` waits on a trigger B5 hides
   * while the AI flags are dark, so "with the assistant mounted" was asserted against an editor
   * that had no assistant mounted. Raising the master switch is what makes the test's own premise
   * true; nothing about the autosave path changed.
   */
  test('the editor still writes and autosaves with the assistant mounted', async ({
    page,
    data,
  }) => {
    test.setTimeout(AI_FLAG_TEST_TIMEOUT_MS);
    await withAiFeatures([], 'assistant: autosave with the panel mounted', async () => {
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
});
