import { type Locator, type Page, expect } from '@playwright/test';

/**
 * The three read-only monetization surfaces (AF5 W4): AI usage, AI credits, and billing history.
 *
 * One file because they share a shape — a heading, real backend reads, and a settled state that must
 * be distinguishable from both the flag-off panel and an error panel. Each asserts the ABSENCE of the
 * error path, so a failed read cannot masquerade as a rendered dashboard (the same rule the admin
 * `dashboards.spec` follows).
 */

/** `/settings/billing/usage` — ported from mobile's `usage_dashboard_screen`. */
export class UsagePage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Usage', exact: true });
  }

  /**
   * Scoped to the named allowances list.
   *
   * An unscoped `listitem` lookup resolves the settings section nav too. Naming the list in the app
   * was the right fix — the group needed an accessible name anyway — rather than a positional
   * `.slice`.
   */
  get allowances(): Locator {
    return this.page.getByRole('list', { name: 'Tool allowances' }).getByRole('listitem');
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/billing/usage');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /**
   * The allowances rendered from `GET /monetization/usage`.
   *
   * **A count, not an exact number.** D5's three allowance rules are the current set and the seeded
   * free tier caps all three — but the set is derived from `AI_QUOTA_RULES`, which is meant to grow.
   * Pinning `3` here would make adding a fourth tool a red suite, and a spec that has to be edited
   * to add a feature is a spec that will be edited without being read.
   */
  async expectResolved(): Promise<void> {
    await expect(this.page.getByText('Usage isn’t available yet')).toHaveCount(0);
    await expect(this.allowances.first()).toBeVisible({ timeout: 30_000 });
  }

  /**
   * One tool's allowance bar exists and carries its ARIA values.
   *
   * The bar is the only quantity on the card conveyed by *width*, so a `progressbar` without values
   * is invisible to a screen reader — which is exactly the defect class a role-based selector
   * catches for free. The name comes from the SERVER's label for the rule, which is why this takes
   * one rather than hard-coding the set.
   */
  async expectAllowanceBar(tool: string): Promise<void> {
    const bar = this.page.getByRole('progressbar', { name: `${tool} allowance used` });
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(bar).toHaveAttribute('aria-valuenow', /\d+/);
  }

  /** An unlimited allowance draws no bar at all, rather than an empty one. */
  async expectUncapped(tool: string): Promise<void> {
    await expect(
      this.page.getByRole('progressbar', { name: `${tool} allowance used` }),
    ).toHaveCount(0);
  }
}

/**
 * D5 deleted `CreditsPage`, which drove `/settings/billing/credits` — the AI credit wallet, its
 * ledger and its store-only purchase explanation. The route, the page and the wallet behind them are
 * all gone (B4, F2).
 */

/** `/settings/billing/history` — mobile's `billing_history_screen`, plus two tabs it does not have. */
export class BillingHistoryPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Billing history', exact: true });
  }

  get tabs(): Locator {
    return this.page.getByRole('tablist', { name: 'Billing history' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/billing/history');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  async expectResolved(): Promise<void> {
    await expect(this.page.getByText('Billing history isn’t available yet')).toHaveCount(0);
    await expect(this.tabs).toBeVisible({ timeout: 30_000 });
  }

  async selectTab(tab: 'Invoices' | 'Payments' | 'Purchases' | 'Plan changes'): Promise<void> {
    const target = this.tabs.getByRole('tab', { name: tab });
    await target.click();
    await expect(target).toHaveAttribute('aria-selected', 'true');
  }

  /** Rows in the active ledger tab. Scoped to the panel — the settings nav is a list too. */
  private get rows(): Locator {
    return this.page.getByRole('tabpanel').getByRole('listitem');
  }

  /** How many rows the active ledger shows — the client-side half of "a payment was recorded". */
  async expectRowCount(count: number): Promise<void> {
    await expect(this.rows).toHaveCount(count, { timeout: 30_000 });
  }

  /**
   * A tab that has nothing to show says so, and does NOT show an error.
   *
   * This is the assertion that matters most on the "Plan changes" tab: unlike its three siblings,
   * `GET /monetization/subscription/history` answers **404 SUBSCRIPTION_NOT_FOUND** for a viewer with
   * no subscription instead of an empty page. Every free reader hits it, so without the client's
   * mapping this tab shows a failure where the truth is "nothing has happened yet" (docs/48 §3.6, W4-1).
   */
  async expectEmpty(message: RegExp): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByText(/went wrong|couldn’t/i)).toHaveCount(0);
  }
}
