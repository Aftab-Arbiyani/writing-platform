import { AI_FLAG_TEST_TIMEOUT_MS, withAiFeatures, withAiFlags } from '../../fixtures/feature-flags';
import { freshLogin, freshLoginAs } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { SearchPage } from '../../pages/frontend/search-page';

/** The AF4 flag this row runs on. The master switch is raised alongside it by `withAiFeatures`. */
const SEMANTIC_SEARCH_FLAG = 'feature.ai.semanticSearch.enabled';

/**
 * The stub AI provider's opening sentence — `STUB_PASSAGE` in
 * `backend/src/modules/ai/providers/adapters/stub.adapter.ts`, quoted the way `assistant.spec.ts`
 * quotes it and for the same reason: the suite asserts the value the server is expected to produce,
 * and a shared import would let both sides move together unnoticed.
 *
 * Only the first sentence, unlike the assistant spec's full-passage match. There the point IS the
 * whole text (it proves every SSE delta arrived and concatenated); here the answer arrives in one
 * response and `bodyFor` truncates it to the caller's `maxTokens`, so pinning the full string would
 * assert the synthesis prompt's token budget rather than the answer.
 */
const STUB_ANSWER_OPENING = 'This paragraph came from the stub AI provider';

/**
 * Retrieval-backed search (AF4 / W5, docs/45 §4, docs/36) — the `mode=ai` half of `/search`.
 *
 * **Why the flag-down state comes first here.** AF1 seeds `feature.ai.enabled` and every
 * `feature.ai.<feature>.enabled` disabled, so a refusal — not a result — is what every deployment
 * shows on the day it ships, and the row's own promise is that the AI half is *additive*: a reader
 * who is signed out, or on a stack that has not raised the flags, keeps exactly the search they had.
 * Those two assertions are the ones that fail if W5 ever stops being additive.
 *
 * Nothing is mocked at the app boundary ([README §invariants]): the flags are real rows flipped
 * through the admin API, the search is the real `POST /ai/search` through the real Retrieval Platform
 * (planner → retrievers → ranker → context assembly), and the optional answer is the real AF1
 * orchestrator. Only the vendor behind the answer is inert — `StubAdapter`, the port [06 §6]
 * specifies.
 *
 * **Every test here holds the AI feature-flag lock** ([fixtures/feature-flags.ts]): the flags are
 * global rows, `assistant.spec.ts` asserts them DOWN, and this file raises them — a contention that
 * spans files, which no `describe.serial` can order.
 */
