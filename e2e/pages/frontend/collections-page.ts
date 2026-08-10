import { type Page, type Locator, expect } from '@playwright/test';

/**
 * The reader's collections (W7b, docs/45 §4.4) — `/me/collections` and
 * `/me/collections/:collectionId`, the same paths mobile uses.
 *
 * Owner-only: every collections route is permission-gated and caller-scoped, so both surfaces sit
 * inside `RequireAuth` and a signed-out visit bounces to sign-in.
 */
export class CollectionsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/me/collections');
  }

  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Your collections' });
  }

  get createButton(): Locator {
    return this.page.getByRole('button', { name: 'New collection' }).first();
  }

  /** A collection's link in the list. Also the assertion that it reached the server. */
  card(title: string): Locator {
    return this.page.getByRole('link', { name: title });
  }

  actionsFor(title: string): Locator {
    return this.page.getByRole('button', { name: `Actions for ${title}` });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByLabel('Loading your collections')).toHaveCount(0, {
      timeout: 30_000,
    });
  }

  /** Create a collection through the form dialog and wait for it to appear in the list. */
  async create(title: string): Promise<void> {
    await this.createButton.click();
    const dialog = this.page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(title);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(this.card(title)).toBeVisible({ timeout: 30_000 });
  }

  async rename(from: string, to: string): Promise<void> {
    await this.actionsFor(from).click();
    await this.page.getByText('Rename').click();
    const dialog = this.page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(to);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(this.card(to)).toBeVisible({ timeout: 30_000 });
  }

  /** Delete a collection, confirming. The confirmation must say the pieces survive. */
  async remove(title: string): Promise<void> {
    await this.actionsFor(title).click();
    await this.page.getByText('Delete').click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toContainText(/the pieces in it stay where they are/i);
    await dialog.getByRole('button', { name: /^Delete$/ }).click();
    await expect(this.card(title)).toHaveCount(0, { timeout: 30_000 });
  }
}

/** One collection's pieces. */
export class CollectionDetailPage {
  constructor(private readonly page: Page) {}

  async goto(collectionId: string): Promise<void> {
    await this.page.goto(`/me/collections/${collectionId}`);
  }

  heading(title: string): Locator {
    return this.page.getByRole('heading', { level: 1, name: title });
  }

  piece(title: string): Locator {
    return this.page.getByRole('link', { name: title });
  }

  removeButtonFor(title: string): Locator {
    return this.page.getByRole('button', { name: `Remove ${title} from this collection` });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page.getByLabel('Loading the collection')).toHaveCount(0, {
      timeout: 30_000,
    });
  }

  /**
   * Un-file a piece, confirming. The confirmation has to say the piece itself survives — "remove"
   * beside someone's writing is otherwise ambiguous, and that ambiguity is the risk of the action.
   */
  async removePiece(title: string): Promise<void> {
    await this.removeButtonFor(title).click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toContainText(/the piece itself stays published and unchanged/i);
    await dialog.getByRole('button', { name: /^Remove$/ }).click();
    await expect(this.piece(title)).toHaveCount(0, { timeout: 30_000 });
  }
}
