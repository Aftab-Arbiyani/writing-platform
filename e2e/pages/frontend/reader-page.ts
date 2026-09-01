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

  // ── propose an edit (AF6, C-15 — docs/48 §3.22a) ──────────────────────────────────────────────

  get suggestTrigger(): Locator {
    return this.page.getByRole('button', { name: 'Suggest an edit' });
  }

  /**
   * Propose an edit to the paragraph containing `passage`.
   *
   * **No offset is passed, and that is the assertion.** The old composer on
   * `/write/:storyId/suggestions` asked the writer to type "Starts at character" by hand, because
   * that route renders no prose to select from — so the offset was a guess and the server's
   * offset-exact check 409'd it. Here the reader computes the anchor from the document, so this
   * method cannot express a wrong one.
   */
  async proposeEdit(input: { passage: string; suggested: string }): Promise<void> {
    await this.suggestTrigger.click();
    await expect(this.page.getByRole('status')).toContainText('Pick the paragraph');

    // Every selectable block is a real button named after its own passage, which is what makes the
    // prose keyboard-operable in this mode — see `content-renderer.tsx`.
    await this.page
      .getByRole('button', {
        name: new RegExp(`Suggest an edit to this passage: .*${input.passage}`),
      })
      .click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Your suggested wording').fill(input.suggested);
    await dialog.getByRole('button', { name: 'Send suggestion' }).click();
    await expect(dialog).toHaveCount(0);
  }

  /** The affordance must be absent for a viewer the Policy Engine does not allow to suggest. */
  async expectNoSuggestAffordance(): Promise<void> {
    await expect(this.suggestTrigger).toHaveCount(0);
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

  // ── "More like this" (W1 §4.1, upgraded in W5) ─────────────────────────────

  /** The related-pieces section. A labelled `section` → a `region` landmark named by its heading. */
  get related(): Locator {
    return this.page.getByRole('region', { name: 'More like this' });
  }

  private relatedItem(title: string): Locator {
    return this.related.getByRole('listitem').filter({ hasText: title });
  }

  /**
   * The section answered by the **AF4 recommender**, proven by the reason on every item.
   *
   * The two sources render the same section, so the reason is the only thing on screen that says
   * which one answered: the recommender explains every item, and the tag-search fallback has no reason
   * to give and renders none. The expected string is the one the server composes for a piece-seeded
   * `related_stories` request (the `pieceId` enabler, 48 §3.9 W5-2), so this asserts the whole path —
   * client parameter, server branch, rendered explanation.
   *
   * **It deliberately does not assert WHICH pieces come back.** The piece-seeded branch runs the seed's
   * tags through the E8 search engine, which ranks by relevance over the whole corpus — and on a
   * long-lived database that corpus is thousands of E2E pieces whose titles share tokens. A spec that
   * demanded its own sibling in the top four was asserting the ranker's output, and it failed roughly
   * one run in six for that reason while the feature was working perfectly (the reason line named the
   * right seed and the right tag every time). What must hold is the SOURCE, and that is what this
   * checks: at least one suggestion, and not one of them unexplained.
   */
  async expectRecommendedRelated(seedTitle: string): Promise<void> {
    const items = this.related.getByRole('listitem');
    await expect(items.first()).toBeVisible({ timeout: 30_000 });
    await expect(items.filter({ hasNotText: `Shares tags with “${seedTitle}”` })).toHaveCount(0);
  }

  /**
   * A suggestion produced by the **tag-search fallback** — the answer W1 shipped, and the one a
   * signed-out reader (or an un-flagged deployment) still gets. It carries no reason, which is what
   * distinguishes it here; the assertion is deliberately "no explanation" rather than "no AI",
   * because that absence is the observable difference.
   */
  async expectFallbackRelated(title: string): Promise<void> {
    const item = this.relatedItem(title);
    await expect(item).toBeVisible({ timeout: 30_000 });
    await expect(item).not.toContainText(/Shares tags with|Similar in subject to/);
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
