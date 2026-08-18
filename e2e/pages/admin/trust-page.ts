import { type Locator, type Page, expect } from '@playwright/test';

import { UsersPage } from './users-page';

/**
 * The admin Trust & Safety surface (A2, docs/45 §5) — one panel, two entry points.
 *
 * `/trust` is gated by `RequirePermission(trust.view)` and takes a user id, so it is reachable by a
 * moderator, who cannot reach `/users` at all (that route carries `RequireRole min={Role.Admin}`).
 * The same panel is a tab on the user detail drawer for viewers who can. Both are driven from here
 * so a spec can assert they show the same thing.
 *
 * **Specs still arrange a THROWAWAY user per test and never touch a seeded account.** A strike can be
 * revoked as of B9 (`DELETE /admin/strikes/:id`), but a revoked strike stays on the record as history
 * and an auto-escalated restriction is permanent until lifted, so a strike issued against
 * `e2e_writer` would still change what every later run of the trust and collaboration specs sees.
 */
export const TRUST_ROUTE = '/trust' as const;
export const TRUST_HEADING = 'Trust & safety' as const;

/**
 * A well-formed UUID that matches no account.
 *
 * **It is now the NOT-FOUND fixture, not the empty-standing one.** Until B9 the standing read
 * manufactured a default profile for any id it was given (A2-4), so this id was how a spec got a
 * settled clean standing without arranging anything. The read writes nothing and 404s an id that
 * belongs to nobody now, so specs that want a clean standing create a real throwaway user, and this
 * constant exists to assert the 404.
 */
export const UNKNOWN_USER_ID = '00000000-0000-4000-8000-000000000000' as const;

export class TrustPage {
  constructor(private readonly page: Page) {}

  /** The panel itself — present under either entry point (`data-testid` on `TrustPanel`). */
  get panel(): Locator {
    return this.page.getByTestId('trust-panel');
  }

  private get userIdInput(): Locator {
    // An <input type="search"> reports role "searchbox"; getByLabel matches the aria-label either way.
    return this.page.getByLabel('User ID');
  }

  /** Open `/trust` at rest — no account selected. */
  async goto(): Promise<void> {
    await this.page.goto(TRUST_ROUTE);
    await expect(this.page.getByRole('heading', { level: 1, name: TRUST_HEADING })).toBeVisible({
      timeout: 30_000,
    });
  }

  /** Open `/trust` and load one account's standing. */
  async open(userId: string): Promise<void> {
    await this.goto();
    await this.userIdInput.fill(userId);
    await expect(this.panel).toBeVisible({ timeout: 15_000 });
    await this.expectStandingSettled();
  }

  /**
   * Wait for the standing read to resolve. "Standing" is the card's section heading, and it appears
   * only once the query settles — the loading state renders skeleton rows instead.
   */
  async expectStandingSettled(): Promise<void> {
    await expect(this.panel.getByRole('heading', { name: 'Standing' })).toBeVisible({
      timeout: 15_000,
    });
  }

  /**
   * Open `/trust` with an id and DO NOT wait for the standing — for the not-found case, where no
   * standing card ever arrives.
   */
  async openExpectingFailure(userId: string): Promise<void> {
    await this.goto();
    await this.userIdInput.fill(userId);
    await expect(this.panel).toBeVisible({ timeout: 15_000 });
  }

  /** The restriction rows still in force carry the clients' own word for it. */
  get inForceTags(): Locator {
    return this.panel.getByText('In force', { exact: true });
  }

  /**
   * The strike rows still contributing weight (B9, A2-2). "Counting" rather than "In force": what an
   * active strike does is contribute its weight, which is a different fact from a live restriction.
   */
  get countingTags(): Locator {
    return this.panel.getByText('Counting', { exact: true });
  }

  get revokedTags(): Locator {
    return this.panel.getByText('Revoked', { exact: true });
  }

