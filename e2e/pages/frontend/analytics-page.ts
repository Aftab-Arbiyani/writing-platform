import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Writer Analytics dashboard (docs/e2e/06 Phase 4, `features/analytics` — route `/me/stats`).
 * All numbers are real `/analytics/dashboard` aggregates (docs mobile `m9`: lifetime-only). The
 * page resolves to ONE of two real-data states — never the skeleton or the error panel:
 *   • populated — the overview KPI cards (a writer with published work), or
 *   • the "no published pieces" empty state (a writer with nothing published).
 * Either one proves the read succeeded and rendered; the load-error panel must be absent.
 */
export class WriterStatsPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Your stats' });
  }
  private get overviewKpi(): Locator {
    // A MetricCard label from OverviewCards — only rendered once real aggregates arrive.
    return this.page.getByText('Total views', { exact: true });
  }
  private get emptyState(): Locator {
    // NoPublishedPieces — the docs empty state for a writer with nothing published.
    return this.page.getByText('Numbers need words first.', { exact: true });
  }
  private get loadError(): Locator {
    return this.page.getByText("Couldn't load your analytics.", { exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/me/stats');
    // Generous first-render wait for the Vite dev cold-compile of this lazy route (local only).
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /** Assert the dashboard resolved to a real-data state (populated OR empty), never an error. */
  async expectResolved(): Promise<void> {
    await expect(this.overviewKpi.or(this.emptyState)).toBeVisible();
    await expect(this.loadError).toHaveCount(0);
  }
}
