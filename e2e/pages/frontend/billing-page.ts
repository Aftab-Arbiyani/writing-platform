import { type Locator, type Page, expect } from '@playwright/test';

/**
 * The monetization hub (AF5 W4 — `/settings/billing`): the viewer's plan, its state, the manage
 * controls, and the links to usage / credits / history / plans.
 *
 * Ported from mobile's `subscription_screen`, which is the reference for what belongs here. Selectors
 * are role/name based per [05 §1] — every card is a `section` named by its own heading, so it is a
 * `region` landmark, and every control is a named button. No test-ids were needed.
 */
export class BillingPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Billing', exact: true });
  }

  get freePlanCard(): Locator {
    return this.page.getByRole('region', { name: 'You’re on the Free plan' });
  }

  get planSummary(): Locator {
    return this.page.getByRole('region', { name: /plan$/ });
  }

  get manageCard(): Locator {
    return this.page.getByRole('region', { name: 'Manage' });
  }

  get billingNav(): Locator {
    return this.page.getByRole('navigation', { name: 'Billing sections' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/billing');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /**
   * The page reached a settled state — either a plan or the free upsell.
   *
   * Asserts the ABSENCE of the flag-off panel too: `VITE_ENABLE_MONETIZATION` defaults to false, and
   * without the `webServer` override the whole suite would pass against "Plans aren't available yet"
   * while proving nothing.
   */
  async expectResolved(): Promise<void> {
    await expect(this.page.getByText('Plans aren’t available yet')).toHaveCount(0);
    await expect(this.freePlanCard.or(this.planSummary).first()).toBeVisible({ timeout: 30_000 });
  }

  /** The nav offers Billing only while monetization is on — E2E runs it on. */
  async expectInSettingsNav(): Promise<void> {
    await expect(
      this.page
        .getByRole('navigation', { name: 'Settings sections' })
        .getByRole('link', { name: 'Billing' }),
    ).toBeVisible();
  }

  /**
   * The free state, which is what the seeded writer is in.
   *
   * `GET /monetization/subscription` answers a 404 for them, and the assertion that matters is that the
   * page renders an upsell rather than an error: a free reader is the majority case, and showing them a
   * failure would be the client mistaking a normal state for a broken one.
   */
  async expectFreePlan(): Promise<void> {
    await expect(this.freePlanCard).toBeVisible({ timeout: 30_000 });
    await expect(this.freePlanCard.getByRole('button', { name: 'Compare plans' })).toBeVisible();
  }

  async expectTier(tier: string): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: `${tier} plan`, exact: false }),
    ).toBeVisible();
  }

  /** Follow one of the four hub links, by its visible label. */
  async openSection(label: 'Plans' | 'AI usage' | 'AI credits' | 'Billing history'): Promise<void> {
    await this.billingNav.getByRole('link', { name: new RegExp(`^${label}`) }).click();
  }

  /** Every hub link is present — the four sub-surfaces are only reachable from here. */
  async expectAllSectionsLinked(): Promise<void> {
    for (const label of ['Plans', 'AI usage', 'AI credits', 'Billing history']) {
      await expect(
        this.billingNav.getByRole('link', { name: new RegExp(`^${label}`) }),
      ).toBeVisible();
    }
  }
}
