import { type Locator, type Page, expect } from '@playwright/test';

/**
 * The full Search & Discovery screen `/search` (`features/search`) — ranked results with their
 * grounding, query suggestions, scope tabs and saved searches.
 *
 * All state is in the URL, so navigation is by URL rather than by driving the field — a shared
 * `/search?q=…` link is what a reader actually arrives on. The field is still exercised where the
 * point IS the field (a suggestion re-running the query).
 *
 * **D5 merged the two engines**, so this file lost the whole engine-switch section, the synthesis
 * toggle and the signed-out notice. What replaced them is the `All` scope: it holds the ranked
 * results, and every narrower tab is that entity's keyword list.
 *
 * Selectors are role/label based per [05 §3]: the results are a labelled `region`, the suggestions a
 * labelled `nav`, and every action a named button — no test-ids were needed.
 */
export class SearchPage {
  constructor(private readonly page: Page) {}

  // ── the page itself ────────────────────────────────────────────────────────

  /** The landing state (no query): recent / saved / trending. */
  async goto(): Promise<void> {
    await this.page.goto('/search');
    await expect(this.field).toBeVisible({ timeout: 30_000 });
  }

  /**
   * A committed search — the shape of a shared link.
   *
   * `scope` narrows to one entity's keyword list; omitted, the reader lands on `All`, which is the
   * ranked answer and the page's default.
   */
  async gotoQuery(query: string, scope?: 'pieces' | 'writers' | 'tags'): Promise<void> {
    const params = new URLSearchParams({ q: query });
    if (scope !== undefined) params.set('type', scope);
    await this.page.goto(`/search?${params.toString()}`);
    await expect(this.field).toBeVisible({ timeout: 30_000 });
  }

  /**
   * A link carrying the retired `mode=ai` parameter.
   *
   * Kept as its own method because the compatibility claim is worth naming: those links are in
   * readers' bookmarks and in their saved searches, and they must still land on the results that
   * parameter used to select — which they do by being ignored.
   */
  async gotoLegacyAiLink(query: string): Promise<void> {
    await this.page.goto(`/search?q=${encodeURIComponent(query)}&mode=ai`);
    await expect(this.field).toBeVisible({ timeout: 30_000 });
  }

  get field(): Locator {
    return this.page.getByLabel('Search writers, pieces, tags, genres, and languages');
  }

  // ── scope tabs ────────────────────────────────────────────────────────────

  private scopeTab(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }

  /**
   * The scope tabs, on every search.
   *
   * They used to be hidden in AI mode — the engine answers mixed entity types, so a scope tab there
   * would have done nothing. D5 made `All` the ranked scope instead of a separate engine, so the
   * tabs are one list again and always present.
   */
  async expectScopesOffered(active: string): Promise<void> {
    await expect(this.scopeTab('All')).toBeVisible({ timeout: 30_000 });
    await expect(this.scopeTab('Pieces')).toBeVisible();
    await expect(this.scopeTab('Writers')).toBeVisible();
    await expect(this.scopeTab(active)).toHaveAttribute('aria-current', 'page');
  }

  /** Narrow to one scope by clicking its tab, and wait for the URL to carry it. */
  async selectScope(name: 'Pieces' | 'Writers' | 'Tags'): Promise<void> {
    await this.scopeTab(name).click();
    await expect(this.page).toHaveURL(new RegExp(`type=${name.toLowerCase()}`), {
      timeout: 30_000,
    });
  }

  /**
   * The `All` scope offers exactly the filters the ranked engine accepts — language and genre — and
   * none of the pieces-only ones.
   *
   * Both halves were wrong until the W5 parity sweep (48 §3.9 W5-11): the bar was gated on a scope
   * tab the ranked engine did not have, so on a normal ranked search it rendered nothing at all, and
   * on a URL carrying `type=pieces` it rendered three controls `SemanticSearchDto` ignores. D5's
   * merge fixed the first half by construction. Asserted at desktop width, where the bar is inline
   * rather than behind the mobile "Filters" sheet.
   */
  async expectRankedFiltersOffered(): Promise<void> {
    // By ROLE, not by label: AntD puts the `aria-label` on both the wrapper and the inner input, so a
    // label lookup is ambiguous in strict mode. The combobox is the control a reader actually operates.
    await expect(this.filterControl('Filter by language')).toBeVisible({ timeout: 30_000 });
    await expect(this.filterControl('Filter by genre')).toBeVisible();
    await expect(this.filterControl('Filter by reading time')).toHaveCount(0);
    await expect(this.filterControl('Filter by publish date')).toHaveCount(0);
  }

  private filterControl(name: string): Locator {
    return this.page.getByRole('combobox', { name });
  }

  // ── ranked results + grounding ────────────────────────────────────────────

  get rankedResults(): Locator {
    return this.page.getByRole('region', { name: 'Search results' });
  }

  /**
   * One ranked result for a piece. A navigable card is a single link named `<type>: <title>` — and the
   * type is the DISPLAY label, so a piece reads "Story" (`retrieval-labels.ts` maps the wire's
   * `piece` → "Story", which is the word the product uses). AF4 answers mixed entity types, so the
   * result set legitimately also contains tags and authors; this addresses the piece cards only.
   */
  resultCard(title: string): Locator {
    return this.rankedResults.getByRole('link', { name: `Story: ${title}` });
  }

