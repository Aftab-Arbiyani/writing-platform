import { type Page, type Locator, expect } from '@playwright/test';

/**
 * The in-editor AI panel (W2/AF2, docs/45 §4.2) — the Writing Assistant + Craft Coach drawer.
 *
 * Selectors are role/label based per [05 §3]: the drawer is a dialog, the tabs are tabs, and
 * every action is a named button — no test-ids were needed.
 */
export class AssistantPanel {
  constructor(private readonly page: Page) {}

  /** The toggle in the editor header. */
  get trigger(): Locator {
    return this.page.getByRole('button', { name: 'AI assistant' });
  }

  get drawer(): Locator {
    return this.page.getByRole('dialog', { name: 'AI assistant' });
  }

  get assistantTab(): Locator {
    return this.page.getByRole('tab', { name: 'Assistant' });
  }

  get coachTab(): Locator {
    return this.page.getByRole('tab', { name: 'Craft Coach' });
  }

  /**
   * W9's two story-scoped tabs. **Both are absent until the draft has autosaved** — they take the
   * server piece id and are owner-scoped server-side, so the panel hides them while there is none
   * (the web reading of mobile's `isRemote` gate). A spec that opens the panel on a blank `/write`
   * will not find them, and that is the contract, not a flake.
   */
  get explorerTab(): Locator {
    return this.page.getByRole('tab', { name: 'Explorer' });
  }

  get askTab(): Locator {
    return this.page.getByRole('tab', { name: 'Ask' });
  }

  /** The visible tabpanel. Both stay in the DOM; only one is not `hidden`. */
  get activePanel(): Locator {
    return this.drawer.getByRole('tabpanel').locator('visible=true');
  }

  async open(): Promise<void> {
    await this.trigger.click();
    await expect(this.drawer).toBeVisible({ timeout: 15_000 });
  }

  async close(): Promise<void> {
    // AntD's drawer close control is an icon button labelled "Close".
    await this.drawer.getByRole('button', { name: 'Close' }).click();
    await expect(this.drawer).toBeHidden();
  }

  /**
   * Assert the panel reports AI as unavailable rather than offering dead controls. This is the TRUE
   * contract wherever the AI feature flags are down, which AF1 seeds them as and which is therefore
   * every deployment's starting state — the surface must degrade to an explanation, never to a
   * broken editor. (The stack now has a provider that can generate, so this asserts the flag gate
   * specifically; the generating half is asserted in `assistant.spec.ts`'s serial block.)
   */
  async expectUnavailable(): Promise<void> {
    // Scoped to the ACTIVE tabpanel: AntD keeps both panels mounted, so an unscoped text lookup
    // matches the assistant's notice and the coach's at once.
    await expect(this.activePanel.getByText('AI is turned off')).toBeVisible({ timeout: 15_000 });
    await expect(this.activePanel.getByRole('button', { name: 'Rewrite' })).toHaveCount(0);
  }

  /**
   * Assert the panel blocks this tab on **its own** feature flag rather than on the master switch —
   * `feature-off`'s copy, not `off`'s.
   *
   * The distinction is the whole point wherever a test claims a tab is *separately* gated: with the
   * master flag down every tab says "AI is turned off" and a passing assertion proves nothing about
   * which flag did it. "Not available yet" can only render when the master is UP and this feature's
   * own flag is down, so it is the assertion that actually carries the claim.
   */
  async expectFeatureOff(): Promise<void> {
    await expect(this.activePanel.getByText('Not available yet')).toBeVisible({ timeout: 15_000 });
    await expect(this.activePanel.getByRole('button', { name: 'Rewrite' })).toHaveCount(0);
  }

  /**
   * Assert the editor offers **no** AI entry point at all — B5's contract when AI is off for the
   * instance or for the account (`docs/45` §4.10, `editor-page.tsx`'s trigger condition). Distinct
   * from {@link expectUnavailable}, which is about what the panel says once it is open; this is
   * about the panel being unreachable in the first place, and the two cannot both hold.
   */
  async expectNoEntryPoint(): Promise<void> {
    await expect(this.trigger).toHaveCount(0);
    await expect(this.drawer).toHaveCount(0);
  }

  /**
   * Assert the panel offers its real controls — i.e. AI resolved to `available` rather than to any
   * of the four blocked states. The counterpart of {@link expectUnavailable}, and worth asserting
   * before driving an action so a flag that failed to flip reads as that, not as a dead button.
   *
   * **Precondition: the draft must have text in it.** Enabled (not merely present) is the assertion
   * that distinguishes `available` from `unknown` — the tab renders the same controls, disabled,
   * while the features query is still in flight — but the assistant also disables every quick action
   * on an empty document (`nothingToWorkWith`), so calling this on a blank draft fails for a reason
   * that has nothing to do with availability.
   */
  async expectAvailable(): Promise<void> {
    await expect(this.activePanel.getByRole('button', { name: 'Rewrite' })).toBeEnabled({
      timeout: 15_000,
    });
  }

  /** The live region the streamed suggestion accumulates into (`aria-live="polite"`). */
  get suggestion(): Locator {
    return this.activePanel.getByLabel('AI suggestion');
  }

  /** Run one of the quick actions (the assistant tab's one-click buttons). */
  async runQuickAction(name: 'Continue writing' | 'Rewrite' | 'Condense'): Promise<void> {
    await this.activePanel.getByRole('button', { name, exact: true }).click();
  }

  /**
   * Wait for the streamed suggestion to settle on `expected`.
   *
   * Waiting for the exact final text is what makes this an assertion about the STREAM rather than
   * about a single response: the panel renders "Thinking…" until the first delta lands and then
   * grows by delta, so this only passes once every chunk has been received and concatenated in
   * order. A one-blob response would satisfy a "contains something" check just as well.
   */
  async expectSuggestion(expected: string): Promise<void> {
    await expect(this.suggestion).toHaveText(expected, { timeout: 30_000 });
  }

  /**
   * Accept the suggestion. With nothing selected the assistant never replaces the document, so the
   * commit button reads "Insert below" — asserting the label rather than clicking whatever is first
   * keeps a change in that (deliberately non-destructive) default from passing silently.
   */
  async acceptSuggestion(): Promise<void> {
    await this.activePanel.getByRole('button', { name: 'Insert below' }).click();
  }

  /** Select a tab and wait for it to actually become the active one. */
  async selectTab(tab: 'Assistant' | 'Craft Coach' | 'Explorer' | 'Ask'): Promise<void> {
    const target = this.page.getByRole('tab', { name: tab });
    await target.click();
    await expect(target).toHaveAttribute('aria-selected', 'true');
  }

  /**
   * The Story Explorer's view selector, settled (W9). The tab opens on Characters and fires a read,
   * so waiting for the group to be visible AND the loading skeleton to be gone is what makes a scan
   * measure the rendered surface rather than three grey rectangles.
   */
  async expectExplorerSettled(): Promise<void> {
    await expect(this.activePanel.getByRole('group', { name: 'Explorer view' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(this.activePanel.getByLabel('Loading the story graph')).toHaveCount(0, {
      timeout: 15_000,
    });
  }

  /** Ask My Book's controls, ready to be driven or scanned (W9). Nothing here needs a request. */
  async expectAskSettled(): Promise<void> {
    await expect(this.activePanel.getByRole('group', { name: 'Ask about' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(this.activePanel.getByLabel('Your question')).toBeVisible();
  }
}
