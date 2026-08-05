import { type Locator, type Page, expect } from '@playwright/test';

/**
 * A story's comments (AF6 W3b, `features/collaboration` — `/write/:storyId/comments`).
 *
 * Threads load their replies on demand (`GET /comments/:id/thread`), so "Replies" is an
 * expand/collapse control, not decoration — asserting a reply means expanding first.
 */
export class StoryCommentsPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Comments' });
  }
  private get composer(): Locator {
    return this.page.getByLabel('Comment', { exact: true });
  }
  private get submit(): Locator {
    return this.page.getByRole('button', { name: 'Comment', exact: true });
  }
  private get loadError(): Locator {
    return this.page.getByText('Couldn’t load the comments.', { exact: true });
  }

  async goto(storyId: string): Promise<void> {
    await this.page.goto(`/write/${storyId}/comments`);
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  async expectResolved(): Promise<void> {
    await expect(this.loadError).toHaveCount(0);
    await expect(this.page.getByText('Collaboration is off')).toHaveCount(0);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.page.getByText('No comments yet', { exact: true })).toBeVisible();
  }

  /**
   * Post a root comment and wait for it to actually land in the list.
   *
   * The settle is scoped to the LIST and to the composer clearing, not to page-wide text. It used to
   * be `expect(page.getByText(body)).toBeVisible()`, which can resolve against the composer's own
   * subtree — the text the caller just typed is on the page either way, so the assertion could pass
   * before the post completed. That is not theoretical: a minted visual baseline caught the page
   * mid-submit, with the typed text still in the composer, a spinner on the submit button, and "No
   * comments yet" still rendered underneath — on a spec whose whole point is that the thread card
   * renders INSTEAD of the empty state. It would have been committed as the reference.
   *
   * `setBody('')` runs only after `onSubmit` resolves (comment-composer.tsx), so an empty composer
   * is a definitive success signal; the empty state clearing is what settles the layout.
   */
  async addComment(body: string): Promise<void> {
    await this.composer.fill(body);
    await this.submit.click();
    await expect(this.page.getByRole('listitem').filter({ hasText: body })).toBeVisible();
    await expect(this.page.getByText('No comments yet', { exact: true })).toHaveCount(0);
    await expect(this.composer).toHaveValue('');
  }

  /** Reply to the first thread, expanding it so the reply is actually rendered. */
  async replyToFirst(body: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Reply' }).first().click();
    await this.page.getByLabel('Reply', { exact: true }).fill(body);
    await this.page.getByRole('button', { name: 'Reply', exact: true }).last().click();
    await expect(this.page.getByText(body, { exact: true })).toBeVisible();
  }

  /**
   * Resolve the thread carrying [body], and prove that THAT comment is the thing that resolved.
   *
   * The old assertion was `getByText('Resolved', { exact: true }).first()`, page-wide. The status
   * filter's chip is labelled exactly "Resolved" and is always visible, so it passed whether or not
   * anything resolved — defect **T-6** (docs/48 §3.5), the same class as W3c-4.
   *
   * Scoped to the comment's own `<li>`, so only the `QTag color="success"` inside the thread can
   * satisfy it. The filter chip is a `<button>` outside every list item and can no longer be
   * mistaken for the outcome. The Resolve button disappearing is asserted too — `comment-thread.tsx`
   * drops Reply and Resolve once `status === Resolved`, so it is independent evidence that the
   * component re-rendered off a genuinely resolved DTO rather than painting a tag optimistically.
   */
  async resolveFirst(body: string): Promise<void> {
    const item = this.page.getByRole('listitem').filter({ hasText: body });
    await item.getByRole('button', { name: 'Resolve' }).click();
    await expect(item.getByText('Resolved', { exact: true })).toBeVisible();
    await expect(item.getByRole('button', { name: 'Resolve' })).toHaveCount(0);
  }

  /** Filter to resolved only — proves the status query param reaches the server. */
  async filterResolved(): Promise<void> {
    await this.page.getByRole('button', { name: 'Resolved', exact: true }).click();
  }
}
