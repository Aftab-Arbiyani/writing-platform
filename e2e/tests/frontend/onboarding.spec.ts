import { expect, test } from '../../fixtures/test';

/**
 * The first-run intro (docs/48 §2 row 7) — a port of mobile's onboarding carousel.
 *
 * **Every test here runs in a genuinely anonymous context, and that is not a formality.** The
 * frontend projects carry the writer's `storageState`, so a default context boots authenticated and
 * `HomeRoute` sends it to `/feed` — the intro would never render and each test would pass while
 * asserting nothing. `storageState: { cookies: [], origins: [] }` is the suite's existing idiom for
 * this (`keyboard.spec.ts`, `engagement.spec.ts`), and RS-flake is the recorded cost of omitting it:
 * `browser.newContext()` inherits the project's storageState silently (docs/48, twelfth
 * reconciliation).
 *
 * The intro is gated on a **`localStorage` flag**, not a cookie, so an empty `origins` array is what
 * makes each test a true first visit.
 */
test.describe('@phase4 frontend first-run intro', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a first-time visitor at the root is shown the intro, and can walk it to sign-in', async ({
    page,
  }) => {
    await page.goto('/');

    // Redirected off `/` — the intro is its own route, with no app chrome.
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { name: 'A place for your words' })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Read and write, beautifully' })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Your words, your control' })).toBeVisible();

    // The label change IS the end-of-carousel signal (the dots are aria-hidden).
    await page.getByRole('button', { name: 'Get started' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('it is shown ONCE — completing it survives a reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);

    // The durable half. A flag that did not persist would put the intro in front of the reader on
    // every single visit, which is the one failure that would make it feel broken.
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/onboarding$/);
  });

  test('a shared piece link is NEVER hijacked by the intro', async ({ page, api, data }) => {
    // The defect an earlier draft of this feature had: gating the whole chrome tree meant a
    // first-time visitor opening a shared story got three slides instead of the story. Web is
    // entered at an arbitrary URL, so only the ROOT may redirect.
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });

    await page.goto(`/p/${piece.slug as string}`);
    await expect(page).not.toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title, { timeout: 30_000 });
  });
});
