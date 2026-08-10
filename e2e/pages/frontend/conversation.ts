import { type Page, type Locator, expect } from '@playwright/test';

/**
 * The conversation on a piece (W7a, docs/45 §4.4) — comments and responses, INLINE at the end of
 * the reading view `/p/:slug`.
 *
 * There is no separate route to navigate to, which is the recorded layout difference from mobile
 * (docs/48 §4.1): mobile pushes `comments_screen` / `responses_screen`, web keeps both on the
 * piece's own canonical URL. So this object takes a page already on the reader — pair it with
 * `ReaderPage`.
 *
 * Selectors are role/text-based per [05 §3]: each surface is a `section` labelled by its own `h2`,
 * so both are `region` landmarks; each comment is an `article` with an accessible name naming its
 * author (or saying it is deleted); every action is a real button. No test-ids were needed.
 */
export class PieceConversation {
  constructor(private readonly page: Page) {}

  // ── Comments ─────────────────────────────────────────────────────────────────

  get comments(): Locator {
    return this.page.getByRole('region', { name: 'Comments' });
  }

  /** The top-level composer. Present only for a signed-in reader. */
  get composer(): Locator {
    return this.comments.getByLabel('Add a comment');
  }

  get submit(): Locator {
    return this.comments.getByRole('button', { name: 'Comment', exact: true });
  }

  /** One comment node, found by its body text. */
  comment(body: string): Locator {
    return this.comments.getByRole('article').filter({ hasText: body });
  }

  /** The tombstone left by a soft delete — the server's own text, not a client string. */
  get tombstone(): Locator {
    return this.comments.getByRole('article', { name: 'Deleted comment' });
  }

  /** Post a top-level comment and wait until it is on screen (server-confirmed, not optimistic). */
  async addComment(body: string): Promise<void> {
    await this.composer.fill(body);
    await this.submit.click();
    await expect(this.comment(body)).toBeVisible({ timeout: 30_000 });
  }

  /** Open a comment's reply box, post, and wait for the reply to appear nested under it. */
  async replyTo(parentBody: string, replyBody: string): Promise<void> {
    const parent = this.comment(parentBody);
    await parent.getByRole('button', { name: 'Reply', exact: true }).click();
    await parent.getByLabel(/^Reply to /).fill(replyBody);
    await parent.getByRole('button', { name: 'Post reply' }).click();
    await expect(parent.getByRole('article').filter({ hasText: replyBody })).toBeVisible({
      timeout: 30_000,
    });
  }

  /**
   * Expand a comment's replies. The count is in the button's own label because that is all the
   * payload says about replies — `CommentResponseDto` has `replyCount` and no `replies` array, so
   * expanding is what issues `GET /comments/:id/replies`.
   */
  async expandReplies(parentBody: string): Promise<void> {
    const parent = this.comment(parentBody);
    await parent
      .getByRole('button', { name: /repl(y|ies)$/ })
      .first()
      .click();
  }

  /** Expand a tombstone's replies — the case that proves the node survived its own deletion. */
  async expandTombstoneReplies(): Promise<void> {
    await this.tombstone
      .getByRole('button', { name: /repl(y|ies)$/ })
      .first()
      .click();
  }

  async editComment(body: string, newBody: string): Promise<void> {
    const target = this.comment(body);
    await target.getByRole('button', { name: 'Edit' }).click();
    await target.getByLabel('Edit your comment').fill(newBody);
    await target.getByRole('button', { name: 'Save' }).click();
    await expect(this.comment(newBody)).toBeVisible({ timeout: 30_000 });
  }

  /** Delete a comment, confirming the dialog. The row does not disappear — it becomes a tombstone. */
  async deleteComment(body: string): Promise<void> {
    await this.comment(body).getByRole('button', { name: 'Delete' }).click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toContainText(/replies to it stay visible/i);
    await dialog.getByRole('button', { name: /^Delete$/ }).click();
    await expect(this.tombstone).toBeVisible({ timeout: 30_000 });
  }

  // ── Responses ────────────────────────────────────────────────────────────────

  get responses(): Locator {
    return this.page.getByRole('region', { name: 'Responses' });
  }

  get writeResponse(): Locator {
    return this.responses.getByRole('button', { name: 'Write a response' });
  }

  response(title: string): Locator {
    return this.responses.getByRole('link', { name: title });
  }

  // ── Shared ───────────────────────────────────────────────────────────────────

  /** Both sign-in prompts — one per surface. A signed-out reader gets these instead of composers. */
  get signInPrompts(): Locator {
    return this.page
      .getByRole('region', { name: /^(Comments|Responses)$/ })
      .getByRole('link', { name: 'Sign in' });
  }

  /**
   * Both surfaces have finished their first read.
   *
   * Waiting on the loading skeleton to go rather than on content: an empty conversation is a
   * perfectly good settled state, and a spec that waited for a row would hang on the empty case.
   */
  async expectLoaded(): Promise<void> {
    await expect(this.comments).toBeVisible({ timeout: 30_000 });
    await expect(this.responses).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByLabel('Loading comments')).toHaveCount(0, { timeout: 30_000 });
    await expect(this.page.getByLabel('Loading responses')).toHaveCount(0, { timeout: 30_000 });
  }
}
