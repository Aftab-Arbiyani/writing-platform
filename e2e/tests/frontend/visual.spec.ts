import type { Page } from '@playwright/test';

import { freshLogin, freshLoginAs } from '../../fixtures/auth';
import { AI_FLAG_TEST_TIMEOUT_MS, withAiFlags } from '../../fixtures/feature-flags';
import { test, expect } from '../../fixtures/test';
import { AssistantPanel } from '../../pages/frontend/assistant-panel';
import { BillingPage } from '../../pages/frontend/billing-page';
import { UsagePage } from '../../pages/frontend/billing-detail-pages';
import { AiConversationsPage, AiUsagePage, PromptLibraryPage } from '../../pages/frontend/ai-pages';
import { PlansPage } from '../../pages/frontend/plans-page';
import { CollaboratorsPage } from '../../pages/frontend/collaborators-page';
import { ReaderPage } from '../../pages/frontend/reader-page';
import { SearchPage } from '../../pages/frontend/search-page';
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
/**
 * Wait for every transient toast to auto-dismiss before snapshotting.
 *
 * Toasts are AntD `notification` (docs/07 §7.9), which closes on a TIMER — so a screenshot taken
 * straight after a mutating action captures however many happen still to be on screen. That is a
 * race, and it is not hypothetical: story-publishing drifted 2.25% between two mints of the same
 * commit (over the 2% gate) purely because one run still had both "Review requested." and "Snapshot
 * captured." up while the next had only one. No baseline here is guarding toasts — every one of them
 * is guarding the surface underneath.
 */
