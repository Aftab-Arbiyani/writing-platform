import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Writing editor + publish flow (docs/e2e/05 §4). The editor autosaves (no save
 * button); clicking "Publish" opens the "Ready to publish" drawer where genre is
 * required. All TipTap/AntD-drawer quirks live here so specs stay readable.
 */
export class EditorPage {
  constructor(private readonly page: Page) {}

  private get titleInput(): Locator {
    return this.page.getByLabel('Title');
  }
  private get body(): Locator {
    // TipTap/ProseMirror contenteditable root. This `.ProseMirror` class is the
    // single sanctioned CSS escape (docs/e2e/05 §4) — a contenteditable div does
    // not reliably expose an implicit `textbox` role, so role/label lookups miss it.
    return this.page.locator('.ProseMirror');
  }
  private get publishButton(): Locator {
    return this.page.getByRole('button', { name: 'Publish' });
  }
  private get publishSheet(): Locator {
    return this.page.getByRole('dialog', { name: 'Ready to publish' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/write');
    // Generous first-render wait for the Vite dev cold-compile of this route (local only).
    await expect(this.titleInput).toBeVisible({ timeout: 30_000 });
  }

  async writePiece({ title, body }: { title: string; body: string }): Promise<void> {
    await this.titleInput.fill(title);
    // contenteditable: real key events so ProseMirror registers the input.
    await this.body.click();
    await this.body.pressSequentially(body);
  }

  /**
   * Publish the current draft: open the drawer, ensure a genre is chosen (publish
   * requires it), submit, and wait for the published-drafts landing.
   */
  async publish(): Promise<void> {
    await this.publishButton.click();
    const sheet = this.publishSheet;
    await expect(sheet).toBeVisible();

    await this.selectGenre(sheet);

    await sheet.getByRole('button', { name: 'Publish now' }).click();
    // On success the editor navigates to the published-drafts list.
    await this.page.waitForURL(/\/me\/drafts\?.*status=published/);
  }

  /** Choose a genre in the publish drawer's Genre select. */
  private async selectGenre(sheet: Locator): Promise<void> {
    await sheet.getByLabel('Genre').click();
    // AntD dropdown options render in a virtualized body portal and can report as
    // "not visible" while animating; keyboard selection is robust to that. Any
    // seeded genre satisfies publish, so pick the first.
    await this.page.getByRole('option').first().waitFor({ state: 'attached' });
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
  }
}
