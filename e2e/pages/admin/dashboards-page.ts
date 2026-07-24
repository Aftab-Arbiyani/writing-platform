import { type Page, expect } from '@playwright/test';

/**
 * Admin read-only dashboards (docs/e2e/06 Phase 4). Each of the four platform consoles is a
 * page-header `<h1>` plus several independent backend reads rendered as KPI tiles / tables.
 * Charts are drawn to `<canvas>` (ECharts), so their pixels are not assertable from the DOM
 * (docs/e2e/05 §6 canvas caveat) — instead each dashboard is proven "rendered real data" by a
 * KPI tile that only mounts once its query resolves, together with the absence of the section
 * error panel. That pair distinguishes a loaded dashboard from both the skeleton and an error.
 *
 * Every dashboard is super-admin-gated; specs run as the seeded admin.
 */
export interface AdminDashboard {
  /** Human key for the spec title. */
  readonly key: string;
  /** Route to visit. */
  readonly path: string;
  /** The page's `<h1>` text (PageHeader owns the one document heading). */
  readonly heading: string;
  /** A KPI-tile label that renders ONLY after that dashboard's read resolves. */
  readonly readyMarker: string;
}

/**
 * The four Phase-4 dashboards and their real routes:
 *  - Analytics (A8, platform-wide)                 → `/analytics`
 *  - Operations (P7.4, reliability console home)   → `/operations`
 *  - Security (P7.2, posture + keys)               → `/system/security`
 *  - System information (P7.1, deployment identity) → `/system`
 */
export const ADMIN_DASHBOARDS: readonly AdminDashboard[] = [
  { key: 'analytics', path: '/analytics', heading: 'Analytics', readyMarker: 'Total users' },
  { key: 'operations', path: '/operations', heading: 'Operations', readyMarker: 'Readiness' },
  {
    key: 'security',
    path: '/system/security',
    heading: 'Security dashboard',
    readyMarker: 'Max attempts',
  },
  { key: 'system', path: '/system', heading: 'System information', readyMarker: 'Service' },
];

export class DashboardsPage {
  constructor(private readonly page: Page) {}

  /**
   * Visit a dashboard and assert it rendered real data: the heading mounts, a KPI tile that
   * only appears once the read resolves is visible, and neither error panel is present. The
   * shared `QErrorState` panel renders "Something went wrong." (Operations/Security/System);
   * the Analytics sections use their own "Couldn't load analytics" empty-error — both are
   * asserted absent so a failed read can't masquerade as a rendered dashboard.
   */
  async expectRenders(dashboard: AdminDashboard): Promise<void> {
    await this.page.goto(dashboard.path);
    await expect(this.page.getByRole('heading', { level: 1, name: dashboard.heading })).toBeVisible(
      { timeout: 30_000 },
    );

    await expect(this.page.getByText(dashboard.readyMarker, { exact: true }).first()).toBeVisible();

    await expect(
      this.page.getByRole('heading', { level: 3, name: 'Something went wrong.' }),
    ).toHaveCount(0);
    await expect(this.page.getByText(/Couldn.t load analytics/)).toHaveCount(0);
  }
}
