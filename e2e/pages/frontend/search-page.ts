import { type Locator, type Page, expect } from '@playwright/test';

/**
 * The full Search & Discovery screen `/search` (`features/search`), including the **AF4 half W5
 * added**: the engine toggle, retrieval-backed results with their grounding, query suggestions, and
 * saved searches (docs/45 §4, docs/36).
 *
 * All state is in the URL, so navigation is by URL rather than by driving the field — a shared
 * `/search?q=…&mode=ai` link is what a reader actually arrives on, and it is the contract W5 chose
 * the URL for. The field is still exercised where the point IS the field (a suggestion re-running the
 * query).
 *
 * Selectors are role/label based per [05 §3]: the results are a labelled `region`, the engine switch
 * a labelled `group` of `aria-pressed` buttons, the suggestions a labelled `nav`, and every action a
 * named button — no test-ids were needed.
 */
export class SearchPage {
  constructor(private readonly page: Page) {}

  // ── the page itself ────────────────────────────────────────────────────────

  /** The landing state (no query): recent / saved / trending. */
  async goto(): Promise<void> {
    await this.page.goto('/search');
    await expect(this.field).toBeVisible({ timeout: 30_000 });
  }

  /** A committed search, engine included — the shape of a shared link. */
  async gotoQuery(query: string, mode: 'keyword' | 'ai' = 'keyword'): Promise<void> {
    const params = new URLSearchParams({ q: query });
    if (mode === 'ai') params.set('mode', 'ai');
    await this.page.goto(`/search?${params.toString()}`);
    await expect(this.field).toBeVisible({ timeout: 30_000 });
  }

  get field(): Locator {
    return this.page.getByLabel('Search writers, pieces, tags, genres, and languages');
  }

  // ── the engine switch ─────────────────────────────────────────────────────

  private get engineGroup(): Locator {
    return this.page.getByRole('group', { name: 'Search engine' });
  }

  private engineButton(mode: 'keyword' | 'ai'): Locator {
    return this.engineGroup.getByRole('button', {
      name: mode === 'ai' ? 'AI search' : 'Keyword',
      exact: true,
    });
  }

  /**
   * Both engines are offered, whatever AI's availability — the control renders unconditionally so a
   * dark-launched deployment does not look like a build without the feature, and `aria-pressed`
   * (not styling) carries which one is running.
   */
  async expectEngineOffered(active: 'keyword' | 'ai'): Promise<void> {
    await expect(this.engineButton('keyword')).toBeVisible({ timeout: 30_000 });
    await expect(this.engineButton('ai')).toBeVisible();
    await expect(this.engineButton(active)).toHaveAttribute('aria-pressed', 'true');
  }

  /**
   * Switch engines by clicking. `mode=ai` is carried in the URL and `keyword` is the default, which
   * is *omitted* from it — so the state is asserted through the pressed control either way, and
   * through the URL only for the value that appears there.
   */
  async selectEngine(mode: 'keyword' | 'ai'): Promise<void> {
    await this.engineButton(mode).click();
    await expect(this.engineButton(mode)).toHaveAttribute('aria-pressed', 'true');
    if (mode === 'ai') await expect(this.page).toHaveURL(/mode=ai/);
  }

  /** Scope tabs belong to keyword search only: AF4 returns mixed entity types by design. */
  async expectScopeTabsHidden(): Promise<void> {
    await expect(this.page.getByRole('tab', { name: 'Pieces' })).toHaveCount(0);
  }

  // ── AI results + grounding ────────────────────────────────────────────────

  get aiResults(): Locator {
    return this.page.getByRole('region', { name: 'AI search results' });
  }

  /**
   * One ranked result for a piece. A navigable card is a single link named `<type>: <title>` — and the
   * type is the DISPLAY label, so a piece reads "Story" (`retrieval-labels.ts` maps the wire's
   * `piece` → "Story", which is the word the product uses). AF4 answers mixed entity types, so the
   * result set legitimately also contains tags and authors; this addresses the piece cards only.
   */
  resultCard(title: string): Locator {
    return this.aiResults.getByRole('link', { name: `Story: ${title}` });
  }

