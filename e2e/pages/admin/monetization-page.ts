import { type Locator, type Page, expect } from '@playwright/test';

/**
 * The admin monetization surface (A1). Seven routes across three slices, all behind
 * `billing.manage`, all rendered by `features/monetization`.
 *
 * **Why the read-only pages assert a "ready marker" AND the absence of the error panel**, exactly
 * like `DashboardsPage` does: on a young install every analytics endpoint answers with a complete
 * response full of zeroes, so these pages deliberately render an EMPTY state instead of figures. A
 * spec that asserted a KPI tile would therefore fail on a fresh database and pass on a seeded one —
 * the marker has to be something that is present in both cases. So each entry carries the heading
 * plus an `anyOf` pair: the populated marker or the empty-state title. Either proves the query
 * resolved; neither is present while loading or on error.
 */
export interface MonetizationRoute {
  readonly key: string;
  readonly path: string;
  /** The page's `<h1>` (PageHeader owns the one document heading). */
  readonly heading: string;
  /** Text present once the read resolves WITH data. */
  readonly populatedMarker?: string;
  /** Text present once the read resolves with NO data — the honest empty state. */
  readonly emptyMarker?: string;
}

export const MONETIZATION_ROUTES: readonly MonetizationRoute[] = [
  // A1a — the levers.
  {
    key: 'plans',
    path: '/billing/plans',
    heading: 'Plans & pricing',
    // The catalogue always resolves: `getPlans` falls back to the compiled defaults, so a tier card
    // is present on every install.
    populatedMarker: 'Cross-cutting config',
  },
  {
    key: 'entitlements',
    path: '/billing/entitlements',
    heading: 'Entitlement overrides',
    // No account is selected on arrival, so this is the resting state rather than a data state.
    populatedMarker: 'No account selected',
  },
  // A1b — the money actions.
  {
    key: 'coupons',
    path: '/billing/coupons',
    heading: 'Coupons',
    populatedMarker: 'Create a coupon',
    emptyMarker: 'No coupons yet',
  },
  {
    key: 'actions',
    path: '/billing/actions',
    heading: 'Billing actions',
    populatedMarker: 'Adjust credits',
  },
  // A1c — the dashboards. Each can legitimately be empty on a young install.
  {
    key: 'revenue',
    path: '/billing/revenue',
    heading: 'Revenue',
    populatedMarker: 'Total revenue',
    emptyMarker: 'No payments recorded yet',
  },
  {
    key: 'subscriptions',
    path: '/billing/subscriptions',
    heading: 'Subscriptions',
    populatedMarker: 'By status',
    emptyMarker: 'No subscriptions yet',
  },
  {
    key: 'usage',
    path: '/billing/usage',
    heading: 'AI usage & cost',
    populatedMarker: 'Total tokens',
    emptyMarker: 'No AI usage recorded yet',
  },
];

export class MonetizationPage {
  constructor(private readonly page: Page) {}

  /**
   * The three write forms on this surface, each scoped by its own `data-testid`.
   *
   * **Why a testid and not a label or a heading.** `/billing/actions` renders two independent forms
   * side by side — "Adjust credits" and "Refund a payment" — and they share field labels: each has a
   * "User ID" and each has an "Amount". A page-wide `getByLabel('User ID')` is therefore ambiguous by
   * construction rather than by accident, and the only thing distinguishing the two accessible names
   * is the refund field's description hint, which would couple these locators to hint copy. Scoping
   * by heading does not work either: these cards render as plain `<div>`s with no landmark, so
   * `locator('div').filter({ has: heading })` matches every ancestor as well.
   *
   * So the containers carry an explicit test hook, on the docs/e2e/05 §3 precedent already set by
   * `data-testid="trust-panel"` and `data-testid="user-detail-drawer"`. Nothing user-facing changed.
   */
  get creditForm(): Locator {
    return this.page.getByTestId('credit-adjust-form');
  }

  /** `/billing/actions` — the refund form, which carries the payment picker. */
  get refundForm(): Locator {
    return this.page.getByTestId('refund-form');
  }

  /** `/billing/coupons` — the create form, whose code field owns the taken-code error. */
  get couponForm(): Locator {
    return this.page.getByTestId('coupon-create-form');
  }

  async goto(route: MonetizationRoute): Promise<void> {
    await this.page.goto(route.path);
    await expect(this.page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible({
      timeout: 30_000,
    });
  }

  /**
   * Assert the route mounted and its read settled — into data or into an honest empty state, either
   * of which is a pass — with no error panel.
   */
  async expectRenders(route: MonetizationRoute): Promise<void> {
    await this.goto(route);

    const markers = [route.populatedMarker, route.emptyMarker].filter(
      (marker): marker is string => marker !== undefined,
    );
    // `.or()` rather than two assertions: on a seeded CI database either branch may be the true one
    // and the spec must not care which.
    let locator = this.page.getByText(markers[0]!, { exact: true }).first();
    for (const marker of markers.slice(1)) {
      locator = locator.or(this.page.getByText(marker, { exact: true }).first());
    }
    await expect(locator).toBeVisible();

    await this.expectNoErrorPanel();
  }

  /** The shared `QErrorState` panel, which every section on this surface uses on a failed read. */
  async expectNoErrorPanel(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { level: 3, name: 'Something went wrong.' }),
    ).toHaveCount(0);
  }

  /** Every monetization nav item, for the RBAC assertions. */
  static readonly NAV_LABELS: readonly string[] = [
    'Plans & pricing',
    'Entitlements',
    'Coupons',
    'Billing actions',
    'Revenue',
    'Subscriptions',
    'AI usage & cost',
  ];
}
