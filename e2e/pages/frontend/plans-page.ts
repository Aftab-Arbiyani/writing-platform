import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Plan comparison (AF5 W4 — `/settings/billing/plans`): the catalogue, the interval toggle, the promo
 * field, and the subscribe / change-plan control.
 *
 * The interval control is a real `radiogroup`, and the plan list a real `list` of `listitem`s, so both
 * are reachable by role. A plan's button carries the plan name ("Upgrade to Plus"), which is what makes
 * per-card targeting possible without a test-id ([05 §3.2]: the element already has a stable role and
 * accessible name).
 */
export class PlansPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Plans', exact: true });
  }

  /** Scoped to the named plan list — the settings section nav is a list of `listitem`s too. */
  get planCards(): Locator {
    return this.page.getByRole('list', { name: 'Plans' }).getByRole('listitem');
  }

  get intervalToggle(): Locator {
    return this.page.getByRole('radiogroup', { name: 'Billing interval' });
  }

  /**
   * The promo input, by ROLE rather than label.
   *
   * `getByLabel('Promo code')` matches two elements — the input and the `aria-labelledby` section that
   * contains it — so it is a strict-mode violation. `getByRole('textbox', { name })` names exactly the
   * control ([05 §1]).
   */
  get promoField(): Locator {
    return this.page.getByRole('textbox', { name: 'Promo code' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/billing/plans');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /**
   * The catalogue rendered from the real pricing config.
   *
   * Waits on the free tier's presence rather than a count: the number of tiers is admin-configurable
   * (`PricingService.listPlans`), so asserting "three cards" would fail on a stack that added one, for
   * a reason that has nothing to do with this client.
   */
  async expectResolved(): Promise<void> {
    await expect(this.page.getByText('Plans aren’t available yet')).toHaveCount(0);
    await expect(this.page.getByRole('heading', { name: 'Free', level: 3 })).toBeVisible({
      timeout: 30_000,
    });
  }

  async selectInterval(interval: 'Monthly' | 'Yearly'): Promise<void> {
    const option = this.intervalToggle.getByRole('radio', { name: interval });
    await option.click();
    await expect(option).toHaveAttribute('aria-checked', 'true');
  }

  /** A price is on screen, in the app's own money formatting. */
  async expectPrice(text: string): Promise<void> {
    await expect(this.page.getByText(text, { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });
  }

  /**
   * The free tier must never show a price.
   *
   * The live catalogue prices free under the `none` interval, not `monthly` — so a client that indexed
   * the shown interval blindly would print "$0.00 / mo", a price the server never quoted.
   */
  async expectFreeHasNoPrice(): Promise<void> {
    const freeCard = this.planCards.filter({
      has: this.page.getByRole('heading', { name: 'Free' }),
    });
    await expect(freeCard.getByText('$0.00')).toHaveCount(0);
  }

  /** Start a subscribe / change on a named tier. */
  async choose(tier: 'Plus' | 'Pro' | 'Enterprise'): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(`to ${tier}$`) }).click();
  }

  /** Whether a paid tier offers a control at all (the current plan does not). */
  async expectChoosable(tier: string, choosable: boolean): Promise<void> {
    await expect(this.page.getByRole('button', { name: new RegExp(`to ${tier}$`) })).toHaveCount(
      choosable ? 1 : 0,
    );
  }

  async expectCurrentPlanMarked(): Promise<void> {
    await expect(this.page.getByText('Current plan')).toBeVisible();
  }

  /**
   * The honest refusal.
   *
   * **This is the state the E2E stack genuinely produces**, and asserting it is the point rather than a
   * concession: every payment adapter is key-gated (`isConfigured()` tests a secret for emptiness) and
   * `PaymentProvider.Manual` has no adapter at all, so a checkout without third-party credentials is
   * declined. The contract for this deployment is that the UI says so and charges nothing — not that a
   * checkout succeeds. Faking one would violate the no-mocks invariant and lie to a reader besides.
   */
  async expectPaymentsUnavailable(): Promise<void> {
    await expect(
      this.page.getByRole('region', { name: 'Payments aren’t available yet' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByText(/Nothing was charged/i)).toBeVisible();
  }

  /** A coupon preview, through the real `POST /coupons/validate`. */
  async applyPromoCode(code: string): Promise<void> {
    await this.promoField.fill(code);
    await this.page.getByRole('button', { name: 'Apply', exact: true }).click();
  }

  /**
   * An unknown code is REJECTED, not errored.
   *
   * The endpoint catches both coupon exceptions and resolves `{ valid: false }`, so the surface must
   * read as a refusal of the code rather than a failure of the request.
   */
  async expectPromoRejected(): Promise<void> {
    await expect(this.page.getByText(/isn’t valid or has expired/i)).toBeVisible({
      timeout: 30_000,
    });
  }
}
