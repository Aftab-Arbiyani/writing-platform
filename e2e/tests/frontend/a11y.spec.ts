import { expectNoSeriousA11yViolations } from '../../fixtures/a11y';
import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { EditorPage } from '../../pages/frontend/editor-page';
import { FeedPage } from '../../pages/frontend/feed-page';
import { ProfilePage } from '../../pages/frontend/profile-page';
import { ReaderPage } from '../../pages/frontend/reader-page';
import { ResiliencePage } from '../../pages/frontend/resilience-page';
import { EditProfilePage } from '../../pages/frontend/settings-page';
import { LoginPage } from '../../pages/shared/login-page';

/**
 * Frontend accessibility (docs/e2e/06 Phase 5, [10 §4]). Axe (WCAG 2.0/2.1 A + AA) scans the
 * curated high-value pages ([10 §2.3]) once each has reached a stable, data-loaded state, and
 * gates on **critical + serious** violations only. This catches the defect class role/label
 * selectors are blind to — unlabeled controls, bad contrast, missing landmarks.
 *
 * The two unauthenticated corridors (login, register) opt out of the shared session; the rest
 * scan as the seeded writer.
 */
test.describe('@phase5 @a11y frontend accessibility (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page has no critical/serious a11y violations', async ({ page }) => {
    await new LoginPage(page, { loginPath: '/auth/login', rememberLabel: 'Remember me' }).goto();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /auth/login' });
  });

  test('register page has no critical/serious a11y violations', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByLabel('Email').waitFor();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /auth/register' });
  });
});

test.describe('@phase5 @a11y frontend accessibility (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('the feed has no critical/serious a11y violations', async ({ page, api, data }) => {
    // Arrange a piece so the feed renders content, not just its empty state.
    await api.createPublishedPiece({ title: data.pieceTitle() });
    const feed = new FeedPage(page);
    await feed.gotoLatest();
    await feed.expectLoaded();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /feed' });
  });

  test('the editor has no critical/serious a11y violations', async ({ page }) => {
    const editor = new EditorPage(page);
    await editor.goto();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /write' });
  });

  test('the profile has no critical/serious a11y violations', async ({ page }) => {
    const profile = new ProfilePage(page);
    await profile.gotoOwn();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /me' });
  });

  test('the settings page has no critical/serious a11y violations', async ({ page }) => {
    const settings = new EditProfilePage(page);
    await settings.goto();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /settings/profile' });
  });

  test('the reader has no critical/serious a11y violations', async ({ page, api, data }) => {
    // The reading view (W1, docs/45 §4.1) is the product's highest-traffic surface and the one
    // most dependent on typography and contrast — exactly what axe catches and selectors don't.
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });
    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);
    // Scan with the engagement bar present, not just the article.
    await expect(reader.engagement).toBeVisible({ timeout: 30_000 });
    await expectNoSeriousA11yViolations(page, { label: 'frontend /p/:slug' });
  });

  test('the not-found page has no critical/serious a11y violations', async ({ page, data }) => {
    // The curated error/empty surface ([10 §2.3]).
    const resilience = new ResiliencePage(page);
    await resilience.gotoUnknownAndExpectNotFound(`/no-such-route-${data.username()}`);
    await expectNoSeriousA11yViolations(page, { label: 'frontend not-found' });
  });
});
