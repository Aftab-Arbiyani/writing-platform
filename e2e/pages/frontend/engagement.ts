import { type Page, type Locator, expect } from '@playwright/test';

/**
 * The reader's engagement bar and the two dialogs behind its "More" menu (W7b, docs/45 §4.4) —
 * claps, save-to-collection and report, all on the reading view `/p/:slug`.
 *
 * Pair it with `ReaderPage`; there is no route of its own.
 *
 * Selectors are role/text-based per [05 §3]: the clap button is named by what it does and how many
 * the reader has given, the removal is named "Remove my N claps" (never a decrement), and both
 * dialogs are real `dialog` landmarks.
 */
export class EngagementBar {
  constructor(private readonly page: Page) {}

  // ── Claps ────────────────────────────────────────────────────────────────────

  /**
   * The clap button, matched from the START of its name — "Remove my N claps" also ends in "claps",
   * and a looser matcher picks up both controls.
   */
  get clap(): Locator {
    return this.page.getByRole('button', { name: /^(Clap for this piece|You’ve given all)/ });
  }

  get removeClaps(): Locator {
    return this.page.getByRole('button', { name: /^Remove my/ });
  }

  /**
   * Clap `times` times as a real burst — the gesture the client must batch into one request.
   *
   * `dispatchEvent` rather than `click`, and that choice was earned twice over:
   *
   *  - **`locator.click()` is too slow to be a burst.** It re-runs actionability checks per call, and
   *    on a loaded Firefox worker those exceeded the client's 600 ms debounce — a seven-click loop
   *    arrived as `[{count:1},{count:1},{count:5}]` and failed while the code worked perfectly.
   *    Playwright's per-click latency is not a human clicking quickly (a real burst is 100–250 ms
   *    apart); the harness was the thing under test.
   *  - **Looping `element.click()` inside one `evaluate()` is worse.** Each clap re-renders the
   *    button, so the handle the loop captured goes stale after the first iteration and the remaining
   *    clicks land on a detached node — observed as `{count:1}` on Firefox.
   *
   * `dispatchEvent` re-resolves the locator every call (so it always hits the live node) and skips
   * the actionability wait (so the clicks stay inside one debounce window). It is a real DOM click
   * event; the ordinary click path is covered by every other clap test here.
   */
  async clapBurst(times: number): Promise<void> {
    for (let i = 0; i < times; i++) {
      await this.clap.dispatchEvent('click');
    }
  }

  /** The reader's own contribution, read off the button's accessible name. */
  async expectMine(count: number): Promise<void> {
    await expect(this.clap).toHaveAccessibleName(
      new RegExp(`you’ve given ${String(count)}\\b`, 'i'),
      { timeout: 15_000 },
    );
  }

  /** The capped state: named for why, and inert rather than live-and-refused. */
  async expectAtCap(max: number): Promise<void> {
    const capped = this.page.getByRole('button', {
      name: `You’ve given all ${String(max)} claps`,
    });
    await expect(capped).toBeVisible({ timeout: 15_000 });
    await expect(capped).toBeDisabled();
  }

  // ── The "More" menu ──────────────────────────────────────────────────────────

  get more(): Locator {
    return this.page.getByRole('button', { name: 'More actions on this piece' });
  }

  async openSaveToCollection(): Promise<void> {
    await this.more.click();
    await this.page.getByText('Save to a collection').click();
  }

  async openReport(): Promise<void> {
    await this.more.click();
    await this.page.getByText('Report this piece').click();
  }
}

/** The save-to-collection dialog — reachable from the reader, and from any piece card that offers it. */
export class SaveToCollectionDialog {
  constructor(private readonly page: Page) {}

  get dialog(): Locator {
    return this.page.getByRole('dialog');
  }

  collection(title: string): Locator {
    return this.dialog.getByRole('button', { name: new RegExp(title) });
  }

  async save(title: string): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: 15_000 });
    await this.collection(title).click();
  }
}

/**
 * The ONE report dialog (W7b) — generalized over `ReportEntityType`, so the same object drives it on
 * a piece, a comment, a response and a user. The heading is what distinguishes the four.
 */
export class ReportDialog {
  constructor(private readonly page: Page) {}

  get dialog(): Locator {
    return this.page.getByRole('dialog');
  }

  reason(label: string): Locator {
    return this.dialog.getByRole('radio', { name: label });
  }

  get details(): Locator {
    return this.dialog.getByLabel('Anything else? (optional)');
  }

  get submit(): Locator {
    return this.dialog.getByRole('button', { name: 'Send report' });
  }

  /** Pick a reason, optionally add detail, and submit. Resolves once the confirmation is up. */
  async file(reason: string, details?: string): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: 15_000 });
    await this.reason(reason).click();
    if (details !== undefined) await this.details.fill(details);
    await this.submit.click();
    // Honest confirmation: SENT for review, not acted on.
    await expect(this.page.getByText('Report sent for review')).toBeVisible({ timeout: 15_000 });
  }

  async expectTitled(what: string): Promise<void> {
    await expect(this.dialog.getByText(`Report ${what}`)).toBeVisible({ timeout: 15_000 });
  }
}