test.describe('@phase4 frontend AI search', () => {
  // Every test here queues on the AI feature-flag lock, and that wait is spent inside the test.
  test.describe.configure({ timeout: AI_FLAG_TEST_TIMEOUT_MS });

  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('the engine is offered but explains itself when the AF4 flags are down', async ({
    page,
    data,
  }) => {
    const search = new SearchPage(page);
    await withAiFlags('ai-search: flags down', async () => {
      await search.gotoQuery(`Lantern ${data.username()}`, 'ai');

      // The toggle renders regardless of availability — hiding it would make a dark-launched
      // deployment look like a build without the feature. Only the gate decides whether a request
      // is made; never the presence of the control.
      await search.expectEngineOffered('ai');
      await search.expectAiOff();
      // Scope tabs are a keyword-search control and must not appear in AI mode: AF4 returns mixed
      // entity types, so a writers/pieces/tags tab would silently do nothing.
      await search.expectScopeTabsHidden();
      // Saved searches are an AF4 concept; with the engine unavailable the landing stays quiet
      // rather than showing a heading over nothing.
      await search.goto();
      await search.expectNoSavedSection();
    });
  });

  test('keyword search still answers with the AI engine unavailable', async ({
    page,
    api,
    data,
  }) => {
    // The additive promise, asserted rather than assumed: this is the engine every reader has, and
    // W5 may not have cost it anything.
    const title = data.pieceTitle();
    await api.createPublishedPiece({ title });

    const search = new SearchPage(page);
    await withAiFlags('ai-search: keyword unaffected', async () => {
      await search.gotoQuery(title, 'keyword');
      await search.expectEngineOffered('keyword');
      await search.expectKeywordResult(title);
    });
  });

  test('an AI search returns ranked, grounded results and can explain them', async ({
    page,
    api,
    data,
  }) => {
    // Two pieces sharing a distinctive token, so the query matches more than the seed: it gives the
    // ranker something to order, and the suggestions endpoint a title to offer that is not the query
    // itself (it drops the query from its own results).
    const token = data.username();
    const query = `Lantern ${token}`;
    const first = `Lantern ${token} at the harbour`;
    const second = `Lantern ${token} in the orchard`;
    await api.createPublishedPiece({ title: first, body: 'The lantern swung over black water.' });
    await api.createPublishedPiece({ title: second, body: 'A lantern hung between the trees.' });

    const search = new SearchPage(page);
    await withAiFeatures([SEMANTIC_SEARCH_FLAG], 'ai-search: ranked results', async () => {
      await search.gotoQuery(query, 'ai');

      // Ranked + grounded: the card carries the ranker's reason and its relevance, and the panel
      // reports what the server actually considered.
      await search.expectGroundedResult(first);
      await search.expectCandidateMeta();

      // Synthesis is opt-in per session — it is the only part of search that spends the reader's
      // allowance — so the answer must be absent until asked for, then grounded in these results.
      await expect(page.getByText('AI answer', { exact: true })).toHaveCount(0);
      await search.explainResults();
      await search.expectAnswer(STUB_ANSWER_OPENING);

      // "Try instead" is a row beside the results, not a dropdown while typing (mobile's search runs
      // on submit; this page debounces straight into the URL). Picking one commits a new query.
      const picked = await search.pickFirstSuggestion();
      expect(picked, 'a suggestion chip must carry the query it would run').not.toBe('');
    });
  });

  test('a search can be saved, re-run from the landing page, and removed', async ({
    page,
    api,
    data,
  }) => {
    /**
     * A THROWAWAY subscriber-less user, not the shared writer, for the reason the visual blocks
     * baseline uses one: saved searches are server-side, per-user, cumulative, and capped at 50. Run
     * as the writer, every failed run would leave a row behind until the cap started refusing saves —
     * a spec that poisons its own account over time. A fresh account also proves the default role
     * carries `ai.use`, which is what any real reader has.
     */
    const password = 'ChangeMe!SavedSearch1';
    const reader = await api.createVerifiedUser({
      email: `saved-search-${data.username()}@qalam.local`,
      username: data.username(),
      password,
    });
    await freshLoginAs(page, reader.email, password);

    const token = data.username();
    const query = `Lantern ${token}`;
    const name = `Lanterns ${token}`;
    await api.createPublishedPiece({ title: `Lantern ${token} at the harbour` });

    const search = new SearchPage(page);
    await withAiFeatures([SEMANTIC_SEARCH_FLAG], 'ai-search: saved searches', async () => {
      await search.gotoQuery(query, 'ai');
      await search.saveSearch(name);

      // It is on the account, not in this tab: a cold load of the landing page reads it back.
      await search.goto();
      await search.expectSaved(name);

      // Re-running restores the ENGINE as well as the query — answering a saved AF4 question with
      // the keyword engine would quietly call a different answer the same search.
      await search.runSaved(name);
      await expect(page).toHaveURL(new RegExp(`q=Lantern\\+${token}`));
      await search.expectEngineOffered('ai');

      await search.goto();
      await search.removeSaved(name);
      // Removed on the server, not just from the list: a cold load agrees.
      await search.goto();
      await expect(search.savedEntry(name)).toHaveCount(0);
    });
  });
});

/**
 * The signed-out reader on the same public page — **the case W5 shipped broken** (48 §3.9 W5-6).
 *
 * Every AF4 route is authenticated, so an anonymous visitor's gate reads answered 401; a 401 outside
 * `/auth/*` is terminal to the api client, which ends the session and clears the query cache. The
 * search page lost its results and the reading page lost the piece it had already fetched. The fix is
 * to resolve `signed-out` WITHOUT asking, which is what these tests pin from the outside.
 *
 * **No flag lock here, and that is the point**: with no session there is no request to gate, so the
 * outcome is identical whatever the flags say. A test that needed the lock would mean the fix had not
 * actually removed the request.
 */
test.describe('@phase4 frontend AI search (signed out)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('it invites the reader to sign in instead of breaking the page', async ({ page }) => {
    const search = new SearchPage(page);
    await search.gotoQuery('lantern harbour', 'ai');

    await search.expectEngineOffered('ai');
    await search.expectSignedOut();

    // The action returns the reader to the SEARCH they were running — the query and the engine both
    // live in the URL, so `returnTo` has to carry the query string, not just the path.
    await search.followSignIn();
    await expect(page).toHaveURL(/\/auth\/login\?returnTo=%2Fsearch%3Fq%3Dlantern.*mode%3Dai/);
  });

  test('keyword search is untouched for a signed-out reader', async ({ page, api, data }) => {
    const title = data.pieceTitle();
    await api.createPublishedPiece({ title });

    const search = new SearchPage(page);
    await search.gotoQuery(title, 'keyword');
    await search.expectKeywordResult(title);
    // Nothing AF4 leaks onto the page for a visitor who cannot use it.
    await search.expectNoSavedSection();
  });
});
