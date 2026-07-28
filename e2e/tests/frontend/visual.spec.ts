import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { AssistantPanel } from '../../pages/frontend/assistant-panel';
import { CollaboratorsPage } from '../../pages/frontend/collaborators-page';
import { ReaderPage } from '../../pages/frontend/reader-page';
import { LoginPage } from '../../pages/shared/login-page';

/**
 * Frontend visual regression (docs/e2e/06 Phase 5, [10 §2]). `toHaveScreenshot` diffs each curated
 * page against a committed per-engine baseline; drift beyond threshold fails. Config centralizes the
 * defaults (animations disabled, caret hidden, small pixel-ratio budget — playwright.config `expect`).
 *
 * Dynamic regions are MASKED so content churn never reddens a run ([10 §2.2]): the feed's piece list,
 * the editor's autosave clock, avatars. Static corridors (login, register, not-found) snapshot whole.
 *
 * Baselines are produced in ONE controlled environment — the pinned Playwright Docker image
 * (`mcr.microsoft.com/playwright:vX`) — never on a dev machine ([10 §2.2, §5]); see e2e/pages/README.
 */
test.describe('@phase5 @visual frontend (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page matches its visual baseline', async ({ page }) => {
    await new LoginPage(page, { loginPath: '/auth/login', rememberLabel: 'Remember me' }).goto();
    await expect(page).toHaveScreenshot('frontend-login.png', { fullPage: true });
  });

  test('register page matches its visual baseline', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByLabel('Email').waitFor();
    await expect(page).toHaveScreenshot('frontend-register.png', { fullPage: true });
  });

  test('not-found page matches its visual baseline', async ({ page }) => {
    await page.goto('/no-such-route-visual-baseline');
    await page.getByText('This page has wandered off.').waitFor();
    await expect(page).toHaveScreenshot('frontend-not-found.png', { fullPage: true });
  });
});

test.describe('@phase5 @visual frontend (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('the editor matches its visual baseline', async ({ page }) => {
    await page.goto('/write');
    await expect(page.getByLabel('Title')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveScreenshot('frontend-editor.png', {
      fullPage: true,
      // The autosave indicator shows a wall-clock time ("Saved · HH:MM") — volatile.
      mask: [page.getByRole('status')],
    });
  });

  test('the AI assistant panel matches its visual baseline', async ({ page }) => {
    // W2/AF2. Viewport, not fullPage: the drawer is fixed to the viewport and the editor behind
    // it is empty here, so a full-page shot would add nothing but height.
    await page.goto('/write');
    await expect(page.getByLabel('Title')).toBeVisible({ timeout: 30_000 });
    await new AssistantPanel(page).open();
    await expect(page).toHaveScreenshot('frontend-ai-panel.png');
  });

  test('the settings profile page matches its visual baseline', async ({ page }) => {
    await page.goto('/settings/profile');
    await expect(page.getByLabel('Pen name')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveScreenshot('frontend-settings.png', {
      fullPage: true,
      // Avatar/cover imagery is account data, not layout.
      mask: [page.locator('img')],
    });
  });

  test('the reader matches its visual baseline', async ({ page, api, data }) => {
    // The reading view (W1, docs/45 §4.1). Snapshotted whole: unlike the feed, its height is
    // determined by ONE piece of fixed, spec-arranged content, so the shot is stable across runs.
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });
    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);
    // Wait for the second wave so the bar is in the shot rather than racing it.
    await expect(reader.engagement).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveScreenshot('frontend-reader.png', {
      fullPage: true,
      // The title carries a per-run unique token, and engagement counts move as other specs
      // publish and react — both are content, not layout.
      mask: [page.getByRole('heading', { level: 1 }), reader.engagement],
    });
  });

  test('the collaborators page matches its visual baseline', async ({ page, api, data }) => {
    // AF6/W3a (docs/49). Snapshotted so the roster's role badges, presence dots, and gated controls
    // are pinned in BOTH themes — the badge/dot colours are the parts most likely to be unreadable
    // in dark, which is the failure mode [10 §8.4] was written about.
    const story = await api.createPiece({ title: data.pieceTitle() });
    const collaborators = new CollaboratorsPage(page);
    await collaborators.goto(story.id);
    await collaborators.expectResolved();
    await expect(page).toHaveScreenshot('frontend-collaborators.png', {
      fullPage: true,
      // The owner row renders a truncated user id (no by-id profile lookup exists — docs/49 §5),
      // and that id differs per environment.
      mask: [page.getByRole('listitem')],
    });
  });

  test('the feed chrome matches its visual baseline', async ({ page, api, data }) => {
    await api.createPublishedPiece({ title: data.pieceTitle() });
    await page.goto('/feed?tab=latest');
    const list = page.getByRole('region', { name: 'Latest feed' });
    await expect(list).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveScreenshot('frontend-feed.png', {
      // Viewport, NOT fullPage: masking hides the cards' content but not their height, so a
      // full-page shot encodes how many pieces happen to exist — and this spec publishes one
      // more on every run. The baseline would then differ in *size* from a fresh CI database and
      // fail before comparing a single pixel. The chrome this guards (top bar, tabs, filter bar,
      // rail) is all above the fold ([10 §2.2]).
      mask: [list],
    });
  });
});
