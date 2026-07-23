import { type Locator, type Page, expect } from '@playwright/test';

type DraftStatus = 'draft' | 'published' | 'scheduled' | 'archived';

/**
 * Writer dashboard (`/me/drafts`, `features/writing`). Status is URL-driven
 * (`?status=`); pieces render as `<li>` rows with an `<h3>` title and per-row action
 * buttons (aria-label "Edit"/"Delete"/…). Rows are identified by their title text.
 */
export class DraftsPage {
  constructor(private readonly page: Page) {}

  private tab(name: string): Locator {
    return this.page.getByRole('button', { name });
  }
  private row(title: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: title });
  }

  async goto(status: DraftStatus = 'draft'): Promise<void> {
    await this.page.goto(`/me/drafts?status=${status}`);
    // Generous first-render wait for the Vite dev cold-compile of this route (local only).
    await expect(this.tab('Published')).toBeVisible({ timeout: 30_000 });
  }

  /** Open a piece for editing via its row's "Edit" button (→ /write/:id). */
  async editPiece(title: string): Promise<void> {
    await this.row(title).getByRole('button', { name: 'Edit' }).click();
  }

  /** Assert a piece with the given title appears in the current list. */
  async expectPiece(title: string): Promise<void> {
    await expect(this.page.getByRole('heading', { level: 3, name: title })).toBeVisible();
  }
}
