import { expectNoSeriousA11yViolations } from '../../fixtures/a11y';
import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { EditorPage } from '../../pages/frontend/editor-page';
import { FeedPage } from '../../pages/frontend/feed-page';
import { AssistantPanel } from '../../pages/frontend/assistant-panel';
import { CollaboratorsPage } from '../../pages/frontend/collaborators-page';
import { InvitationsPage } from '../../pages/frontend/invitations-page';
import { StoryCommentsPage } from '../../pages/frontend/story-comments-page';
import { StorySuggestionsPage } from '../../pages/frontend/story-suggestions-page';
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

  test('the AI assistant panel has no critical/serious a11y violations', async ({ page }) => {
    // A drawer full of radio groups, tabs and a live region (W2, docs/45 §4.2) — the densest
    // interactive surface in the editor, and the one axe is most likely to have something to say
    // about. Scanned open, over the editor it overlays.
    const editor = new EditorPage(page);
    await editor.goto();
    await new AssistantPanel(page).open();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /write + AI panel' });
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

  test('the collaborators page has no critical/serious a11y violations', async ({
    page,
    api,
    data,
  }) => {
    // AF6/W3a (docs/49). Worth scanning because the roster is dense with controls whose names must
    // disambiguate one row from another — a per-row select labelled only "Role" would pass a
    // selector test that scopes by row, and still leave a screen reader unable to tell them apart.
    const story = await api.createPiece({ title: data.pieceTitle() });
    const collaborators = new CollaboratorsPage(page);
    await collaborators.goto(story.id);
    await collaborators.expectResolved();
    await expectNoSeriousA11yViolations(page, {
      label: 'frontend /write/:storyId/collaborators',
    });
  });

  test('the invitations inbox has no critical/serious a11y violations', async ({ page }) => {
    // Runs as the shared writer, who normally has no invitations — the empty state is the surface
    // most viewers see, so it is the one that must be clean.
    const inbox = new InvitationsPage(page);
    await inbox.goto();
    await inbox.expectResolved();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /me/invitations' });
  });

  test('the comments page has no critical/serious a11y violations', async ({ page, api, data }) => {
    // W3b. The thread controls are toggles (`aria-expanded`) and the filter bar is a pressed-state
    // group — both are states axe checks and a functional spec cannot see.
    const story = await api.createPiece({ title: data.pieceTitle() });
    const comments = new StoryCommentsPage(page);
    await comments.goto(story.id);
    await comments.addComment(`A11y comment ${data.username()}`);
    await expectNoSeriousA11yViolations(page, { label: 'frontend /write/:storyId/comments' });
  });

  test('the suggestions page has no critical/serious a11y violations', async ({
    page,
    api,
    data,
  }) => {
    // W3b, scanned with the composer OPEN: it carries the only numeric input in the feature, and a
    // number field without a real label is exactly what axe is for.
    const story = await api.createPiece({ title: data.pieceTitle(), body: 'The lantern burned.' });
    const suggestions = new StorySuggestionsPage(page);
    await suggestions.goto(story.id);
    await suggestions.propose({ original: 'lantern', suggested: 'oil lamp', from: 4 });
    await expectNoSeriousA11yViolations(page, { label: 'frontend /write/:storyId/suggestions' });
  });

  test('the not-found page has no critical/serious a11y violations', async ({ page, data }) => {
    // The curated error/empty surface ([10 §2.3]).
    const resilience = new ResiliencePage(page);
    await resilience.gotoUnknownAndExpectNotFound(`/no-such-route-${data.username()}`);
    await expectNoSeriousA11yViolations(page, { label: 'frontend not-found' });
  });
});
