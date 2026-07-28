import { type Locator, type Page, expect } from '@playwright/test';

/**
 * A story's collaborators page (AF6 W3a, `features/collaboration` — route
 * `/write/:storyId/collaborators`). Roster + role badges, capability-gated management, presence, and
 * the story's outstanding invitations.
 *
 * Selectors are role/name-based throughout ([05 §1](../../../docs/e2e/05_Selectors.md)) — no testids
 * were needed here, which is itself the a11y assertion: every control carries a real accessible name.
 *
 * The invite dialog resolves a **handle** and sends a **user id** (docs/49 §2.1). Driving it through
 * the UI is what proves the resolution step works end to end — the half mobile never had.
 */
export class CollaboratorsPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Collaborators' });
  }
  private get inviteButton(): Locator {
    return this.page.getByRole('button', { name: 'Invite' });
  }
  private get handleInput(): Locator {
    return this.page.getByLabel('Handle');
  }
  private get sendButton(): Locator {
    return this.page.getByRole('button', { name: 'Send invitation' });
  }
  private get loadError(): Locator {
    return this.page.getByText('Couldn’t load the collaborators.', { exact: true });
  }
  private get disabledState(): Locator {
    return this.page.getByText('Collaboration is off', { exact: true });
  }

  async goto(storyId: string): Promise<void> {
    await this.page.goto(`/write/${storyId}/collaborators`);
    // Generous first-render wait for the Vite dev cold-compile of this lazy route (local only).
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /** The roster resolved to real data — never the skeleton, never the error panel. */
  async expectResolved(): Promise<void> {
    await expect(this.loadError).toHaveCount(0);
    await expect(this.disabledState).toHaveCount(0);
    // The owner is always synthesised into the roster, so at least one row must exist.
    await expect(this.page.getByRole('listitem').first()).toBeVisible();
  }

  /** The viewer's own row, which the page labels "You". */
  async expectSelfListed(): Promise<void> {
    await expect(this.page.getByText('You', { exact: true }).first()).toBeVisible();
  }

  async expectRoleBadge(label: string): Promise<void> {
    await expect(this.page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  /** The invite affordance is capability-gated, so its presence proves an `allow` was reflected. */
  async expectCanInvite(): Promise<void> {
    await expect(this.inviteButton).toBeVisible();
  }

  /**
   * Invite by handle: open the dialog, type the handle, wait for the resolved person to appear
   * (submit stays disabled until then), and send.
   *
   * The resolution is asserted on the **@username**, not the pen name: the username is what the
   * test supplied, whereas the pen name is whatever registration derived, so keying on it would
   * couple this page object to a backend default.
   */
  async invite(username: string): Promise<void> {
    await this.inviteButton.click();
    await expect(this.handleInput).toBeVisible();
    await this.handleInput.fill(`@${username}`);

    // The resolution confirmation — and the reason submit becomes enabled.
    await expect(this.page.getByText(`(@${username})`, { exact: false })).toBeVisible();
    await expect(this.sendButton).toBeEnabled();
    await this.sendButton.click();
    await expect(this.handleInput).toHaveCount(0);
  }

  async expectPendingInvitation(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Pending invitations' })).toBeVisible();
  }

  /** A handle nobody owns must say so and keep the send button disabled. */
  async expectHandleNotFound(handle: string): Promise<void> {
    await this.inviteButton.click();
    await this.handleInput.fill(handle);
    await expect(this.page.getByText('No writer with that handle.')).toBeVisible();
    await expect(this.sendButton).toBeDisabled();
  }
}
