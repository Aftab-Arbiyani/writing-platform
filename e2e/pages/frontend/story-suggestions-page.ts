import { type Locator, type Page, expect } from '@playwright/test';

/**
 * A story's suggested edits (AF6 W3b — `/write/:storyId/suggestions`).
 *
 * The composer asks for an anchor offset because the contract requires `{from, to}` and this route
 * has no live editor selection to read it from (docs/49 §5). Mobile omitted the anchor entirely,
 * which is why its create could only ever 400 (M-2).
 */
export class StorySuggestionsPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Suggestions' });
  }
  private get loadError(): Locator {
    return this.page.getByText('Couldn’t load the suggestions.', { exact: true });
  }

  /**
   * The suggestion list, used to scope every row assertion.
   *
   * Necessary because the page's status FILTERS are buttons named "Pending" / "Accepted", and
   * `getByRole('button', {name: 'Accept'})` matches an accessible name by SUBSTRING — so an
   * unscoped, inexact lookup finds the filter instead of the row action. Scope plus `exact`
   * ([05 §2](../../../docs/e2e/05_Selectors.md)) is what makes each of these resolve to one element.
   */
  private get list(): Locator {
    return this.page.getByRole('list').last();
  }

  async goto(storyId: string): Promise<void> {
    await this.page.goto(`/write/${storyId}/suggestions`);
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  async expectResolved(): Promise<void> {
    await expect(this.loadError).toHaveCount(0);
    await expect(this.page.getByText('Collaboration is off')).toHaveCount(0);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.page.getByText('No suggestions yet', { exact: true })).toBeVisible();
  }

  /**
   * Propose an edit through the UI. `from` must be a real offset into the piece's text for a later
   * accept to pass the server's conflict check.
   */
  async propose(input: { original: string; suggested: string; from: number }): Promise<void> {
    await this.page.getByRole('button', { name: 'Suggest an edit' }).click();
    await this.page.getByLabel('Text to replace').fill(input.original);
    await this.page.getByLabel('Proposed wording').fill(input.suggested);
    await this.page.getByLabel('Starts at character').fill(String(input.from));
    await this.page.getByRole('button', { name: 'Propose edit' }).click();
    await expect(this.page.getByText(input.suggested, { exact: true })).toBeVisible();
  }

  async acceptFirst(): Promise<void> {
    await this.list.getByRole('button', { name: 'Accept', exact: true }).first().click();
    // The row leaves the pending state — asserted by the action disappearing, not by the word
    // "Accepted", which the filter bar also shows.
    await expect(this.list.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
  }

  /** Click Accept expecting it to FAIL — the row keeps its action, so scope + exact still apply. */
  async acceptFirstExpectingFailure(): Promise<void> {
    await this.list.getByRole('button', { name: 'Accept', exact: true }).first().click();
  }

  /**
   * The accepted card must say the prose CHANGED (W3c-4).
   *
   * This asserted the opposite until the copy was fixed — "apply the replacement in the editor",
   * true only until `f6827e0` made accept rewrite the body server-side. A stale assertion kept the
   * suite green while the UI misled the writer, which is why the wording is pinned here explicitly
   * rather than by a looser match that both copies would satisfy.
   */
  async expectAppliedNote(): Promise<void> {
    await expect(this.page.getByText(/the replacement was applied to the piece/i)).toBeVisible();
    await expect(this.page.getByText(/apply the replacement in the editor/i)).toHaveCount(0);
  }

  async expectConflict(): Promise<void> {
    await expect(this.page.getByRole('alert')).toContainText(/has changed/i);
  }
}
