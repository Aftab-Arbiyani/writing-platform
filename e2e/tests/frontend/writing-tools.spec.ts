import { freshLogin } from '../../fixtures/auth';
import { asEntitledWriter } from '../../fixtures/entitlements';
import { AI_FLAG_TEST_TIMEOUT_MS, withAiFeatures, withAiFlags } from '../../fixtures/feature-flags';
import { test, expect } from '../../fixtures/test';
import { EditorPage } from '../../pages/frontend/editor-page';
import { WritingToolsDrawer } from '../../pages/frontend/writing-tools-drawer';

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
 * Every test that drives the drawer's INSIDES runs as an entitled writer
 * ([fixtures/entitlements.ts]) — D3 put Polish and Feedback behind `ai_writing`, which free does not
 * include, so the seeded writer meets an upgrade wall where the controls used to be. The flag-down
 * and editor-safety tests deliberately do NOT take it: they assert what a writer without it sees.
 */
const AI_WRITING = 'ai_writing';

/** D4 sells Story Map separately, on Pro and above. */
const STORY_INTELLIGENCE = 'story_intelligence';

/**
 * The five story-analysis feature flags one "Map this story" run spends, in the order the server
 * runs them. Written out rather than derived from `@umberleaf/shared`: the suite asserts against the
 * flag keys the server is expected to SEED, and importing the same helper both sides use would let
 * them move together and prove nothing — the rule the hardcoded price in `monetization.spec.ts`
 * follows for the same reason.
 */
const STORY_ANALYSIS_FLAGS = [
  'feature.ai.characterAnalysis.enabled',
  'feature.ai.plotAnalysis.enabled',
  'feature.ai.worldBuilding.enabled',
  'feature.ai.styleAnalysis.enabled',
  'feature.ai.storyTimeline.enabled',
];

/**
 * The in-editor **Writing tools** drawer (D5, was the AI assistant panel) — Polish, Manuscript
 * feedback and Story Map, mounted by the `/write` route.
 *
 * Nothing is mocked at the app boundary ([README §invariants]): a request travels the real flags,
 * the real orchestrator, the real prompt/context assembly, the real SSE endpoint and the client's
 * real delta accumulation. Only the vendor HTTP call is replaced — `StubAdapter` streams a fixed
 * passage with no vendor behind it, off unless `AI_STUB_ENABLED` says otherwise, which this stack
 * sets alongside `AI_DEFAULT_PROVIDER=stub`. That is the inert-port shape the third-party allowance
 * ([00 §6]) permits.
 *
 * **What D5 changed here, beyond names.** This file used to assert a `Continue writing` round trip:
 * a generation action that wrote new prose into the draft. That action is gone, and the round trip
 * is now `Condense` — a transform of the writer's own sentence. The mechanism under test is
 * identical (stream, accumulate, accept, autosave, reload); what it proves about the product is
 * different, and the difference is the decision.
 */
