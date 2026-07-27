import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { FeedPage } from '../../pages/frontend/feed-page';
import { ReaderPage } from '../../pages/frontend/reader-page';

/**
 * The reading view (W1, docs/45 §4.1) — `/p/:slug`.
 *
 * This spec **discharges the deferral** carried since Phase 2: feed and search could only assert
 * that a card *linked* to `/p/:slug`, because nothing was routed there (docs/e2e/06 §2.1, §4).
 * The link→render half is now asserted end to end.
 *
 * It also covers the contract B1 exists for: a cold load straight to a slug URL, with no
 * in-app navigation to supply an id — the case a shared link, a search hit, or a notification
 * deep link produces.
 */
test.describe('@phase2 frontend reader', () => {
  test('a published piece is readable by its slug on a cold load (anonymous)', async ({
    page,
    api,
    data,
  }) => {
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });
    expect(piece.slug, 'publishing must mint a slug').toBeTruthy();

    // No login: reading is public, and the cold load exercises GET /pieces/by-slug/:slug.
    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);
  });

  test('the feed links through to a rendered piece (the deferred half of Phase 2)', async ({
    page,
    api,
    data,
  }) => {
    await freshLogin(page, 'writer');
    const title = data.pieceTitle();
    await api.createPublishedPiece({ title });

    const feed = new FeedPage(page);
    await feed.gotoLatest();
    await feed.expectLoaded();
    await feed.openPiece(title);

    await expect(page).toHaveURL(/\/p\//);
    await new ReaderPage(page).expectRendered(title);
  });

  test('the reader shows the author and the engagement bar', async ({ page, api, data }) => {
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    // The engagement summary is public — an anonymous reader still sees real counts.
    await expect(reader.engagement).toBeVisible({ timeout: 30_000 });
    await reader.expectAuthorLink('e2e_writer');
  });

  test('an unknown slug renders the not-found state, not a crash', async ({ page, data }) => {
    const reader = new ReaderPage(page);
    await reader.gotoSlug(`no-such-piece-${data.pieceTitle().toLowerCase().replace(/\s+/g, '-')}`);
    await reader.expectNotFound();
  });

  test('reader typography is adjustable and survives a reload', async ({ page, api, data }) => {
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    const before = await reader.proseFontSize();
    await reader.setTextSize('L');
    await expect(async () => {
      expect(await reader.proseFontSize()).not.toBe(before);
    }).toPass({ timeout: 5_000 });
    const enlarged = await reader.proseFontSize();

    // The preference is device-scoped and persisted, so a cold reload keeps it.
    await page.reload();
    await reader.expectRendered(title);
    expect(await reader.proseFontSize()).toBe(enlarged);
  });

  test('an anonymous reader is sent to sign-in before a like is written', async ({
    page,
    api,
    data,
  }) => {
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    await expect(reader.likeButton).toBeVisible({ timeout: 30_000 });
    await reader.likeButton.click();

    // Sharing is public, but liking is not — the reader lands on sign-in carrying this piece.
    await expect(page).toHaveURL(/\/auth\/login\?returnTo=/);
  });

  test('a signed-in reader can like the piece and the count sticks', async ({
    page,
    api,
    data,
  }) => {
    await freshLogin(page, 'writer');
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    const like = reader.likeButton;
    await expect(like).toBeVisible({ timeout: 30_000 });
    await expect(like).toHaveAttribute('aria-pressed', 'false');

    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');

    // It was really written, not just optimistically painted — a reload re-reads the server.
    await page.reload();
    await reader.expectRendered(title);
    await expect(reader.likeButton).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 });
  });
});