  /**
   * The AF4 result set resolved: a card for `title`, and the platform's design law satisfied —
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
    await expect(this.aiResults.getByText(/\d+ of \d+ candidates/)).toBeVisible({
      timeout: 30_000,
    });
  }

  /** The blocked state of the AI engine — off / not enabled / out of allowance / needs a plan. */
  async expectAiUnavailable(): Promise<void> {
    await expect(
      this.page
        .getByText('AI is turned off')
        .or(this.page.getByText('Not available yet'))
        .or(this.page.getByText('You’ve used your AI allowance'))
        .or(this.page.getByText('This needs a paid plan')),
    ).toBeVisible({ timeout: 30_000 });
    await expect(this.aiResults).toHaveCount(0);
  }

  /** Specifically the master-switch state, which is what AF1 seeds every deployment into. */
  async expectAiOff(): Promise<void> {
    await expect(this.page.getByText('AI is turned off')).toBeVisible({ timeout: 30_000 });
  }

  /**
   * The signed-out state, and the one control it offers.
   *
   * Every AF4 route needs a session, so this is what the majority of a public search page's traffic
   * meets. It exists because the alternative was not "a skeleton" but a broken page: an anonymous gate
   * read 401s, and the api client treats a 401 outside `/auth/*` as a terminal session failure and
   * clears the query cache (docs/48 §3.9 W5-6).
   */
  async expectSignedOut(): Promise<void> {
    await expect(this.page.getByText('Sign in to use AI search')).toBeVisible({ timeout: 30_000 });
    await expect(this.noticeSignIn).toBeVisible();
  }

  /** Follow the notice's sign-in action; it must carry the whole search URL as `returnTo`. */
  async followSignIn(): Promise<void> {
    await this.noticeSignIn.click();
  }

  /**
   * The notice's own sign-in button, scoped to `main`.
   *
   * The top bar offers a "Sign in" of its own to every anonymous visitor, so an unscoped lookup is
   * ambiguous — and the two are not interchangeable: only this one carries the search URL as
   * `returnTo`.
   */
  private get noticeSignIn(): Locator {
    return this.page.locator('#main').getByRole('button', { name: 'Sign in', exact: true });
  }

  // ── synthesis (opt-in, the only part that spends tokens) ───────────────────

  private get synthesizeToggle(): Locator {
    return this.page.getByRole('button', { name: /^(Explain these results|AI answer on)$/ });
  }

  async explainResults(): Promise<void> {
    const toggle = this.synthesizeToggle;
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  }

  /** The grounded answer block. `contains`, because synthesis is prose, not a fixed string. */
  async expectAnswer(contains: string): Promise<void> {
    const answer = this.aiResults.getByText('AI answer', { exact: true });
    await expect(answer).toBeVisible({ timeout: 60_000 });
    await expect(this.aiResults).toContainText(contains, { timeout: 60_000 });
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
   * Save the current AI search under `name`. The dialog pre-fills the query, so this replaces it —
   * a saved search is named by its owner, and the test needs a name it can find again.
   */
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
   * Re-run a saved search. It switches to the AI engine as well as setting the query: restoring an
   * AF4 search into keyword mode would answer the reader's saved question with a different engine.
   */
  async runSaved(name: string): Promise<void> {
    await this.savedEntry(name).click();
    await expect(this.page).toHaveURL(/mode=ai/, { timeout: 30_000 });
  }

  async removeSaved(name: string): Promise<void> {
    await this.savedSection.getByRole('button', { name: `Remove saved search “${name}”` }).click();
    await expect(this.savedEntry(name)).toHaveCount(0, { timeout: 30_000 });
  }

  /** The section is silent when there is nothing to show or AI is unavailable — never a hollow heading. */
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