  /**
   * The panel's sections, scoped by their HEADING rather than by a text substring.
   *
   * `filter({ hasText })` is a case-insensitive SUBSTRING match over a section's whole subtree, which
   * is far looser than it reads. `filter({ hasText: 'Apply a restriction' })` matched two sections,
   * because the strike form's own description says "…can apply a restriction automatically" — so
   * `getByLabel(/^Reason/)` inside it resolved to both `#strike-reason` and `#restriction-reason`.
   * A heading is the section's identity, and `getByRole('heading', { name })` matches the whole
   * accessible name, so each of these resolves to exactly one section.
   */
  private section(heading: string): Locator {
    return this.panel
      .locator('section')
      .filter({ has: this.page.getByRole('heading', { name: heading }) });
  }

  /** The standing card — the score, the trust status, and (since B9) the account-status badge. */
  get standingSection(): Locator {
    return this.section('Standing');
  }

  /** The restriction history list, which is NOT the restriction form below it. */
  get restrictionListSection(): Locator {
    return this.section('Restrictions');
  }

  private get strikeListSection(): Locator {
    return this.section('Strikes');
  }

  /** Revoke the first strike still counting, and hand back its confirmation (B9, A2-2). */
  async openRevokeConfirmation(): Promise<Locator> {
    await this.strikeListSection.getByRole('button', { name: 'Revoke' }).first().click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
  }

  /** Issue a strike: fill the reason, open the confirmation, and hand it back for assertions. */
  async openStrikeConfirmation(reason: string, severity?: string): Promise<Locator> {
    if (severity !== undefined) {
      await this.page.getByLabel('Severity').selectOption(severity);
    }
    // Both write forms carry a "Reason" field, so each is scoped to the section that owns it rather
    // than picked by document order.
    await this.strikeSection.getByLabel(/^Reason/).fill(reason);
    await this.panel.getByRole('button', { name: 'Issue strike' }).click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
  }

  /**
   * Apply a restriction. `endsOn` is an ISO date (`yyyy-mm-dd`); omitting it is what makes the
   * restriction PERMANENT, which is the difference the confirmation has to make unmissable.
   */
  async openRestrictionConfirmation(input: {
    type?: string;
    scope?: string;
    reason: string;
    endsOn?: string;
  }): Promise<Locator> {
    if (input.type !== undefined) {
      await this.page.getByLabel('Restriction').selectOption(input.type);
    }
    if (input.scope !== undefined) {
      await this.page.getByLabel('Applies to').selectOption(input.scope);
    }
    if (input.endsOn !== undefined) {
      await this.page.getByLabel(/Ends on/).fill(input.endsOn);
    }
    // Two "Reason" fields exist once both forms are on screen (strike + restriction); this is the
    // restriction form's, scoped by the section that owns the submit button.
    await this.restrictionSection.getByLabel(/^Reason/).fill(input.reason);
    await this.panel.getByRole('button', { name: 'Apply restriction' }).click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
  }

  private get strikeSection(): Locator {
    return this.section('Issue a strike');
  }

  private get restrictionSection(): Locator {
    return this.section('Apply a restriction');
  }

  /** Lift the first restriction still in force, and hand back its confirmation. */
  async openLiftConfirmation(): Promise<Locator> {
    await this.panel.getByRole('button', { name: 'Lift' }).first().click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
  }

  /** Confirm whichever dialog is open, then wait for it to close. */
  async confirm(dialog: Locator, name: RegExp | string): Promise<void> {
    await dialog.getByRole('button', { name }).click();
    await expect(dialog).toBeHidden();
  }

  // ── The drawer entry point ────────────────────────────────────────────────────

  /**
   * Open a user's detail drawer from `/users` and select its Trust tab.
   *
   * Delegates the grid half to {@link UsersPage} rather than re-implementing it. This method used to
   * fill the search box and click the row's action trigger on the next line, with no wait for the row
   * OR for the debounced search to commit — so it interacted with a table that had a pending refetch.
   * `UsersPage.searchFor` and `.openProfile` now own that sequence in one place, which is where the
   * waiting rules belong.
   */
  async openDrawerTab(username: string): Promise<void> {
    const users = new UsersPage(this.page);
    await users.goto();
    await users.searchFor(username);
    await users.openProfile(username);
    await this.page.getByRole('tab', { name: 'Trust' }).click();
    await expect(this.panel).toBeVisible();
  }

  /** The nav entry, for the RBAC assertions. */
  static readonly NAV_LABEL = 'Trust & safety';
}