test.describe('@phase4 frontend writing tools', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  /**
   * **The master flag has to be UP for this to be reachable at all.** The editor hides the trigger
   * entirely whenever the platform is off for the instance or for the account (`editor-page.tsx`,
   * `docs/45` §4.10 — no stranded entry points). The AI flags ship dark
   * ([setup/ai-flags.global.ts]), so a test that opens this drawer has to raise the master switch
   * first.
   *
   * An EMPTY feature list raises the master and nothing else — this test is about the drawer opening
   * and closing, which no per-feature flag governs.
   */
  test('the drawer opens over the editor and closes again', async ({ page }) => {
    test.setTimeout(AI_FLAG_TEST_TIMEOUT_MS);
    await withAiFeatures([], 'writing tools: opens and closes', async () => {
      const editor = new EditorPage(page);
      await editor.goto();

      const drawer = new WritingToolsDrawer(page);
      await drawer.open();
      await expect(drawer.polishTab).toBeVisible();
      await expect(drawer.feedbackTab).toBeVisible();

      await drawer.close();
    });
  });

  /**
   * **Ask My Book had a tab here, and D5 removed it.** Asserted as an absence rather than left to
   * the tab count, because the deletion is the product claim: the audience objects to a tool that
   * answers questions about their manuscript on its own terms, and a tab that came back would be
   * the decision quietly reversing.
   */
  test('there is no Ask tab, on a draft that has one of everything else', async ({
    page,
    api,
    data,
  }) => {
    test.setTimeout(AI_FLAG_TEST_TIMEOUT_MS);
    await asEntitledWriter({ page, api, data }, AI_WRITING, async () => {
      await withAiFeatures([], 'writing tools: no ask tab', async () => {
        const editor = new EditorPage(page);
        await editor.goto();
        // A SYNCED draft, so Story Map's tab is present too — the point is that three tabs is the
        // whole set, which a blank draft (two tabs) could not establish.
        await editor.writePiece({ title: data.pieceTitle(), body: 'A door, and then a lamp.' });
        await editor.waitForSaved();

        const drawer = new WritingToolsDrawer(page);
        await drawer.open();
        await expect(drawer.storyMapTab).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Ask' })).toHaveCount(0);
        await expect(drawer.drawer.getByRole('tab')).toHaveCount(3);
      });
    });
  });

  /**
   * **Serial, and it has to be** — the same reason the monetization spec's flag block is. The AI
   * flags are single global rows shared by every worker, the suite runs `fullyParallel` across 8 of
   * them, and these tests disagree about what those rows should say: some assert the flag-down
   * surface, others raise them. Run in parallel they race, and the failure is the confusing kind —
   * "not available" appearing in a test that just enabled it. `describe.serial` pins them to one
   * worker in order. Everything outside this block is flag-independent and stays parallel.
   *
   * **`describe.serial` is not sufficient on its own.** It orders these tests against each other and
   * against nothing else; other files raise the same master row, which no `describe` modifier can
   * order. Each test below therefore also holds the AI feature-flag lock
   * ([fixtures/feature-flags.ts]) — the flag-down ones so that "down" is true rather than likely,
   * the raising ones so nobody observes it raised.
   */
  test.describe.serial('the AI feature flags', () => {
    // The lock queue is part of each test's own budget (see AI_FLAG_TEST_TIMEOUT_MS).
    test.describe.configure({ timeout: AI_FLAG_TEST_TIMEOUT_MS });

    /**
     * The shipped dark state: no control to be dead. A button fronting three "not available"
     * notices is the stranded entry point `docs/45` §4.10 forbids.
     *
     * `withAiFlags` (lock, raise nothing) is still right: this asserts the seeded state, and the
     * lock is what makes "the flags are down" true rather than merely likely.
     */
    test('it offers no entry point at all when the platform is off', async ({ page }) => {
      await withAiFlags('writing tools: platform off', async () => {
        const editor = new EditorPage(page);
        await editor.goto();

        const drawer = new WritingToolsDrawer(page);
        await drawer.expectNoEntryPoint();
      });
    });

    /**
     * **Three arrangements, because two later decisions each invalidated the original one-liner** —
     * and neither failed it at the time, which is the whole problem:
     *
     * - **B5** (2026-08-08) hid the editor's trigger while the platform is off, so "everything dark"
     *   can no longer even open the drawer.
     * - **D3** (2026-08-17) put both writing tabs behind the `ai_writing` entitlement, and the gate
     *   wraps the whole tab body — so a free writer gets the upgrade wall whatever the flags say,
     *   and the flag notice this test is about is unreachable.
     *
     * With the master up and `ai_writing` granted, "Not available yet" is attributable to
     * `feature.ai.craftCoach.enabled` alone — which is what the name claims.
     *
     * The entitlement rides an admin OVERRIDE on a throwaway account rather than a subscription:
     * same Entitlement Service and same snapshot the client gates on ([fixtures/api.ts]), with no
     * once-per-account state to collide with on a re-run. A fresh user rather than the seeded
     * writer so a leaked grant cannot quietly disarm D3's assertions in another spec.
     */
    test('Manuscript feedback is a separate, separately-gated tab', async ({ page, api, data }) => {
      await asEntitledWriter({ page, api, data }, AI_WRITING, async () => {
        await withAiFeatures(
          ['feature.ai.writingAssistant.enabled'],
          'writing tools: feedback gated',
          async () => {
            const editor = new EditorPage(page);
            await editor.goto();

            const drawer = new WritingToolsDrawer(page);
            await drawer.open();
            await drawer.selectTab('Feedback');

            // Feedback carries its own flag (`craft_coach` remains its wire id — D5 renamed copy,
            // not contracts), so with the master up and the entitlement granted this notice can
            // only be that flag.
            await drawer.expectFeatureOff();
          },
        );
      });
    });

    /**
     * **The leg that makes this a writing feature rather than a chat window: a suggestion generated,
     * streamed, and applied.**
     *
     * Every hop is the real one. The flags are raised through the admin API (server-side rows, not a
     * client switch), `POST /ai/completions/stream` runs the real orchestrator, and the drawer's
     * text arrives only through `aiApi.stream`'s SSE deltas — there is no other way for it to
     * appear, so matching the final text in full asserts that every chunk arrived and concatenated
     * in order.
     *
     * **`Condense`, not `Continue writing`.** The action D5 kept transforms the writer's own
     * sentence; the one it removed produced new prose. The stream/accept/persist mechanism is
     * unchanged, and that is the point — nothing about the plumbing needed to change for the product
     * to stop doing the thing this audience rejects.
     *
     * Only `writing_assistant` is raised, not every flag — the Feedback test above shares this
     * worker and asserts its own flag is still down, and enabling features nothing asserts would
     * make the suite's arrangement broader than its claims.
     */
    test('a suggestion streams into the drawer and lands in the draft', async ({
      page,
      api,
      data,
    }) => {
      await asEntitledWriter({ page, api, data }, AI_WRITING, async () => {
        await withAiFeatures(
          ['feature.ai.writingAssistant.enabled'],
          'writing tools: streamed suggestion',
          async () => {
            const editor = new EditorPage(page);
            await editor.goto();

            // Polish refuses to act on an empty document (`nothingToWorkWith` disables every
            // action), so the draft has to exist before the drawer can be driven — which is also
            // the realistic order: a writer asks for help with something they have written.
            const title = data.pieceTitle();
            await editor.writePiece({
              title,
              body: 'The lamp guttered twice before the door opened.',
            });
            await editor.waitForSaved();

            const drawer = new WritingToolsDrawer(page);
            await drawer.open();
            // Asserted before acting: a flag that failed to flip must read as unavailable, not as a
            // mysteriously dead button 30 seconds later.
            await drawer.expectAvailable();

            // D5 decision 9 — the disclosure sits with the tool, and a writer about to use it is
            // exactly who it is for. Asserted here rather than in a test of its own so it is
            // checked on a live tab rather than an arranged one.
            await expect(drawer.disclosure).toBeVisible();

            await drawer.runAction('Condense');
            await drawer.expectSuggestion(STUB_SUGGESTION);

            // ACCEPT — the drawer hands text to the editor's registered target; nothing in
            // `features/ai` touches the document (docs/45 §4.2).
            //
            // The autosave listener is armed BEFORE the click, because the draft has already saved
            // once and the indicator therefore still reads "Saved" — waiting on that would pass
            // instantly and the reload below would race the debounce (see `waitForNextAutosave`).
            const autosaved = editor.waitForNextAutosave();
            await drawer.acceptSuggestion();
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
     * **"Map this story" — the action D5 added, and the reason Story Map is a feature.**
     *
     * The graph is only ever written by `POST /story-intelligence/:storyId/analyze`, and until D5 no
     * client could reach it — so all eight views rendered "nothing here yet" on every story, forever
     * (48 §3.22d). This asserts the trigger exists, is reachable by an entitled writer, and starts a
     * run that reports progress.
     *
     * **It deliberately does not wait for the run to finish.** Five sequential stub completions is a
     * slow assertion for no extra claim: the step counter appearing proves the SSE stream opened and
     * the client is parsing `progress` frames, which is the client contract. What the five analyses
     * then do to the graph is the server's, and `story-intelligence.service.spec.ts` owns it.
     *
     * Two entitlements, because the drawer needs both: `ai_writing` to get past D3's gate on the
     * tabs beside it, `story_intelligence` for D4's gate on this one.
     */
    test('Map this story starts a run and reports its progress', async ({ page, api, data }) => {
      await asEntitledWriter({ page, api, data }, [AI_WRITING, STORY_INTELLIGENCE], async () => {
        // One run spends FIVE analyses and the server checks each kind's own feature flag before
        // it calls the model, so an empty flag set fails on the first one — the browser run that
        // found this showed `The AI feature "character_analysis" is not enabled.` in an alert
        // exactly where the step counter should have been. The drawer's tab gate is an
        // ENTITLEMENT (`story_intelligence`); these are the FLAGS, and both have to be up.
        await withAiFeatures(STORY_ANALYSIS_FLAGS, 'writing tools: map this story', async () => {
          const editor = new EditorPage(page);
          await editor.goto();
          await editor.writePiece({
            title: data.pieceTitle(),
            body: 'Aria left the city before the rain reached it. Her brother did not.',
          });
          await editor.waitForSaved();

          const drawer = new WritingToolsDrawer(page);
          await drawer.open();
          await drawer.selectTab('Story Map');
          await drawer.expectStoryMapSettled();

          await expect(drawer.mapStoryButton).toBeEnabled();
          await drawer.mapStoryButton.click();

          // A step counter, not a spinner: the writer is told how far through five analyses they
          // are, which is the whole reason this is SSE rather than a buffered POST.
          await expect(drawer.activePanel.getByRole('status')).toContainText(/Step \d of 5/, {
            timeout: 30_000,
          });
        });
      });
    });
  });

  /**
   * **T-7 was filed as a flake and was not one** (48 §3.22c, closed 2026-08-24). It failed for the
   * same deterministic reason as the flag tests above: `drawer.open()` waits on a trigger that is
   * hidden while the AI flags are dark, so "with the tools mounted" was asserted against an editor
   * that had none. Raising the master switch is what makes the test's own premise true; nothing
   * about the autosave path changed.
   */
  test('the editor still writes and autosaves with the tools mounted', async ({ page, data }) => {
    test.setTimeout(AI_FLAG_TEST_TIMEOUT_MS);
    await withAiFeatures([], 'writing tools: autosave with the drawer mounted', async () => {
      // The regression that matters most: the drawer adds a slot, a toggle and a target
      // registration to the editor. None of it may cost the writer their draft.
      const editor = new EditorPage(page);
      await editor.goto();

      const drawer = new WritingToolsDrawer(page);
      await drawer.open();
      await drawer.close();

      const title = data.pieceTitle();
      await editor.writePiece({ title, body: 'A line written with the tools mounted.' });
      await editor.waitForSaved();

      await editor.reload();
      await editor.expectRestored({
        title,
        body: 'A line written with the tools mounted.',
      });
    });
  });
});
