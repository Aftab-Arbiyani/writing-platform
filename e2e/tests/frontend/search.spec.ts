import { freshLogin, freshLoginAs } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { ReaderPage } from '../../pages/frontend/reader-page';
import { SearchPage } from '../../pages/frontend/search-page';
import { SearchPalette } from '../../pages/frontend/search-palette';

/**
 * Frontend search (docs/e2e/06 Phase 3, `features/search`).
 *
 * **This file absorbed `ai-search.spec.ts`, which D5 deleted.** There used to be two engines behind
 * `/search` — E8 full-text and a retrieval-backed one at `mode=ai`, the second gated on auth +
 * `ai.use` + a dark feature flag — and two spec files to match. There is one engine now: the ranked
 * one, public, on the `All` scope, with every narrower tab serving that entity's keyword list.
 *
 * **Almost nothing here holds the AI feature-flag lock any more, and that absence is the claim.**
 * The old file's every test queued on it, because `writing-tools.spec.ts` asserted the same global rows
 * DOWN while it raised them — contention no `describe.serial` can order across files. Search reaches
 * no flag now, so the tests below are ordinary parallel tests, and any future need for that lock
 * here would mean the merge had regressed.
 *
 * Nothing is mocked at the app boundary ([README §invariants]): the search is the real
 * `POST /ai/search` through the real Retrieval Platform (planner → retrievers → ranker), which since
 * B1 reaches no model at all.
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

  test('the default scope returns ranked, grounded results', async ({ page, api, data }) => {
    // Two pieces sharing a distinctive token, so the query matches more than one: it gives the
    // ranker something to order, and the suggestions endpoint a title to offer that is not the query
    // itself (it drops the query from its own results).
    const token = data.username();
    const query = `Lantern ${token}`;
    const first = `Lantern ${token} at the harbour`;
    const second = `Lantern ${token} in the orchard`;
    await api.createPublishedPiece({ title: first, body: 'The lantern swung over black water.' });
    await api.createPublishedPiece({ title: second, body: 'A lantern hung between the trees.' });

    const search = new SearchPage(page);
    await search.gotoQuery(query);

    // Ranked + grounded: the card carries the ranker's reason and its relevance, and the panel
    // reports what the server actually considered. No flag was raised to get here.
    await search.expectGroundedResult(first);
    await search.expectCandidateMeta();

    // The filters the engine accepts are reachable, and the pieces-only ones are not (48 §3.9
    // W5-11 — this bar used to render nothing at all on a ranked search, because it was gated on a
    // scope tab that mode did not have).
    await search.expectRankedFiltersOffered();

    // "Try instead" is a row beside the results, not a dropdown while typing (mobile's search runs
    // on submit; this page debounces straight into the URL). Picking one commits a new query.
    const picked = await search.pickFirstSuggestion();
    expect(picked, 'a suggestion chip must carry the query it would run').not.toBe('');
  });

  /**
   * The scope tabs, which survived the merge the engine switch did not.
   *
   * They are different kinds of choice: a switch asked the reader to pick an implementation, which
   * is a question they have no way to answer; a scope refines their own intent. Both engines are
   * still reachable — just not as a thing to choose between — and this is what proves it.
   */
  test('a narrower scope switches to that entity’s keyword list', async ({ page, api, data }) => {
    const title = data.pieceTitle();
    await api.createPublishedPiece({ title });

    const search = new SearchPage(page);
    await search.gotoQuery(title);
    await search.expectScopesOffered('All');

    await search.selectScope('Pieces');
    await search.expectKeywordResult(title);
  });

  /**
   * Old links must not break. `mode=ai` is in readers' bookmarks and in their saved searches, and it
   * has to land on the results it used to select — which it does by being ignored, since those are
   * the default now.
   */
  test('a legacy mode=ai link lands on the ranked results', async ({ page, api, data }) => {
    const title = data.pieceTitle();
    await api.createPublishedPiece({ title, body: 'A lantern over black water.' });

    const search = new SearchPage(page);
    await search.gotoLegacyAiLink(title);

    await search.expectGroundedResult(title);
    await search.expectScopesOffered('All');
  });

  test('a search can be saved, re-run from the landing page, and removed', async ({
    page,
    api,
    data,
  }) => {
    /**
     * A THROWAWAY user, not the shared writer, for the reason the visual blocks baseline uses one:
     * saved searches are server-side, per-user, cumulative, and capped at 50. Run as the writer,
     * every failed run would leave a row behind until the cap started refusing saves — a spec that
     * poisons its own account over time.
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
    await search.gotoQuery(query);
    await search.saveSearch(name);

    // It is on the account, not in this tab: a cold load of the landing page reads it back.
    await search.goto();
    await search.expectSaved(name);

    // Re-running restores the query. It used to have to restore the ENGINE too — answering a saved
    // question with the other engine quietly called a different answer the same search (W5-7) — and
    // with one engine there is nothing left to restore.
    await search.runSaved(name);
    await expect(page).toHaveURL(new RegExp(`q=Lantern\\+${token}`));

    await search.goto();
    await search.removeSaved(name);
    // Removed on the server, not just from the list: a cold load agrees.
    await search.goto();
    await expect(search.savedEntry(name)).toHaveCount(0);
  });
});

/**
 * The signed-out reader on the same public page.
 *
 * **This block inverted at D5, and the inversion is the feature.** It used to assert that an
 * anonymous visitor was invited to sign in — the honest answer when every retrieval route needed a
 * session. The route is public now, so the honest answer is results.
 *
 * The hazard the old tests guarded has not gone away and is asserted more strictly here: an
 * authenticated read fired on a public page 401s, and a 401 outside `/auth/*` is terminal to the api
 * client — it ends the session and clears the query cache, which is how the search page lost its
 * results and the reading page lost the piece it had already fetched (48 §3.9 W5-6, §3.25). So this
 * asserts not only that the reader sees results, but that the surfaces needing a session are ABSENT
 * rather than merely quiet.
 */
test.describe('@phase3 frontend search (signed out)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('an anonymous reader gets ranked results, with no sign-in wall', async ({
    page,
    api,
    data,
  }) => {
    const title = data.pieceTitle();
    await api.createPublishedPiece({ title, body: 'The lantern swung over black water.' });

    const search = new SearchPage(page);
    await search.gotoQuery(title);

    await search.expectPublicResults();
    await search.expectGroundedResult(title);
  });

  test('the scope tabs work for an anonymous reader too', async ({ page, api, data }) => {
    const title = data.pieceTitle();
    await api.createPublishedPiece({ title });

    const search = new SearchPage(page);
    await search.gotoQuery(title);
    await search.selectScope('Pieces');
    await search.expectKeywordResult(title);
  });

  test('nothing that needs a session is offered, or requested', async ({ page, api, data }) => {
    const title = data.pieceTitle();
    await api.createPublishedPiece({ title });

    /**
     * The REQUEST assertion, which is the one that matters. Rendering nothing is not enough: the
     * saved-search read still needing a session, fired anyway, would 401 and drop the reader's
     * session on a page they were browsing anonymously. Watching the network is the only way to see
     * that from outside, and a render-only check is exactly what missed it the first time.
     */
    const authenticatedReads: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/ai/search/saved') || url.includes('/ai/recommendations')) {
        authenticatedReads.push(url);
      }
    });

    const search = new SearchPage(page);
    await search.gotoQuery(title);
    await search.expectPublicResults();

    // The landing page is where the saved section would render, so check both surfaces.
    await search.goto();
    await search.expectNoSavedSection();
    await expect(page.getByRole('button', { name: 'Save search' })).toHaveCount(0);

    expect(
      authenticatedReads,
      'an authenticated read on a public page 401s, and a 401 outside /auth ends the session',
    ).toEqual([]);
  });
});