  /**
   * The ranked result set resolved: a card for `title`, and the platform's design law satisfied —
   * the card states WHY it surfaced and HOW strongly, with the score in the accessible name rather
   * than only as a bar.
   *
   * One assertion covers both halves, and deliberately: `RankingLine` renders **nothing** when the
   * server sends an empty reason, so the sr-only "— relevance N%" text can only be present when the
   * reason is too. A separate "the reason is non-empty" check would be the same assertion twice.
   */
  async expectGroundedResult(title: string): Promise<void> {
    const card = this.resultCard(title);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText(/relevance \d+%/);
  }

  /** The server's own account of the run: how much it considered, and whether it degraded. */
  async expectCandidateMeta(): Promise<void> {
    await expect(this.rankedResults.getByText(/\d+ of \d+ candidates/)).toBeVisible({
      timeout: 30_000,
    });
  }

  /**
   * The ranked results are reachable WITHOUT a session.
   *
   * D5's largest behavioural claim on this page, and asserted as a presence plus an absence: the
   * results render, and the four "not available" notices that used to gate them are gone. Search is
   * public now — the route needs no session and the pipeline calls no model.
   */
  async expectPublicResults(): Promise<void> {
    await expect(this.rankedResults).toBeVisible({ timeout: 30_000 });
    for (const gone of [
      'AI is turned off',
      'Not available yet',
      'Sign in to use AI search',
      'Writing tools aren’t available',
    ]) {
      await expect(this.page.getByText(gone)).toHaveCount(0);
    }
  }

  // ── query suggestions ─────────────────────────────────────────────────────

  private get suggestions(): Locator {
    return this.page.getByRole('navigation', { name: 'Suggested searches' });
  }

  /** Pick the first offered alternative phrasing and wait for it to become the committed query. */
  async pickFirstSuggestion(): Promise<string> {
    await expect(this.suggestions).toBeVisible({ timeout: 30_000 });
    const chip = this.suggestions.getByRole('button').first();
    const label = (await chip.textContent())?.trim() ?? '';
    await chip.click();
    await expect(this.page).toHaveURL(/[?&]q=/);
    return label;
  }

  // ── saved searches ────────────────────────────────────────────────────────

  private get savedSection(): Locator {
    return this.page.getByRole('region', { name: 'Saved' });
  }

  savedEntry(name: string): Locator {
    return this.savedSection.getByRole('button', { name: new RegExp(escapeRegExp(name)) }).first();
  }

  /**
   * Open the save dialog and leave it open — for a scan that wants the modal itself.
   *
   * Deliberately separate from {@link saveSearch}: a caller that opens it after an axe scan must NOT
   * close it (the scan's animation kill switch stops AntD's zoom-leave from ever finishing), so it
   * navigates away instead. Returns the dialog so the caller can assert inside it.
   */
  async openSaveDialog(): Promise<Locator> {
    await this.page.getByRole('button', { name: 'Save search' }).click();
    const dialog = this.page.getByRole('dialog', { name: 'Name this search' });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    return dialog;
  }

  async saveSearch(name: string): Promise<void> {
    const dialog = await this.openSaveDialog();
    await dialog.getByLabel('Name').fill(name);

    /**
     * Wait for the WRITE, then for the dialog — armed before the click, in that order, because the
     * reverse is flaky and was measured so (1 failure in 7 under parallel load): the dialog only
     * begins closing once the mutation resolves, and AntD then animates it out (`ant-zoom-leave`),
     * during which it is still "visible". A bare `toBeHidden()` on the default 10 s therefore raced
     * both the request and the animation, and reported "the dialog did not close" for what was really
     * a slow save. Waiting on the response makes the server row the thing being asserted; the longer
     * timeout then covers only the animation.
     */
    const saved = this.page.waitForResponse(
      (response) =>
        response.url().includes('/ai/search/saved') && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await saved;
    await expect(dialog).toBeHidden({ timeout: 30_000 });
  }

  async expectSaved(name: string): Promise<void> {
    await expect(this.savedEntry(name)).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Re-run a saved search.
   *
   * It used to have to restore the AI engine as well as the query — running a saved search in
   * keyword mode answered the reader's saved question with a different engine (48 §3.9 W5-7). With
   * one engine there is nothing to restore, so this asserts only that the query committed.
   */
  async runSaved(name: string): Promise<void> {
    await this.savedEntry(name).click();
    await expect(this.page).toHaveURL(/[?&]q=/, { timeout: 30_000 });
  }

  async removeSaved(name: string): Promise<void> {
    await this.savedSection.getByRole('button', { name: `Remove saved search “${name}”` }).click();
    await expect(this.savedEntry(name)).toHaveCount(0, { timeout: 30_000 });
  }

  /** The section is silent for a signed-out reader or an empty list — never a hollow heading. */
  async expectNoSavedSection(): Promise<void> {
    await expect(this.savedSection).toHaveCount(0);
  }

  // ── keyword results (the engine that must keep working) ───────────────────

  /** A keyword hit for `title`. The card's title is a link to the piece. */
  keywordResult(title: string): Locator {
    return this.page.getByRole('link', { name: title, exact: true });
  }

  async expectKeywordResult(title: string): Promise<void> {
    await expect(this.keywordResult(title)).toBeVisible({ timeout: 30_000 });
  }
}

/** Saved-search names carry generated tokens; escape them before use in a locator RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
