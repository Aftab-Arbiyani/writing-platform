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
    return this.page.getByRole('heading', { name: 'AI usage', exact: true });
  }

  /**
   * Scoped to the named windows list.
   *
   * An unscoped `listitem` lookup here resolves nine elements, not three: the settings section nav is a
   * list, and so is the per-feature breakdown below. Naming the list in the app was the right fix — the
   * group needed an accessible name anyway — rather than a positional `.slice`.
   */
  get windows(): Locator {
    return this.page.getByRole('list', { name: 'Usage windows' }).getByRole('listitem');
  }

  get forecast(): Locator {
    return this.page.getByRole('region', { name: 'This month, projected' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/billing/usage');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /**
   * All three windows rendered from `GET /monetization/usage`.
   *
   * Three is a contract constant, not a data count — the payload always carries daily, monthly and
   * total — so asserting it is safe where asserting a plan count would not be.
   */
  async expectResolved(): Promise<void> {
    await expect(this.page.getByText('Usage isn’t available yet')).toHaveCount(0);
    await expect(this.windows).toHaveCount(3, { timeout: 30_000 });
    await expect(this.forecast).toBeVisible();
  }

  /**
   * The allowance bar exists and carries its ARIA values.
   *
   * The bar is the only quantity on the card conveyed by *width*, so a `progressbar` without values is
   * invisible to a screen reader — which is exactly the defect class a role-based selector catches for
   * free.
   */
  async expectAllowanceBar(window: 'Today' | 'This month'): Promise<void> {
    const bar = this.page.getByRole('progressbar', { name: `${window} allowance used` });
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('aria-valuenow', /\d+/);
  }

  /** The lifetime window is uncapped by definition, so it must show no bar at all. */
  async expectLifetimeUncapped(): Promise<void> {
    await expect(
      this.page.getByRole('progressbar', { name: 'Lifetime allowance used' }),
    ).toHaveCount(0);
  }
}

/** `/settings/billing/credits` — ported from mobile's `credit_dashboard_screen`. */
export class CreditsPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { name: 'AI credits', exact: true });
  }

  get balanceCard(): Locator {
    return this.page.getByRole('region', { name: 'Balance' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/billing/credits');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  async expectResolved(): Promise<void> {
    await expect(this.page.getByText('Credits aren’t available yet')).toHaveCount(0);
    await expect(this.balanceCard).toBeVisible({ timeout: 30_000 });
  }

  /**
   * The balance card is behind a `PremiumGate` on `ai_budget` — the one premium feature the server
   * actually enforces. A free account is granted it (`DEFAULT_PLAN_FEATURES`), so the card shows; a
   * deny override replaces it with the lock, which {@link expectBalanceGated} asserts.
   */
  async expectBalanceGated(): Promise<void> {
    await expect(this.balanceCard).toHaveCount(0);
    await expect(this.page.getByText(/needs a paid plan/i)).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Buying credits is store-only by contract — `POST /credits/purchase` rejects an empty receipt before
   * it reaches a provider, and a browser has no receipt to send. So the surface must EXPLAIN that
   * rather than offer a button that could only fail.
   */
  async expectNoBrowserPurchasePath(): Promise<void> {
    await expect(this.page.getByRole('region', { name: 'Getting more credits' })).toBeVisible();
    await expect(this.page.getByText(/only possible in the mobile app/i)).toBeVisible();
    await expect(this.page.getByRole('button', { name: /^Buy/ })).toHaveCount(0);
  }
}

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
