import { freshLogin } from '../../fixtures/auth';
import { expect, test } from '../../fixtures/test';
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
 * 3. **Accepting says the prose is unchanged.** The server records the decision and leaves the piece
 *    alone; a card that implied otherwise would be silently wrong.
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

    await comments.resolveFirst();
  });

  test('a suggestion is proposed with its anchor, then accepted', async ({ page, api, data }) => {
    await freshLogin(page, 'writer');
    // A known body, so the anchor offset and the replaced text are real rather than plausible —
    // the server checks the original text still exists before it will accept.
    const original = 'lantern';
    const story = await api.createPiece({
      title: data.pieceTitle(),
      body: `The ${original} burned low over the water.`,
    });

    const suggestions = new StorySuggestionsPage(page);
    await suggestions.goto(story.id);
    await suggestions.expectResolved();
    await suggestions.expectEmpty();

    await suggestions.propose({ original, suggested: 'oil lamp', from: 4 });
    await suggestions.acceptFirst();
    // Accepting records the decision; the prose is still the writer's to change.
    await suggestions.expectApplyReminder();
  });

  test('accepting a suggestion whose text has since changed reports the conflict', async ({
    page,
    api,
    data,
  }) => {
    await freshLogin(page, 'writer');
    const story = await api.createPiece({
      title: data.pieceTitle(),
      body: 'The harbour was quiet that evening.',
    });

    const suggestions = new StorySuggestionsPage(page);
    await suggestions.goto(story.id);
    // Anchored to text that is NOT in the piece — the same state as prose edited after the
    // suggestion was written, which is what SUGGESTION_CONFLICT exists for.
    await suggestions.propose({ original: 'a lighthouse', suggested: 'a beacon', from: 4 });

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