async function settleToasts(page: Page): Promise<void> {
  await expect(page.locator('.ant-notification-notice')).toHaveCount(0, { timeout: 15_000 });
}

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
    //
    // **Under the AI feature-flag lock, which is new in W5.** These four baselines contain the
    // panel's flag-DOWN "AI is turned off" state, and that is a property of the seeded flags rather
    // than of this test — [06 §6] note (a) records the consequence: a local whole-suite run that
    // mixed @visual with the one flag-raising test could produce a spurious diff. W5 adds three more
    // flag-raising tests, so "rare race" became "likely"; holding the lock makes the state this
    // baseline was minted in true for the duration instead of merely usual.
    // Queues on the AI feature-flag lock, and that wait counts against this test's budget.
    test.setTimeout(AI_FLAG_TEST_TIMEOUT_MS);
    await withAiFlags('visual: AI panel (flags down)', async () => {
      await page.goto('/write');
      await expect(page.getByLabel('Title')).toBeVisible({ timeout: 30_000 });
      await new AssistantPanel(page).open();
      await expect(page).toHaveScreenshot('frontend-ai-panel.png');
    });
  });

  /**
   * The AF4 search surface in the state every deployment ships in (W5, docs/45 §4).
   *
   * **Why the refusal and not a result set.** The populated AI panel is the wrong visual subject: its
   * content is a live ranking over whatever the database holds — candidate counts, scores, other
   * specs' pieces — so every run would differ in content and in height, and masking enough to stabilise
   * it would leave nothing but the toggle. The same reasoning already governs `frontend-ai-panel`,
   * which is deliberately a flag-down baseline ([06 §6]). What IS deterministic and worth pinning here
   * is the chrome W5 added plus the notice behind it: the engine switch with `AI search` pressed, and
   * the "AI is turned off" empty state that every un-flagged reader meets.
   *
   * The query is a fixed string, not `data.pieceTitle()` — a per-run token changes the field's
   * rendered width and, on a marginal page height, its wrap point (the reader/comments/suggestions
   * baselines all drifted that way).
   */
  test('the AI search refusal matches its visual baseline', async ({ page }) => {
    // Queues on the AI feature-flag lock, and that wait counts against this test's budget.
    test.setTimeout(AI_FLAG_TEST_TIMEOUT_MS);
    const search = new SearchPage(page);
    await withAiFlags('visual: AI search off', async () => {
      await search.gotoQuery('lantern harbour', 'ai');
      await search.expectAiOff();
      await expect(page).toHaveScreenshot('frontend-search-ai-off.png', { fullPage: true });
    });
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
    // The reading view (W1, docs/45 §4.1).
    //
    // Viewport, NOT fullPage. The original claim here was that the height is "determined by ONE
    // piece of fixed, spec-arranged content, so the shot is stable across runs" — that is not true,
    // and two mints of the same commit disproved it: 1280x731 then 1280x720. The content is not
    // fixed. `data.pieceTitle()` embeds a per-run token (`E2E Piece <seed>-<worker>-<n>`), so the
    // h1's rendered length — and therefore where it wraps — changes between runs. Masking the
    // heading hides its PIXELS but not its box, so layout still moves with it.
    //
    // A height change is the worst failure mode available here: a size mismatch is unconditional,
    // so `maxDiffPixelRatio` cannot absorb it the way it absorbs sub-pixel AA noise. Viewport is
    // what the feed and both admin console baselines already do, for this exact reason.
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });
    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);
    // Wait for the second wave so the bar is in the shot rather than racing it.
    await expect(reader.engagement).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveScreenshot('frontend-reader.png', {
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
      // Rows carry identity resolved by id (B3): the seeded writer's pen name is stable, but the
      // avatar and the presence dot are not, so the rows stay masked.
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
    await settleToasts(page);
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
    // FIXED pen names. Since B3 these rows resolve a real profile, so the label is the pen name —
    // which defaults to `data.username()`, a per-run variable-LENGTH string. Masking hides the
    // pixels, not the box, so an unpinned name is an unpinned baseline width.
    await api.setPenName(
      await api.loginToken(blocked.email, 'ChangeMe!VisualBlocked1'),
      'Visual Blocked',
    );
    await api.setPenName(
      await api.loginToken(muted.email, 'ChangeMe!VisualMuted1'),
      'Visual Muted',
    );
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
    // FIXED body text. `data.username()` is variable-length (`e2e_<seed>-<worker>-<n>`), and the
    // comment card is masked — which hides its PIXELS but not its BOX, so a longer string wraps to
    // another line and the card grows. The story is fresh per run, so the text need not be unique.
    await comments.addComment('Visual baseline comment');
    await settleToasts(page);
    await expect(page).toHaveScreenshot('frontend-comments.png', {
      // Viewport, NOT fullPage. Two independent mints of this commit disagreed by 8.05% on chromium
      // (the top 86 rows, full width) and by 124px of HEIGHT on webkit. The header is identical in
      // both — it just sits ~21px lower in one, with everything below row 86 unchanged: the
      // signature of a sticky header under fullPage, where Playwright's scroll-and-stitch settles
      // the sticky element at a different offset per run. The reader baseline drifted the same way
      // (11px). Viewport captures one paint with no stitching, so the offset cannot vary.
      //
      // The card carries a relative timestamp, and an author resolved by id (B3) whose avatar is
      // environment-dependent — `CommentDto` still sends no display name, it is looked up now.
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
    await settleToasts(page);
    await expect(page).toHaveScreenshot('frontend-suggestions.png', {
      // Viewport, NOT fullPage — same failure the comments baseline had, same signature: two mints
      // of this commit differed by 9.00% confined to the top 90 rows at full width, with the header
      // rendering identically but at a different offset. This page is 745px, i.e. 25px past the
      // 720px fold, and every baseline that drifted this way was marginally over it (comments 741,
      // reader 731). Pages well past the fold (settings 1597, billing-plans 1731) were
      // byte-identical across three mints, so the trigger is the ambiguous few pixels of overflow,
      // not fullPage alone — which is why the other tall baselines are deliberately left as they are.
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

  /**
   * The three AI surfaces W8 added (docs/45 §4, row W8).
   *
   * **These baselines do not exist yet, and this run must not create them.** `updateSnapshots: 'none'`
   * is set in `playwright.config.ts` precisely so a local run cannot mint a host-rendered baseline —
   * docs/48 §3.5 T-8, where exactly that silently happened. So these three tests are EXPECTED to fail
   * until baselines are minted in the pinned CI image, in both the `frontend` and `frontend-dark`
   * projects. That red is correct and is reported as such in the W8 readiness report; it is not a
   * defect in the surfaces and must not be "fixed" by weakening the setting.
   */
  test('the AI conversations list matches its visual baseline', async ({ page, api, data }) => {
    // Snapshotted POPULATED: the row is the design — a two-line link, a status tag slot, and three
    // icon-only controls whose spacing at the row's right edge is the thing worth reviewing.
    //
    // As a THROWAWAY user, which a baseline needs even more than a functional test does: on the shared
    // writer the row COUNT varies with whatever else is mid-flight, and a baseline of a list whose
    // length changes per run can never be stable. A private account gives exactly one row, always.
    //
    // The row's timestamp still moves every run, so the row is masked; the page chrome, the search
    // field and the overall arrangement are the subject.
    const password = 'ChangeMe!VisualConv1';
    const user = await api.createVerifiedUser({
      email: `visual-conv-${data.username()}@qalam.local`,
      username: data.username(),
      password,
    });
    // Arranged over the API for the same reason as the a11y scan: clicking "New conversation" would
    // bake that button's HOVER state into the baseline, so every future comparison would be against a
    // hovered primary button rather than the page at rest.
    const token = await api.loginToken(user.email, password);
    await api.createAiConversationAs(token, { title: 'Visual baseline conversation' });
    await freshLoginAs(page, user.email, password);

    const conversations = new AiConversationsPage(page);
    await conversations.goto();
    await conversations.expectResolved();
    await expect(conversations.rows).toHaveCount(1);
    await expect(page).toHaveScreenshot('frontend-ai-conversations.png', {
      fullPage: true,
      mask: [page.getByRole('list', { name: 'Conversations' }).getByRole('listitem')],
    });
  });

  test('the prompt library matches its visual baseline', async ({ page }) => {
    // Fully deterministic — the built-in shelf ships in code and this scan adds no custom presets — so
    // nothing needs masking. It carries the only `aria-pressed` icon toggles in the app, and their
    // pressed/unpressed treatment is reviewed here in both themes.
    const library = new PromptLibraryPage(page);
    await library.goto();
    await library.expectResolved();
    await expect(page).toHaveScreenshot('frontend-ai-prompts.png', { fullPage: true });
  });

  test('the AI token usage page matches its visual baseline', async ({ page }) => {
    // The AF1 twin of the billing usage baseline above, and worth its own: this card shows an
    // input/output split and no reset time, so it is a different layout with the same progress bars.
    // Counts are the shared writer's real usage and move as the AI specs run, so the cards are masked.
    const usage = new AiUsagePage(page);
    await usage.goto();
    await usage.expectResolved();
    await expect(page).toHaveScreenshot('frontend-ai-usage.png', {
      fullPage: true,
      mask: [page.getByRole('list', { name: 'Token usage windows' }).getByRole('listitem')],
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
