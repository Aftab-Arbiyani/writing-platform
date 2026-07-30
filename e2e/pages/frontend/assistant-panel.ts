import { type Page, type Locator, expect } from '@playwright/test';

/**
 * The in-editor AI panel (W2/AF2, docs/45 §4.2) — the Writing Assistant + Craft Coach drawer.
 *
 * Selectors are role/label based per [05 §3]: the drawer is a dialog, the tabs are tabs, and
 * every action is a named button — no test-ids were needed.
 */
export class AssistantPanel {
  constructor(private readonly page: Page) {}

  /** The toggle in the editor header. */
  get trigger(): Locator {
    return this.page.getByRole('button', { name: 'AI assistant' });
  }

  get drawer(): Locator {
    return this.page.getByRole('dialog', { name: 'AI assistant' });
  }

  get assistantTab(): Locator {
    return this.page.getByRole('tab', { name: 'Assistant' });
  }

  get coachTab(): Locator {
    return this.page.getByRole('tab', { name: 'Craft Coach' });
  }

  /** The visible tabpanel. Both stay in the DOM; only one is not `hidden`. */
  get activePanel(): Locator {
    return this.drawer.getByRole('tabpanel').locator('visible=true');
  }

  async open(): Promise<void> {
    await this.trigger.click();
    await expect(this.drawer).toBeVisible({ timeout: 15_000 });
  }

  async close(): Promise<void> {
    // AntD's drawer close control is an icon button labelled "Close".
    await this.drawer.getByRole('button', { name: 'Close' }).click();
    await expect(this.drawer).toBeHidden();
  }

  /**
   * Assert the panel reports AI as unavailable rather than offering dead controls. This is the
   * TRUE contract while the AI feature flags are dark-launched (AF1 seeds them disabled and the
   * E2E stack configures no provider) — the surface must degrade to an explanation, never to a
   * broken editor.
   */
  async expectUnavailable(): Promise<void> {
    // Scoped to the ACTIVE tabpanel: AntD keeps both panels mounted, so an unscoped text lookup
    // matches the assistant's notice and the coach's at once.
    await expect(this.activePanel.getByText('AI is turned off')).toBeVisible({ timeout: 15_000 });
    await expect(this.activePanel.getByRole('button', { name: 'Rewrite' })).toHaveCount(0);
  }

  /** Select a tab and wait for it to actually become the active one. */
  async selectTab(tab: 'Assistant' | 'Craft Coach'): Promise<void> {
    const target = tab === 'Assistant' ? this.assistantTab : this.coachTab;
    await target.click();
    await expect(target).toHaveAttribute('aria-selected', 'true');
  }
}
