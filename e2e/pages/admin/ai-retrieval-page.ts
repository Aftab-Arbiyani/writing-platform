import { type Locator, type Page, expect } from '@playwright/test';

import { selectAntdOption } from '../shared/antd';

/**
 * The admin AI retrieval surface (A3). Two routes behind `ai.manage`, both rendered by the existing
 * `features/ai` slice: the retrieval config editor and the search-analytics dashboard.
 *
 * **Why analytics carries both markers**, on the `MonetizationPage` precedent: the figures come from
 * request telemetry, so on a stack where no AF4 request has run the page deliberately renders an
 * empty state instead of a wall of zeroes. Either branch proves the read resolved; neither is
 * present while loading or on error, and which one is true depends on what else the suite has run.
 */
export interface RetrievalRoute {
  readonly key: string;
  readonly path: string;
  /** The page's `<h1>` (PageHeader owns the one document heading). */
  readonly heading: string;
  /** Nav label, for asserting the gate hides the entry as well as the route. */
  readonly navLabel: string;
  /** Text present once the read resolves WITH data. */
  readonly populatedMarker?: string;
  /** Text present once the read resolves with NO data — the honest empty state. */
  readonly emptyMarker?: string;
}

export const RETRIEVAL_ROUTES: readonly RetrievalRoute[] = [
  {
    key: 'search-config',
    path: '/ai-settings/search-config',
    heading: 'Retrieval config',
    navLabel: 'Retrieval config',
    // The config read always resolves: the service merges the settings row over compiled defaults,
    // and `syncDefinitions` guarantees the row exists — so this section is present on any install.
    populatedMarker: 'Ranking weights',
  },
  {
    key: 'search-analytics',
    path: '/ai-settings/search-analytics',
    heading: 'Search analytics',
    navLabel: 'Search analytics',
    populatedMarker: 'Zero-result rate',
    emptyMarker: 'No AI retrieval requests in this window',
  },
];

export class AiRetrievalPage {
  constructor(private readonly page: Page) {}

  /** Nav entries the `ai.manage` gate must hide from an operator who lacks the grant. */
  static readonly NAV_LABELS: readonly string[] = RETRIEVAL_ROUTES.map((route) => route.navLabel);

  static get config(): RetrievalRoute {
    return RETRIEVAL_ROUTES[0]!;
  }

  static get analytics(): RetrievalRoute {
    return RETRIEVAL_ROUTES[1]!;
  }

  /**
   * The config editor's four sections, each scoped by its own `data-testid`.
   *
   * Scoped rather than located page-wide because the sections repeat control shapes — nine weight
   * inputs that all read "<signal> weight", four switches that all read like a source name — and a
   * page-wide numeric locator would be ambiguous by construction. Same precedent as
   * `data-testid="credit-adjust-form"` (docs/e2e/05 §3).
   */
  get budgets(): Locator {
    return this.page.getByTestId('budgets');
  }

  get sources(): Locator {
    return this.page.getByTestId('sources');
  }

  get ranking(): Locator {
    return this.page.getByTestId('ranking');
  }

  get synthesis(): Locator {
    return this.page.getByTestId('synthesis');
  }

  /** The banner shown only when the server reports its aggregation was capped. */
  get truncationNotice(): Locator {
    return this.page.getByTestId('truncation-notice');
  }

  async goto(route: RetrievalRoute): Promise<void> {
    await this.page.goto(route.path);
    await expect(this.page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible({
      timeout: 30_000,
    });
  }

  /** Assert the route mounted and its read settled — into data or an honest empty state. */
  async expectRenders(route: RetrievalRoute): Promise<void> {
    await this.goto(route);

    const markers = [route.populatedMarker, route.emptyMarker].filter(
      (marker): marker is string => marker !== undefined,
    );
    let locator = this.page.getByText(markers[0]!, { exact: true }).first();
    for (const marker of markers.slice(1)) {
      locator = locator.or(this.page.getByText(marker, { exact: true }).first());
    }
    await expect(locator).toBeVisible();

    await this.expectNoErrorPanel();
  }

  /** Read a weight input's current value, scoped to the ranking section. */
  weight(signalLabel: string): Locator {
    return this.ranking.getByLabel(`${signalLabel} weight`);
  }

  /**
   * Pick a trailing window on the analytics dashboard.
   *
   * Through the shared keyboard helper, not a click: AntD renders the visible value as a
   * `<span class="ant-select-selection-item">` on top of the `role="combobox"` input, so clicking
   * the combobox is intercepted by the Select's own display span — which is what this spec did on
   * its first real run before the helper was adopted (docs/e2e/05 §5).
   */
  async selectWindow(label: string): Promise<void> {
    await selectAntdOption(
      this.page,
      this.page.getByRole('combobox', { name: 'Analytics window' }),
      label,
    );
  }

  /** The shared `QErrorState` panel every section on this surface uses on a failed read. */
  async expectNoErrorPanel(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  }
}
