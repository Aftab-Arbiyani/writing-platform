import { freshLogin } from '../../fixtures/auth';
import { expect, test } from '../../fixtures/test';
import { ReaderPage } from '../../pages/frontend/reader-page';
import { StoryCommentsPage } from '../../pages/frontend/story-comments-page';
import { StorySuggestionsPage } from '../../pages/frontend/story-suggestions-page';

/**
 * Frontend inline review — comments + suggestions (AF6 / **W3b**, design docs/49 §5).
 *
 * Built from the DTOs rather than ported: the pre-W3b audit found mobile's suggestion create could
 * only ever 400 and its comment entities never loaded a single reply (M-2 / M-3, docs/48 §3.2). So
 * these tests are the first proof that either surface works at all, on any client.
 *
 * The three assertions that carry the most weight:
 *
 * 1. **A reply round-trips.** `CommentDto` has no `replies` array — a thread is a separate fetch —
 *    so a rendered reply proves the thread endpoint is wired.
 * 2. **A suggestion is created with its anchor** and can then be accepted, which is exactly the
 *    path mobile could not execute.
 * 3. **Accepting says the prose CHANGED.** The server rewrites the anchored range and snapshots the
 *    pre-edit version (`f6827e0`), so a card claiming the piece was left alone would be silently
 *    wrong — which it did claim, and this suite asserted, until **W3c-4** (docs/48 §3.4).
 */
test.describe('@phase4 frontend inline review — comments & suggestions', () => {
  test('a writer comments on their story, replies, and resolves the thread', async ({
    page,
    api,
    data,
  }) => {
    await freshLogin(page, 'writer');
    const story = await api.createPiece({ title: data.pieceTitle() });

    const comments = new StoryCommentsPage(page);
    await comments.goto(story.id);
    await comments.expectResolved();
    await comments.expectEmpty();

    const body = `E2E comment ${data.username()}`;
    await comments.addComment(body);

    // A reply lands through POST /comments/:id/replies and is read back from the thread endpoint.
    await comments.replyToFirst(`E2E reply ${data.username()}`);

    await comments.resolveFirst(body);

    // The third verb, proven at the server rather than at a tag. T-6's register entry recorded that
    // resolving and then filtering to Resolved showed "No comments yet", and left it undiagnosed
    // between "the write never lands" and "the query never returns it". It was neither — the click
    // never reached the Resolve button (docs/48 §3.5). With that fixed, the resolved comment comes
    // back from `status=resolved`, which is the only assertion that rules out both hypotheses.
    await comments.filterResolved();
    await expect(page.getByRole('listitem').filter({ hasText: body })).toBeVisible();
  });

  test('a suggestion is proposed FROM THE READER, then accepted', async ({ page, api, data }) => {
    await freshLogin(page, 'writer');
    // Published, because proposing now happens on the reader (C-15) and that route loads by slug.
    const body = 'The lantern burned low over the water.';
    const story = await api.createPublishedPiece({ title: data.pieceTitle(), body });
    expect(story.slug, 'publishing must mint a slug').toBeTruthy();

    // The whole point of C-15: no offset is passed here, because none is typed. The reader walks
    // the document into per-block anchors and the picked paragraph carries its own.
    const reader = new ReaderPage(page);
    await reader.gotoSlug(story.slug as string);
    await reader.proposeEdit({ passage: 'lantern', suggested: 'The oil lamp burned low.' });

    const suggestions = new StorySuggestionsPage(page);
    await suggestions.goto(story.id);
    await suggestions.expectResolved();
    await suggestions.acceptFirst();
    // Accepting APPLIES the edit server-side, and the card now says so (W3c-4). This asserts the
    // copy only; that the piece body really changed is covered by the backend's own accept tests.
    await suggestions.expectAppliedNote();
  });

  test('accepting a suggestion whose text has since changed reports the conflict', async ({
    page,
    api,
    data,
  }) => {
    await freshLogin(page, 'writer');
    const story = await api.createPublishedPiece({
      title: data.pieceTitle(),
      body: 'The harbour was quiet that evening.',
    });

    // ARRANGED DIFFERENTLY SINCE C-15, and the reason is the fix itself: this test used to type an
    // anchor for text that was not in the piece. That is no longer expressible through the UI — the
    // reader derives every anchor from the real document — so the conflict is now reached the way a
    // real writer reaches it: propose against the real prose, then MOVE the prose.
    const reader = new ReaderPage(page);
    await reader.gotoSlug(story.slug as string);
    await reader.proposeEdit({
      passage: 'harbour',
      suggested: 'The harbour was loud that evening.',
    });

    await api.updatePieceBody(story.id, 'Nothing of the original wording survives this rewrite.');

    const suggestions = new StorySuggestionsPage(page);
    await suggestions.goto(story.id);
    await suggestions.acceptFirstExpectingFailure();
    await suggestions.expectConflict();
  });

  test('the comment status filter reaches the server', async ({ page, api, data }) => {
    await freshLogin(page, 'writer');
    const story = await api.createPiece({ title: data.pieceTitle() });

    const comments = new StoryCommentsPage(page);
    await comments.goto(story.id);
    const body = `E2E filter ${data.username()}`;
    await comments.addComment(body);

    // Resolved-only must exclude an open comment — proof the `status` query param is applied
    // server-side rather than the list being filtered in the client.
    await comments.filterResolved();
    await expect(page.getByText(body, { exact: true })).toHaveCount(0);
  });
});
