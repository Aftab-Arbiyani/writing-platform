import { type Locator, type Page, expect } from '@playwright/test';

/**
 * The command-palette search (docs/e2e app map, `features/search`). Opened from the
 * top bar; an AntD modal with a combobox and a `role="listbox"` of `role="option"`
 * suggestions. A piece suggestion links to `/p/:slug` (the reader view is a later
 * frontend epic — assert the navigation target, not a rendered reader page).
 */
export class SearchPalette {
  constructor(private readonly page: Page) {}

  private get openButton(): Locator {
    return this.page.getByRole('button', { name: 'Open search (Command K)' });
  }
  private get input(): Locator {
    return this.page.getByRole('combobox', { name: /Search writers, pieces, tags/ });
  }
  private option(name: string): Locator {
    // exact:true — a piece suggestion's accessible name is exactly its title, whereas the
    // "Search everything for …" run row also contains the title as a substring.
    return this.page.getByRole('option', { name, exact: true });
  }

  async open(): Promise<void> {
    await this.openButton.click();
    await expect(this.input).toBeVisible({ timeout: 30_000 });
  }

  async type(query: string): Promise<void> {
    await this.input.fill(query);
  }

  /** Assert a piece suggestion with the exact title appears, and return its locator. */
  async expectPieceOption(title: string): Promise<Locator> {
    const opt = this.option(title);
    await expect(opt).toBeVisible();
    return opt;
  }

  /** Open a suggestion by clicking it. */
  async openOption(title: string): Promise<void> {
    await this.option(title).click();
  }
}
