import { type Locator, type Page, expect } from '@playwright/test';

/**
 * A story's publishing workflow (AF6 W3c — `/write/:storyId/publishing`).
 *
 * The page is four cards — review, publication, versions, history — and almost every control on it
 * is capability-gated, so a locator that resolves to nothing usually means the map denied the action
 * rather than that the selector is wrong. `expectResolved` separates those two failures.
 *
 * Selector discipline ([05 §2](../../../docs/e2e/05_Selectors.md)): accessible names match by
 * SUBSTRING, and this page has several overlapping ones — "Publish" is inside "Publishing" and
 * "Publish at", and "Revert" appears both as a row action and inside the confirm dialog. Every
 * lookup below is either `exact` or scoped to its card.
 */
export class StoryPublishingPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Publishing' });
  }

  /**
   * Each card is a landmark region named by its own heading.
   *
   * `exact: true` is load-bearing: accessible names match by SUBSTRING, and "Publication" is a
   * prefix of "Publication history", so the inexact lookup resolves to BOTH cards and Playwright
   * fails on strict mode. That is the same trap W3b hit twice ([05 §2]).
   */
  private card(name: string): Locator {
    return this.page.getByRole('region', { name, exact: true });
  }

  private get reviewCard(): Locator {
    return this.card('Review');
  }
  private get publicationCard(): Locator {
    return this.card('Publication');
  }
  private get versionsCard(): Locator {
    return this.card('Versions');
  }
  private get historyCard(): Locator {
    return this.card('Publication history');
  }

  async goto(storyId: string): Promise<void> {
    await this.page.goto(`/write/${storyId}/publishing`);
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /** The page loaded its data, rather than rendering the flag-off panel or a load error. */
  async expectResolved(): Promise<void> {
    await expect(this.page.getByText('Collaboration is off')).toHaveCount(0);
    await expect(this.page.getByText('Couldn’t load the review state.')).toHaveCount(0);
    await expect(this.reviewCard).toBeVisible();
  }

  /**
   * A story that has never been submitted shows **Draft**.
   *
   * This is the assertion that proves `GET …/review` answering `data: null` is read as a state and
   * not an error — the defect that made every story's default look broken on mobile (P-4).
   */
  async expectReviewState(label: string): Promise<void> {
    await expect(this.reviewCard.getByText(label, { exact: true })).toBeVisible();
  }

  async requestReview(): Promise<void> {
    await this.reviewCard.getByRole('button', { name: 'Request review', exact: true }).click();
    await this.expectReviewState('In review');
  }

  async approveReview(): Promise<void> {
    await this.approve();
    await this.expectReviewState('Approved');
  }

  /** Click Approve WITHOUT asserting the outcome — for the owner-403 defect test (W3c-1). */
  async approve(): Promise<void> {
    await this.reviewCard.getByRole('button', { name: 'Approve', exact: true }).click();
  }

  /** Opens the notes field and sends a decision — `notes`, the key the DTO declares (P-5). */
  async requestChanges(notes: string): Promise<void> {
    await this.reviewCard.getByRole('button', { name: 'Request changes', exact: true }).click();
    await this.page.getByLabel('What should change?').fill(notes);
    await this.page.getByRole('button', { name: 'Send decision', exact: true }).click();
    await this.expectReviewState('Changes requested');
  }

  /** Publish. Scoped + exact so it cannot match the h1 or the "Publish at" field. */
  async publish(): Promise<void> {
    await this.publicationCard.getByRole('button', { name: 'Publish', exact: true }).click();
  }

  async unpublish(): Promise<void> {
    await this.publicationCard.getByRole('button', { name: 'Unpublish', exact: true }).click();
  }

  async setVisibility(label: 'Private' | 'Unlisted' | 'Public'): Promise<void> {
    await this.publicationCard.getByRole('button', { name: label, exact: true }).click();
  }

  /** The publication card renders nothing at all unless `publication.publish` is allowed. */
  async expectPublicationControls(): Promise<void> {
    await expect(this.publicationCard).toBeVisible();
    await expect(
      this.publicationCard.getByRole('button', { name: 'Publish', exact: true }),
    ).toBeVisible();
  }

  async captureVersion(): Promise<void> {
    const before = await this.versionRows().count();
    await this.versionsCard.getByRole('button', { name: 'Capture version', exact: true }).click();
    await expect(this.versionRows()).toHaveCount(before + 1);
  }

  private versionRows(): Locator {
    return this.versionsCard.getByRole('listitem');
  }

  async expectVersionCount(count: number): Promise<void> {
    await expect(this.versionRows()).toHaveCount(count);
  }

  /**
   * Revert the newest version, through the confirm dialog.
   *
   * The dialog's own button is also named "Revert", so the row action is taken from the versions
   * card and the confirmation from the dialog — an unscoped lookup would be ambiguous.
   */
  async revertNewest(): Promise<void> {
    await this.versionRows().first().getByRole('button', { name: 'Revert', exact: true }).click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toContainText('Revert to version');
    await dialog.getByRole('button', { name: 'Revert', exact: true }).click();
  }

  /** History is append-only, so an entry can be asserted by its label. */
  async expectHistoryEntry(label: string): Promise<void> {
    await expect(this.historyCard.getByText(label, { exact: false }).first()).toBeVisible();
  }

  async expectToast(text: RegExp): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible();
  }

  /** The restricted wall replaces the whole workflow — the cards are gone, not merely disabled. */
  async expectRestrictedWall(headline: RegExp): Promise<void> {
    await expect(this.page.getByRole('heading', { name: headline })).toBeVisible();
    await expect(this.reviewCard).toHaveCount(0);
    await expect(this.publicationCard).toHaveCount(0);
  }
}
