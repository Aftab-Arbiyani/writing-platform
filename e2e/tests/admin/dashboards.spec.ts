import { freshLogin } from '../../fixtures/auth';
import { test } from '../../fixtures/test';
import { ADMIN_DASHBOARDS, DashboardsPage } from '../../pages/admin/dashboards-page';

/**
 * Admin dashboards render (docs/e2e/06 Phase 4). The four read-only platform consoles —
 * Analytics (A8), Operations (P7.4), Security (P7.2), and System information (P7.1) — must
 * each mount and render real backend reads (KPI tiles) without an error panel. Charts are
 * canvas (ECharts), so we assert tile presence, not chart pixels (docs/e2e/05 §6). Runs as
 * the seeded super-admin; each dashboard is super-admin-gated.
 */
test.describe('@phase4 admin dashboards', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  for (const dashboard of ADMIN_DASHBOARDS) {
    test(`the ${dashboard.key} dashboard renders real data`, async ({ page }) => {
      const dashboards = new DashboardsPage(page);
      await dashboards.expectRenders(dashboard);
    });
  }
});
