import { type Page, type Locator, expect } from '@playwright/test';

/**
 * The in-editor **Writing tools** drawer (D5, was the AI assistant panel) — Polish, Manuscript
 * feedback and Story Map.
 *
 * Selectors are role/label based per [05 §3]: the drawer is a dialog, the tabs are tabs, and
 * every action is a named button — no test-ids were needed, except the disclosure note, whose text
 * is copy a spec should not have to repeat.
 */
export class WritingToolsDrawer {
  constructor(private readonly page: Page) {}

  /** The toggle in the editor header. */
  get trigger(): Locator {
    return this.page.getByRole('button', { name: 'Writing tools' });
  }

  get drawer(): Locator {
    return this.page.getByRole('dialog', { name: 'Writing tools' });
  }

  get polishTab(): Locator {
    return this.page.getByRole('tab', { name: 'Polish' });
  }

  get feedbackTab(): Locator {
    return this.page.getByRole('tab', { name: 'Feedback' });
  }

  /**
   * **Absent until the draft has autosaved** — Story Map takes the server piece id and is
   * owner-scoped server-side, so the drawer hides the tab while there is none (the web reading of
   * mobile's `isRemote` gate). A spec that opens the drawer on a blank `/write` will not find it,
   * and that is the contract, not a flake.
   */
  get storyMapTab(): Locator {
    return this.page.getByRole('tab', { name: 'Story Map' });
  }

  /** The visible tabpanel. All stay in the DOM; only one is not `hidden`. */
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
   * Assert the drawer reports the tools as unavailable rather than offering dead controls — the TRUE
   * contract wherever the master flag is down, which AF1 seeds it as.
   *
   * D5 changed this copy. It used to read "AI is turned off"; the state now covers both the platform
   * switch and a pre-D5 writer's own inert one, so it blames nobody and names no remedy — there is
   * no settings page left to send them to.
   */
  async expectUnavailable(): Promise<void> {
    // Scoped to the ACTIVE tabpanel: AntD keeps every panel mounted, so an unscoped text lookup
    // matches several notices at once.
    await expect(this.activePanel.getByText('Writing tools aren’t available')).toBeVisible({
      timeout: 15_000,
    });
    await expect(this.activePanel.getByRole('button', { name: 'Condense' })).toHaveCount(0);
  }

  /**
   * Assert the drawer blocks this tab on **its own** feature flag rather than on the master switch —
   * `feature-off`'s copy, not `off`'s.
   *
   * The distinction is the whole point wherever a test claims a tab is *separately* gated: with the
   * master flag down every tab says the same thing and a passing assertion proves nothing about
   * which flag did it. "Not available yet" can only render when the master is UP and this feature's
   * own flag is down, so it is the assertion that actually carries the claim.
   */
  async expectFeatureOff(): Promise<void> {
    await expect(this.activePanel.getByText('Not available yet')).toBeVisible({ timeout: 15_000 });
    await expect(this.activePanel.getByRole('button', { name: 'Condense' })).toHaveCount(0);
  }

  /**
   * Assert the editor offers **no** entry point at all — the contract when the platform is off
   * (`docs/45` §4.10, `editor-page.tsx`'s trigger condition). Distinct from
   * {@link expectUnavailable}, which is about what the drawer says once it is open; this is about
   * the drawer being unreachable in the first place, and the two cannot both hold.
   */
  async expectNoEntryPoint(): Promise<void> {
    await expect(this.trigger).toHaveCount(0);
    await expect(this.drawer).toHaveCount(0);
  }

  /**
   * Assert the tab offers its real controls — i.e. the tools resolved to `available` rather than to
   * any blocked state. Worth asserting before driving an action so a flag that failed to flip reads
   * as that, not as a dead button.
   *
   * **Precondition: the draft must have text in it.** Enabled (not merely present) is what
   * distinguishes `available` from `unknown` — the tab renders the same controls, disabled, while
   * the features query is in flight — but Polish also disables every action on an empty document
   * (`nothingToWorkWith`), so calling this on a blank draft fails for an unrelated reason.
   */
  async expectAvailable(): Promise<void> {
    await expect(this.activePanel.getByRole('button', { name: 'Condense' })).toBeEnabled({
      timeout: 15_000,
    });
  }

  /**
   * The live region the streamed suggestion accumulates into (`aria-live="polite"`).
   *
   * Labelled "Suggestion" since D5, not "AI suggestion" — the word is gone from every surface a
   * writer reads, and an accessible name is one of those.
   */
  get suggestion(): Locator {
    return this.activePanel.getByLabel('Suggestion');
  }

  /**
   * Run one of the Polish actions.
   *
   * The union is the whole set, deliberately: D5 left three actions, and a page object that took a
   * `string` would let a spec ask for `Rewrite` — deleted with the generation actions — and fail
   * with a selector timeout instead of a compile error.
   */
  async runAction(name: 'Simplify' | 'Condense' | 'Improve'): Promise<void> {
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
   * Accept the suggestion. With nothing selected Polish never replaces the document, so the commit
   * button reads "Insert below" — asserting the label rather than clicking whatever is first keeps a
   * change in that (deliberately non-destructive) default from passing silently.
   */
  async acceptSuggestion(): Promise<void> {
    await this.activePanel.getByRole('button', { name: 'Insert below' }).click();
  }

  /** Select a tab and wait for it to actually become the active one. */
  async selectTab(tab: 'Polish' | 'Feedback' | 'Story Map'): Promise<void> {
    const target = this.page.getByRole('tab', { name: tab });
    await target.click();
    await expect(target).toHaveAttribute('aria-selected', 'true');
  }

  /**
   * Story Map's view selector, settled. The tab opens on Characters and fires a read, so waiting for
   * the group AND the absence of the loading skeleton is what makes a scan measure the rendered
   * surface rather than three grey rectangles.
   */
  async expectStoryMapSettled(): Promise<void> {
    await expect(this.activePanel.getByRole('group', { name: 'Story Map view' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(this.activePanel.getByLabel('Loading the story graph')).toHaveCount(0, {
      timeout: 15_000,
    });
  }

  /** The "Map this story" trigger (D5). Reads "Re-map…" once the graph has nodes. */
  get mapStoryButton(): Locator {
    return this.activePanel.getByRole('button', { name: /Map this story/ });
  }

  /**
   * The disclosure every tool carries at its foot (D5 decision 9).
   *
   * Asserted by test-id rather than by its sentence: the copy is a product decision that may be
   * reworded, and a spec pinning the exact words would turn an editorial change into a red suite.
   * What must not change is that the line is THERE, on the tab the writer is looking at.
   */
  get disclosure(): Locator {
    return this.activePanel.getByTestId('model-disclosure');
  }
}
