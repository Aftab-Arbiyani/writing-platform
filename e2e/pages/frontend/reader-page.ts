import { type Page, type Locator, expect } from '@playwright/test';

/**
 * The reading view `/p/:slug` (W1, docs/45 §4.1) — the surface that discharges the
 * "reader page deferred" note carried since Phase 2 (docs/e2e/06 §2.1, §4).
 *
 * Selectors are role/text-based per [05 §3]: the article is a landmark, the title is the
 * page's only `h1`, and the engagement bar is labelled — no test-ids were needed.
 */
export class ReaderPage {
  constructor(private readonly page: Page) {}

  get article(): Locator {
    return this.page.getByRole('article');
  }

  get title(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  get engagement(): Locator {
    return this.page.getByLabel('Engagement on this piece');
  }

  /** The rendered body. Class-based by necessity — prose has no role of its own. */
  get body(): Locator {
    return this.page.locator('.qalam-prose');
  }

  get settingsTrigger(): Locator {
    return this.page.getByRole('button', { name: 'Reading settings' });
  }

  get likeButton(): Locator {
    return this.page.getByRole('button', { name: /^(Like|Unlike) this piece$/ });
  }

  get copyLinkButton(): Locator {
    return this.page.getByRole('button', { name: 'Copy link to this piece' });
  }

  async gotoSlug(slug: string): Promise<void> {
    await this.page.goto(`/p/${slug}`);
  }

  /** The piece rendered: title present and the body actually produced content. */
  async expectRendered(title: string): Promise<void> {
    await expect(this.title).toHaveText(title, { timeout: 30_000 });
    await expect(this.body).toBeVisible();
  }

  /** The not-found state — a removed/unpublished piece, or a bad link. */
  async expectNotFound(): Promise<void> {
    await expect(this.page.getByText('This piece isn’t here.')).toBeVisible({ timeout: 30_000 });
  }

  async expectAuthorLink(username: string): Promise<void> {
    await expect(
      this.article.getByRole('link', { name: new RegExp(username, 'i') }).first(),
    ).toBeVisible();
  }

  /**
   * Open the typography panel and pick a text size. The panel is an AntD popover, so the
   * radiogroup only exists in the DOM once opened.
   */
  async setTextSize(label: 'S' | 'M' | 'L'): Promise<void> {
    await this.settingsTrigger.click();
    const group = this.page.getByRole('radiogroup', { name: 'Text size' });
    await expect(group).toBeVisible();
    // The radio `input` AntD renders is visually hidden, so it is not clickable — the pill a
    // reader actually clicks is its `<label>`. Assert through the role, act through the label.
    await expect(group.getByRole('radio', { name: label, exact: true })).toHaveCount(1);
    await group
      .locator('label')
      .filter({ hasText: new RegExp(`^${label}$`) })
      .click();
  }

  /**
   * The computed body font-size, to prove a preference actually reached the prose. The e2e
   * tsconfig omits the `dom` lib (see viewport.ts), so this measures via string-form evaluate.
   */
  async proseFontSize(): Promise<string> {
    const size = await this.page.evaluate(
      "getComputedStyle(document.querySelector('.qalam-prose')).fontSize",
    );
    return String(size);
  }
}
