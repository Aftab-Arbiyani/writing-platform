import { type Locator, type Page, expect } from '@playwright/test';

import { clickAntdMenuItem, selectAntdOption } from '../shared/antd';

/**
 * Admin → Moderation (`/reports`, docs/e2e app map). The report queue is an AntD table
 * with no title column; rows are identified only by their row-action button labelled
 * `Actions for report <8-char id>`. There are no literal approve/reject buttons — the
 * row menu's "Resolve…" opens a DecisionDialog whose Decision select chooses the
 * disposition ("Remove content" = takedown, "Dismiss report", "Hide content", …).
 */
export class ModerationPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Moderation' });
  }
  private rowActions(reportId: string): Locator {
    // Target by full-id testid: the button's aria-label is only an 8-char prefix, which
    // collides across time-ordered (UUIDv7) report ids created close together.
    return this.page.getByTestId(`report-actions-${reportId}`);
  }
  private get decisionDialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Resolve report' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/reports');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /** Assert the queue lists a given report (its row-action button is present). */
  async expectReportListed(reportId: string): Promise<void> {
    await expect(this.rowActions(reportId)).toBeVisible();
  }

  /**
   * Resolve a report with a decision (e.g. "Remove content", "Dismiss report"): open the
   * row menu → "Resolve…", choose the decision, apply, and wait for the success toast.
   */
  async resolve(reportId: string, decisionLabel: string): Promise<void> {
    await this.rowActions(reportId).click();
    await clickAntdMenuItem(this.page, 'Resolve…');
    const dialog = this.decisionDialog;
    await expect(dialog).toBeVisible();

    await selectAntdOption(
      this.page,
      dialog.getByRole('combobox', { name: 'Decision' }),
      decisionLabel,
    );

    await dialog.getByRole('button', { name: 'Apply decision' }).click();
    await expect(this.page.getByText('Report resolved.')).toBeVisible();
    await expect(dialog).toBeHidden();
  }
}
