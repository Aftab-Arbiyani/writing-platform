import { freshLogin, freshLoginAs } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { AssistantPanel } from '../../pages/frontend/assistant-panel';
import { BillingPage } from '../../pages/frontend/billing-page';
import { UsagePage } from '../../pages/frontend/billing-detail-pages';
import { PlansPage } from '../../pages/frontend/plans-page';
import { CollaboratorsPage } from '../../pages/frontend/collaborators-page';
import { ReaderPage } from '../../pages/frontend/reader-page';
import { SettingsBlocksPage } from '../../pages/frontend/settings-blocks-page';
import { StoryCommentsPage } from '../../pages/frontend/story-comments-page';
import { StoryPublishingPage } from '../../pages/frontend/story-publishing-page';
import { StorySuggestionsPage } from '../../pages/frontend/story-suggestions-page';
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

  test('the publishing page matches its visual baseline', async ({ page, api, data }) => {
    // AF6/W3c (docs/49 §5). Arranged with a review in flight and one version captured, so the four
    // cards are all in a populated state rather than empty — the review chip, the gated publication
    // controls, the version row and the history timeline are exactly the tinted, state-carrying
    // chrome that dark mode breaks ([10 §8.4]).
    const story = await api.createPiece({ title: data.pieceTitle() });
    const publishing = new StoryPublishingPage(page);
    await publishing.goto(story.id);
    await publishing.expectResolved();
    await publishing.requestReview();
    await publishing.captureVersion();
    await expect(page).toHaveScreenshot('frontend-story-publishing.png', {
      fullPage: true,
      // Height is deterministic — a fresh story, and every history/version row in the shot is one
      // this test caused. Content is not: each row carries a wall-clock timestamp, and the version
      // row a word count. Masking the lists keeps the layout and drops the churn.
      mask: [page.getByRole('listitem')],
    });
  });

  test('the safety settings page matches its visual baseline', async ({ page, api, data }) => {
    // AF6/W3c. A THROWAWAY blocker, for the reason the functional spec spells out: a block list is
    // cumulative and the writer is shared, so as the writer this baseline would encode however many
    // rows the database happened to hold and size-mismatch on the next run. Two rows, arranged here.
    const password = 'ChangeMe!VisualBlocker1';
    const blocker = await api.createVerifiedUser({
      email: `visual-blocker-${data.username()}@qalam.local`,
      username: data.username(),
      password,
    });
    const blockerToken = await api.loginToken(blocker.email, password);
    const blocked = await api.createVerifiedUser({
      email: `visual-blocked-${data.username()}@qalam.local`,
      username: data.username(),
      password: 'ChangeMe!VisualBlocked1',
    });
    const muted = await api.createVerifiedUser({
      email: `visual-muted-${data.username()}@qalam.local`,
      username: data.username(),
      password: 'ChangeMe!VisualMuted1',
    });
    await api.blockUser(blocked.id, blockerToken);
    await api.muteUser(muted.id, blockerToken);

    await freshLoginAs(page, blocker.email, password);
    const blocks = new SettingsBlocksPage(page);
    await blocks.goto();
    await blocks.expectResolved();
    await expect(page).toHaveScreenshot('frontend-settings-blocks.png', {
      fullPage: true,
      // The rows name generated users and the standing row is the one thing worth pinning by colour
      // — it renders `QTag color="success"` again now the token is fixed (docs/48 §3.5), so this
      // baseline is where that re-tint is actually reviewed.
      mask: [page.getByRole('listitem')],
    });
  });

  test('the comments page matches its visual baseline', async ({ page, api, data }) => {
    // AF6/W3b. One comment, so the thread card renders rather than the empty state.
    const story = await api.createPiece({ title: data.pieceTitle() });
    const comments = new StoryCommentsPage(page);
    await comments.goto(story.id);
    await comments.expectResolved();
    await comments.addComment(`Visual baseline comment ${data.username()}`);
    await expect(page).toHaveScreenshot('frontend-comments.png', {
      fullPage: true,
      // The card carries a relative timestamp and a truncated author id (`CommentDto` sends no
      // display name — docs/48 §3.2 M-3), both environment-dependent.
      mask: [page.getByRole('listitem')],
    });
  });

  test('the suggestions page matches its visual baseline', async ({ page, api, data }) => {
    // AF6/W3b. A proposed edit, so the diff lines and the anchor label are in the shot — the
    // strikethrough/replacement pair is the part whose colours have to survive both themes.
    const story = await api.createPiece({
      title: data.pieceTitle(),
      body: 'The lantern burned low over the water.',
    });
    const suggestions = new StorySuggestionsPage(page);
    await suggestions.goto(story.id);
    await suggestions.expectResolved();
    await suggestions.propose({ original: 'lantern', suggested: 'oil lamp', from: 4 });
    await expect(page).toHaveScreenshot('frontend-suggestions.png', {
      fullPage: true,
      mask: [page.getByRole('listitem')],
    });
  });

  test('the plan comparison matches its visual baseline', async ({ page }) => {
    // AF5/W4. The feature's most colour-dependent surface: the "Current plan" accent tag, the ✓ marks in
    // `text-success`, the selected state of the interval radiogroup, and one primary button per card.
    // Every one of those is a tinted token, which is the class [10 §8.4] exists for — and dark mode is
    // where the tint maths differs most, which the `frontend-dark` project covers from this same spec.
    //
    // Prices come from the pricing config rather than test data, so the content is stable across runs
    // and nothing needs masking.
    const plans = new PlansPage(page);
    await plans.goto();
    await plans.expectResolved();
    await expect(page).toHaveScreenshot('frontend-billing-plans.png', { fullPage: true });
  });

  test('the billing hub matches its visual baseline', async ({ page }) => {
    // Snapshotted in the FREE state, which is what the seeded writer is in and what most viewers see.
    // Its four hub cards are the only two-line link rows in the app, so their spacing and hover
    // treatment are worth pinning.
    const billing = new BillingPage(page);
    await billing.goto();
    await billing.expectResolved();
    await expect(page).toHaveScreenshot('frontend-billing.png', { fullPage: true });
  });

  test('the AI usage dashboard matches its visual baseline', async ({ page }) => {
    // AF5/W4. The allowance bars are the feature's only progress indicators and they change fill colour
    // on exhaustion (`bg-accent` → `bg-danger`), so this baseline is where that pair is reviewed in both
    // themes.
    //
    // The numbers are the seeded writer's real usage and DO move as the AI specs run, so the window
    // cards are masked — their layout is the subject, not their counts.
    const usage = new UsagePage(page);
    await usage.goto();
    await usage.expectResolved();
    await expect(page).toHaveScreenshot('frontend-billing-usage.png', {
      fullPage: true,
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
