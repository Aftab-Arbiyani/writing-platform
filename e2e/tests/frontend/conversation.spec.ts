import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { PieceConversation } from '../../pages/frontend/conversation';
import { ReaderPage } from '../../pages/frontend/reader-page';

/**
 * The conversation layer on a piece (W7a, docs/45 §4.4) — comments, replies and responses, inline
 * on the reading view.
 *
 * **These are `modules/engagement` PIECE comments** — public conversation on a published piece —
 * not AF6's collaboration comments, which are a story's private review and are covered by
 * `inline-review.spec.ts`. Different module, different DTO, different privacy model.
 *
 * Every test here asserts **reachability**, not wire shape: the repeated defect class in this
 * codebase is code that looked wired and was not (R-1, M5-1, W5-3, W8-1). So each one arranges
 * state over REST, loads the real page, and reads the result off the screen.
 */
test.describe('@phase2 frontend piece conversation', () => {
  /**
   * The whole gating story in one test. `GET /pieces/:id/comments` and
   * `GET /pieces/:id/responses` are `@Public()` + `OptionalAuthGuard`, so a signed-out reader must
   * SEE both — and must not be offered a composer. Gating a public page's read on auth is the W5-6
   * defect (docs/48 §3.9): the 401 cleared the query cache and broke the page for every visitor.
   */
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('a signed-out reader sees comments and responses, and is offered no composer', async ({
      page,
      api,
      data,
    }) => {
      const title = data.pieceTitle();
      const piece = await api.createPublishedPiece({ title });
      const body = `A signed-out reader can read this. ${data.username()}`;
      await api.commentOnPiece(piece.id, body);
      const responseTitle = data.pieceTitle();
      await api.createPublishedResponse(piece.id, responseTitle);

      const reader = new ReaderPage(page);
      await reader.gotoSlug(piece.slug as string);
      await reader.expectRendered(title);

      const conversation = new PieceConversation(page);
      await conversation.expectLoaded();

      // Read: yes, both surfaces.
      await expect(conversation.comment(body)).toBeVisible();
      await expect(conversation.response(responseTitle)).toBeVisible();

      // Compose: no — and an honest sign-in affordance on each surface instead.
      await expect(conversation.composer).toHaveCount(0);
      await expect(conversation.writeResponse).toHaveCount(0);
      await expect(conversation.signInPrompts).toHaveCount(2);
    });

    /**
     * The W5-6 regression itself, stated as the thing that must not happen: the PAGE still works.
     * A read that needed a session would 401, clear the cache, and take the article with it.
     */
    test('the piece page itself still renders for a signed-out reader', async ({
      page,
      api,
      data,
    }) => {
      const title = data.pieceTitle();
      const piece = await api.createPublishedPiece({ title });

      const reader = new ReaderPage(page);
      await reader.gotoSlug(piece.slug as string);

      await reader.expectRendered(title);
      await expect(reader.body).toBeVisible();
      await new PieceConversation(page).expectLoaded();
      // No redirect to sign-in, and no error state where the prose should be.
      await expect(page).toHaveURL(new RegExp(`/p/${piece.slug as string}$`));
    });

    test('a reply loads from the replies endpoint and nests under its parent', async ({
      page,
      api,
      data,
    }) => {
      // Arranged over REST, then read back as an anonymous visitor: the replies route is public
      // too, so expanding a thread must work with no session at all.
      const title = data.pieceTitle();
      const piece = await api.createPublishedPiece({ title });
      const parentBody = `Parent comment ${data.username()}`;
      const replyBody = `Nested reply ${data.username()}`;
      const parent = await api.commentOnPiece(piece.id, parentBody);
      await api.replyToComment(parent.id, replyBody);

      const reader = new ReaderPage(page);
      await reader.gotoSlug(piece.slug as string);
      await reader.expectRendered(title);

      const conversation = new PieceConversation(page);
      await conversation.expectLoaded();

      // The reply is NOT in the list payload — `CommentResponseDto` has no `replies` array, only a
      // count. It is absent until the thread is expanded, which is what issues the second request.
      await expect(conversation.comments.getByText(replyBody)).toHaveCount(0);
      await expect(
        conversation.comment(parentBody).getByRole('button', { name: '1 reply' }),
      ).toBeVisible();

      await conversation.expandReplies(parentBody);
      // Nested INSIDE its parent, not merely present somewhere on the page.
      await expect(
        conversation.comment(parentBody).getByRole('article').filter({ hasText: replyBody }),
      ).toBeVisible({ timeout: 30_000 });
    });

    /**
     * The tombstone, and why it must render: replies hang off a deleted parent and vanish with it if
     * a client filters the node out. So the deleted row stays AND its reply is still reachable.
     */
    test('a deleted comment renders its tombstone and keeps its replies visible', async ({
      page,
      api,
      data,
    }) => {
      const title = data.pieceTitle();
      const piece = await api.createPublishedPiece({ title });
      const replyBody = `This reply outlived its parent ${data.username()}`;
      const parent = await api.commentOnPiece(piece.id, `Doomed parent ${data.username()}`);
      await api.replyToComment(parent.id, replyBody);
      await api.deleteComment(parent.id);

      const reader = new ReaderPage(page);
      await reader.gotoSlug(piece.slug as string);
      await reader.expectRendered(title);

      const conversation = new PieceConversation(page);
      await conversation.expectLoaded();

      // The node survived its own deletion, carrying the server's tombstone text.
      await expect(conversation.tombstone).toBeVisible({ timeout: 30_000 });
      await expect(conversation.tombstone).toContainText(/deleted/i);

      await conversation.expandTombstoneReplies();
      await expect(conversation.comments.getByText(replyBody)).toBeVisible({ timeout: 30_000 });
    });

    /**
     * `author: null` — a real state of the DTO. The tombstone is how the E2E stack can produce one
     * (the server nulls the author on soft delete), and what matters is that the byline says
     * something true rather than going blank or inventing a name.
     */
    test('a comment with no author renders honestly rather than blank', async ({
      page,
      api,
      data,
    }) => {
      const title = data.pieceTitle();
      const piece = await api.createPublishedPiece({ title });
      const comment = await api.commentOnPiece(piece.id, `Authorless soon ${data.username()}`);
      await api.deleteComment(comment.id);

      const reader = new ReaderPage(page);
      await reader.gotoSlug(piece.slug as string);
      await reader.expectRendered(title);
      await new PieceConversation(page).expectLoaded();

      const tombstone = new PieceConversation(page).tombstone;
      await expect(tombstone).toBeVisible({ timeout: 30_000 });
      // Named, and not a link — there is no profile to open.
      await expect(tombstone.getByText('Someone')).toBeVisible();
      await expect(tombstone.getByRole('link')).toHaveCount(0);
    });
  });

  test.describe('signed in', () => {
    /**
     * **Explicitly over-budgeted, and not as a flake workaround.** This test reloads the page TWICE
     * (once to prove the comment was written, once to prove `editedAt` was), and the config's
     * `navigationTimeout` is 30 s — the same as the default per-test timeout. So a single slow
     * reload can consume the entire budget before the second one starts, which is a structural
     * under-budget rather than bad luck: it failed on `frontend-firefox` under four-worker parallel
     * load against a dev-mode Vite server, and passed alone. The reloads are the whole point of the
     * test (optimistic paint proves nothing), so the budget is what moves.
     */
    test('a reader posts a comment, edits it, and the edit is marked', async ({
      page,
      api,
      data,
    }) => {
      test.setTimeout(90_000);
      await freshLogin(page, 'writer');
      const title = data.pieceTitle();
      const piece = await api.createPublishedPiece({ title });

      const reader = new ReaderPage(page);
      await reader.gotoSlug(piece.slug as string);
      await reader.expectRendered(title);

      const conversation = new PieceConversation(page);
      await conversation.expectLoaded();

      const body = `Posted from the browser ${data.username()}`;
      await conversation.addComment(body);

      // It was really written, not optimistically painted — a reload re-reads the server.
      await page.reload();
      await reader.expectRendered(title);
      await expect(conversation.comment(body)).toBeVisible({ timeout: 30_000 });

      const edited = `${body} — reworded`;
      await conversation.editComment(body, edited);
      // `editedAt` arrives from the server and the row says so; the flag survives a reload.
      await expect(conversation.comment(edited)).toContainText(/edited/i);
      await page.reload();
      await reader.expectRendered(title);
      await expect(conversation.comment(edited)).toContainText(/edited/i, { timeout: 30_000 });
    });

    /** One reload, for the same reason as above — a reply that only ever existed in the DOM is not
     *  a reply. Budgeted so the reload cannot eat the assertions after it. */
    test('a reader replies to their own comment through the reply endpoint', async ({
      page,
      api,
      data,
    }) => {
      test.setTimeout(60_000);
      await freshLogin(page, 'writer');
      const title = data.pieceTitle();
      const piece = await api.createPublishedPiece({ title });
      const parentBody = `Parent from REST ${data.username()}`;
      await api.commentOnPiece(piece.id, parentBody);

      const reader = new ReaderPage(page);
      await reader.gotoSlug(piece.slug as string);
      await reader.expectRendered(title);
      const conversation = new PieceConversation(page);
      await conversation.expectLoaded();

      const replyBody = `Reply from the browser ${data.username()}`;
      await conversation.replyTo(parentBody, replyBody);

      // Survives a reload, so it reached `POST /comments/:id/replies` and not just the DOM.
      await page.reload();
      await reader.expectRendered(title);
      await conversation.expandReplies(parentBody);
      await expect(conversation.comments.getByText(replyBody)).toBeVisible({ timeout: 30_000 });
    });

    test('deleting your own comment leaves a tombstone, not a hole', async ({
      page,
      api,
      data,
    }) => {
      await freshLogin(page, 'writer');
      const title = data.pieceTitle();
      const piece = await api.createPublishedPiece({ title });
      const body = `Delete me ${data.username()}`;
      await api.commentOnPiece(piece.id, body);

      const reader = new ReaderPage(page);
      await reader.gotoSlug(piece.slug as string);
      await reader.expectRendered(title);
      const conversation = new PieceConversation(page);
      await conversation.expectLoaded();

      await conversation.deleteComment(body);
      await expect(conversation.comments.getByText(body)).toHaveCount(0);
      await expect(conversation.tombstone).toBeVisible();
    });

    /**
     * Ownership. Edit and delete are the owner's alone — asserted from the OTHER side, as the person
     * who did not write the comment, because "the buttons are there for me" proves nothing about
     * whether they are there for everyone.
     */
    test('a reader cannot edit or delete someone else’s comment', async ({ page, api, data }) => {
      // A throwaway account writes the comment; the seeded writer reads the page.
      const stranger = await api.createVerifiedUser({
        email: data.email(),
        username: data.username(),
        password: data.password(),
      });
      const strangerToken = await api.loginToken(stranger.email, stranger.password);

      const title = data.pieceTitle();
      const piece = await api.createPublishedPiece({ title });
      const body = `Written by someone else ${data.username()}`;
      await api.commentOnPieceAs(strangerToken, piece.id, body);

      await freshLogin(page, 'writer');
      const reader = new ReaderPage(page);
      await reader.gotoSlug(piece.slug as string);
      await reader.expectRendered(title);
      const conversation = new PieceConversation(page);
      await conversation.expectLoaded();

      const theirs = conversation.comment(body);
      await expect(theirs).toBeVisible({ timeout: 30_000 });
      await expect(theirs.getByRole('button', { name: 'Edit' })).toHaveCount(0);
      await expect(theirs.getByRole('button', { name: 'Delete' })).toHaveCount(0);
      // …but replying to a stranger is exactly what the surface is for.
      await expect(theirs.getByRole('button', { name: 'Reply', exact: true })).toBeVisible();
    });

    /**
     * The response write flow, end to end. A response IS a piece, so `POST` mints a linked DRAFT and
     * the writer lands in the EDITOR for it — there is no inline response composer, on either
     * client. This is the assertion that the navigation actually happens.
     */
    test('writing a response lands the writer in the editor for the new draft', async ({
      page,
      api,
      data,
    }) => {
      await freshLogin(page, 'writer');
      const title = data.pieceTitle();
      const piece = await api.createPublishedPiece({ title });

      const reader = new ReaderPage(page);
      await reader.gotoSlug(piece.slug as string);
      await reader.expectRendered(title);
      const conversation = new PieceConversation(page);
      await conversation.expectLoaded();

      await expect(conversation.writeResponse).toBeVisible();
      await conversation.writeResponse.click();

      // `/write/:draftId` — a real draft id, not the bare `/write` a client-side new-draft would give.
      await expect(page).toHaveURL(/\/write\/[0-9a-f-]{36}$/, { timeout: 30_000 });
      // The draft opened already titled after its parent, so the writer knows what they are answering.
      await expect(page.getByLabel('Title')).toHaveValue(new RegExp(escapeRegExp(title)), {
        timeout: 30_000,
      });
    });

    test('a published response appears in the parent’s response list and opens in the reader', async ({
      page,
      api,
      data,
    }) => {
      await freshLogin(page, 'writer');
      const title = data.pieceTitle();
      const piece = await api.createPublishedPiece({ title });
      const responseTitle = data.pieceTitle();
      const response = await api.createPublishedResponse(piece.id, responseTitle);

      const reader = new ReaderPage(page);
      await reader.gotoSlug(piece.slug as string);
      await reader.expectRendered(title);
      const conversation = new PieceConversation(page);
      await conversation.expectLoaded();

      await expect(conversation.response(responseTitle)).toBeVisible({ timeout: 30_000 });
      await conversation.response(responseTitle).click();

      // A response is a piece: the link opens the reader for it, by its own slug.
      await expect(page).toHaveURL(new RegExp(`/p/${response.slug as string}$`));
      await reader.expectRendered(responseTitle);
    });
  });
});

/** Titles carry a run seed with no regex metacharacters, but escaping keeps that an assumption. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
