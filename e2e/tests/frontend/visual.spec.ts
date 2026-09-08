import type { Page } from '@playwright/test';

import { freshLogin, freshLoginAs } from '../../fixtures/auth';
import { AI_FLAG_TEST_TIMEOUT_MS, withAiFlags } from '../../fixtures/feature-flags';
import { test, expect } from '../../fixtures/test';
import { WritingToolsDrawer } from '../../pages/frontend/writing-tools-drawer';
import { BillingPage } from '../../pages/frontend/billing-page';
import { UsagePage } from '../../pages/frontend/billing-detail-pages';
import { PlansPage } from '../../pages/frontend/plans-page';
import { CollaboratorsPage } from '../../pages/frontend/collaborators-page';
import { CollectionsPage } from '../../pages/frontend/collections-page';
import { PieceConversation } from '../../pages/frontend/conversation';
import { EngagementBar, ReportDialog } from '../../pages/frontend/engagement';
import { ReaderPage } from '../../pages/frontend/reader-page';
import { ReadingStatsPage } from '../../pages/frontend/reading-stats-page';
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
  // CLOSE them rather than waiting out the timer. AntD holds each notice ~4.5 s, so two of them
  // cost ~9 s of dead time inside a 30 s test budget — and `the publishing page` spent it, then
  // failed `toHaveCount(0)` at 2 notices with "Test timeout of 30000ms exceeded" in CI run #26
  // (48 §3.25f). The notices were never stuck; the budget simply ran out while they ticked down.
  //
  // Clicking is bounded by the count taken up front, and always clicks `.first()` because the list
  // re-indexes as each notice leaves. The assertion below stays the real gate — a close that does
  // not take still fails here rather than silently snapshotting a toast.
  const closers = page.locator('.ant-notification-notice-close');
  const open = await closers.count();
  for (let i = 0; i < open; i += 1) {
    await closers
      .first()
      .click({ timeout: 5_000 })
      .catch(() => {
        /* already gone on its own timer — the assertion below is what matters */
      });
  }
  await expect(page.locator('.ant-notification-notice')).toHaveCount(0, { timeout: 15_000 });
}

/**
 * Park the page at scroll-top before a VIEWPORT screenshot.
 *
 * The last unexplained residual in W5-12. `frontend-comments` and `frontend-suggestions` were both
 * moved to viewport-not-fullPage to kill the scroll-and-stitch offset (see their docstrings) and
 * both STILL drifted — comments 0.04, suggestions 0.05 — in CI run #26, as a uniform ~25 px
 * vertical shift: heading, body, tabs and footer each rendered twice in the diff.
 *
 * 25 px is not a coincidence. The suggestions docstring measured this page at **745 px against a
 * 720 px fold**, comments at 741 and reader at 731 — every drifting baseline marginally over it,
 * every page well past it byte-identical. So the max scroll offset on these pages IS the observed
 * shift, and the cause is scroll POSITION, not stitching: Playwright scrolls an element into view
 * before clicking, so `addComment`/`propose` can leave the page parked at its 25 px maximum on one
 * run and at 0 on the next. A viewport screenshot then captures a different 720 px window.
 *
 * Scrolling back to 0 and asserting it removes the variable rather than masking its effect.
 */
async function atScrollTop(page: Page): Promise<void> {
  await page.evaluate('window.scrollTo(0, 0)');
  await expect.poll(async () => page.evaluate<number>('window.scrollY')).toBe(0);
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

  // FIXME(AI-panel-visual, 48 §3.25a/§3.25f) — still blocked on a PRODUCT decision, not on this test.
  //
  // The premise: this baseline pins the drawer's flag-DOWN state, but the editor's trigger is
  // conditional on `aiAvailability !== 'off'` (`editor-page.tsx`) — so in exactly that state no
  // trigger is rendered and `drawer.open()` times out. Same false premise §3.23a found in
  // `writing-tools.spec.ts`, which was fixed by RAISING the flags; that fix is unavailable here
  // because flags-down IS this test's subject.
  //
  // **D5 changed half of this and did NOT unblock it.** The condition lost its `&& !== 'self-off'`
  // clause — that state is merged into `off` — so the code reads differently and behaves the same,
  // which is worth saying plainly: a comment that still described a two-clause guard would look
  // stale and invite someone to "fix" the test against a condition that no longer exists.
  //
  // D5 also DELETED this test's four baselines, along with the `frontend-ai-panel` name they were
  // stored under. That costs nothing while the test is `fixme` (it mints nothing and compares
  // nothing) and is the honest state: the drawer it photographed had four tabs, an "AI assistant"
  // title and a Continue-writing button, none of which exist. Un-fixme-ing this means minting fresh.
  //
  // `fixme` rather than left failing: a permanently-red test is indistinguishable from a regression.
  // It accounted for 19 of run #26's 37 error contexts and was drowning three real failures.
  //
  // Unblocks when someone answers: what SHOULD a flags-down editor offer as an entry point, if
  // anything? B5 deliberately removed the stranded one, and D5 kept that call. The baseline follows.
  test.fixme('the writing tools drawer matches its visual baseline', async ({ page }) => {
    // Viewport, not fullPage: the drawer is fixed to the viewport and the editor behind it is empty
    // here, so a full-page shot would add nothing but height.
    //
    // **Under the AI feature-flag lock.** The baseline would contain the drawer's flag-DOWN state,
    // which is a property of the seeded flags rather than of this test — [06 §6] note (a) records
    // the consequence: a local whole-suite run mixing @visual with a flag-raising test could produce
    // a spurious diff. Holding the lock makes the state true for the duration rather than usual.
    test.setTimeout(AI_FLAG_TEST_TIMEOUT_MS);
    await withAiFlags('visual: writing tools (flags down)', async () => {
      await page.goto('/write');
      await expect(page.getByLabel('Title')).toBeVisible({ timeout: 30_000 });
      await new WritingToolsDrawer(page).open();
      await expect(page).toHaveScreenshot('frontend-writing-tools.png');
    });
  });

  /**
   * D5 deleted the baseline that sat here, `frontend-search-ai-off`.
   *
   * It pinned the engine switch with "AI search" pressed above the "AI is turned off" notice — the
   * state every un-flagged deployment shipped in, and the only deterministic thing about that page,
   * since a populated ranking varies in content and height with whatever the database holds.
   *
   * Both halves of its subject are gone: there is no engine switch, and search reaches no flag, so
   * there is no refusal to photograph. It is NOT replaced by a populated shot for the same reason it
   * was a refusal in the first place — masking a live ranking enough to stabilise it would leave the
   * chrome and nothing else. `search.spec.ts` asserts the results functionally, which is the right
   * tool for content that legitimately moves.
   */

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

  /**
   * The conversation on a piece (W7a, docs/45 §4.4).
   *
   * **Its own baseline rather than an extension of `frontend-reader.png`**, and deliberately so:
   * that shot is viewport-only because a per-run title changes where the `h1` wraps and therefore
   * the page height (see the note above it). The conversation sits at the very END of the article,
   * so it is not in that viewport at all — and making the reader shot `fullPage` to include it would
   * reintroduce exactly the height instability that note records. Scrolling to the section and
   * shooting the viewport keeps this one stable for the same reason.
   *
   * What it is guarding: the byline/action-row rhythm, the reply indent, the tombstone's muted
   * italic, and the response card — in BOTH themes, since `frontend-dark` re-runs this file. The
   * tombstone is the interesting one: muted italic on a card is where a dark-mode contrast
   * regression would land ([10 §8.4]).
   */
  test('the piece conversation matches its visual baseline', async ({ page, api, data }) => {
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });
    const live = await api.commentOnPiece(piece.id, 'A live comment, kept short for the baseline.');
    await api.replyToComment(live.id, 'A nested reply.');
    const doomed = await api.commentOnPiece(piece.id, 'Soon a tombstone.');
    await api.deleteComment(doomed.id);

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    const conversation = new PieceConversation(page);
    await conversation.expectLoaded();
    await conversation.expandReplies('A live comment');
    await expect(conversation.comments.getByText('A nested reply.')).toBeVisible({
      timeout: 30_000,
    });
    // Bring the section into the viewport — it is below the fold on every realistic article.
    await conversation.comments.scrollIntoViewIfNeeded();
    await settleToasts(page);

    await expect(page).toHaveScreenshot('frontend-conversation.png', {
      // Relative timestamps ("2m", "just now") and avatars are content that moves between runs;
      // the comment BODIES are pinned literals above precisely so the boxes do not move with them.
      mask: [page.getByRole('time'), conversation.comments.locator('.ant-avatar')],
    });
  });

  /**
   * The report dialog (W7b) — the reason it gets a baseline rather than only an a11y scan is the
   * reason-chip radiogroup: its SELECTED state is carried entirely by colour and border, in both
   * themes, and a token regression there is invisible to a role/name selector. One of the chips is
   * picked so the shot pins the selected treatment, not just the resting one.
   */
  test('the report dialog matches its visual baseline', async ({ page, api, data }) => {
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    await new EngagementBar(page).openReport();
    const dialog = new ReportDialog(page);
    await expect(dialog.dialog).toBeVisible({ timeout: 15_000 });
    await dialog.reason('Harassment or bullying').click();
    await settleToasts(page);

    // Viewport, not fullPage: the dialog is fixed over the article, and the article behind it
    // carries a per-run title whose wrapping would move the page height (see the reader note above).
    await expect(page).toHaveScreenshot('frontend-report-dialog.png');
  });

  /**
   * Reader analytics (W7c, `/me/reading`). Pins the reader tile grid + the two ranked-list charts —
   * the layout that distinguishes this surface from the writer dashboard's KPI grid.
   *
   * The TILE VALUES are masked: the seeded writer's reading history grows every run (each
   * `trackRead` above adds to it), so the numbers are not stable across mints while the layout is.
   * Masking values rather than the whole card keeps the shot about the design.
   *
   * NO BASELINE IS COMMITTED WITH THIS SPEC. Only the `web-e2e` workflow's visual job may mint one,
   * in the pinned Playwright image (docs/e2e/10 §8.3, docs/48 §3.5 T-8) — a local mint would bake
   * in host font rendering. "A snapshot doesn't exist" is the CORRECT result until that job runs.
   */
  test('the reader analytics page matches its visual baseline', async ({ page, api, data }) => {
    const piece = await api.createPublishedPiece({ title: data.pieceTitle() });
    await api.trackRead(piece.id);

    const reading = new ReadingStatsPage(page);
    await reading.goto();
    await reading.expectResolved();
    await settleToasts(page);

    await expect(page).toHaveScreenshot('frontend-reading-stats.png', {
      fullPage: true,
      // Every metric value + both charts are history-dependent; the labels and layout are not.
      mask: [page.locator('.tabular-nums'), page.getByRole('img')],
    });
  });

  /**
   * The collections list (W7b). Its card is the only place `isDefault` and `Private` are expressed
   * visually — a star vs. a bookmark glyph and a tinted tag — so this pins both.
   */
  test('the collections page matches its visual baseline', async ({ page, api, data }) => {
    // The title is per-PROJECT, not fixed and not random.
    //
    // Fixed was a defect: all eight @visual projects run this spec as the same writer, so the
    // second one to arrive got `409 COLLECTION_NAME_TAKEN` and failed in ARRANGE — four of the
    // 2026-08-25 run's failures were this. It also broke the suite's own rule (04 §5: never create
    // a record with a fixed name), three lines from a `data` fixture that was already injected.
    //
    // Random would break the screenshot instead: this name is RENDERED in the image the baseline
    // pins. Keying it to the project gives both — stable within a project, unique across them —
    // and costs nothing, because baselines are already namespaced per project
    // (`…-frontend-chromium-linux.png`).
    const collection = await api.createCollection({
      title: `E2E Collection — visual baseline (${test.info().project.name})`,
    });
    const piece = await api.createPublishedPiece({ title: data.pieceTitle() });
    await api.addPieceToCollection(collection.id, piece.id);

    const collections = new CollectionsPage(page);
    await collections.goto();
    await collections.expectLoaded();
    await settleToasts(page);

    await expect(page).toHaveScreenshot('frontend-collections.png', {
      fullPage: true,
      // The seeded writer accumulates collections across runs, so only the FIRST card is stable.
      // Masking the rest keeps the shot about the card design rather than the account's history.
      mask: [page.getByRole('listitem').nth(1)],
    });
    await api.deleteCollection(collection.id);
  });

  test('the collaborators page matches its visual baseline', async ({ page, api, data }) => {
    // AF6/W3a (docs/49). Snapshotted so the roster's role badges, presence dots, and gated controls
    // are pinned in BOTH themes — the badge/dot colours are the parts most likely to be unreadable
    // in dark, which is the failure mode [10 §8.4] was written about.
    const story = await api.createPiece({ title: data.pieceTitle() });
    const collaborators = new CollaboratorsPage(page);
    // The presence bar ("In this story") renders only when the roster is non-empty, and whether it
    // is depends on a RACE between two requests fired in the same tick on mount: the presence GET
    // and the viewer's first heartbeat POST. If the GET wins, the server has not yet heard from
    // this viewer, `PresenceBar` returns null, and the whole page sits ~40 px higher — which is why
    // this baseline came back different on two consecutive mints of the same commit, once with the
    // bar and once without. Nothing is masked into stability here: the bar's ABSENCE moves layout.
    //
    // Waiting it out is not an option — `use-presence.ts` refetches at PRESENCE_TTL_SECONDS / 2,
    // i.e. 22.5 s. So: load once to register the beat, wait for the POST to actually land, then
    // reload. On the second load the presence GET can only answer non-empty, and the shot matches
    // the committed baseline (which has the bar) every time rather than half the time.
    await collaborators.goto(story.id);
    await page.waitForResponse(
      (r) => r.url().includes(`/stories/${story.id}/presence`) && r.request().method() === 'POST',
    );
    await page.reload();
    await collaborators.expectResolved();
    await expect(page.getByRole('heading', { name: 'In this story' })).toBeVisible();
    // The THIRD W5-12 baseline, and the only one left on `fullPage` — which is why it was still
    // drifting (0.10, 87,604 px in CI run #29) after comments and suggestions were fixed. Same
    // treatment as those two, for the same measured reason: viewport captures one paint with no
    // scroll-and-stitch, and `atScrollTop` removes the residual scroll offset that survived the
    // switch on the other two (48 §3.25g).
    await atScrollTop(page);
    await expect(page).toHaveScreenshot('frontend-collaborators.png', {
      // Rows carry identity resolved by id (B3): the seeded writer's pen name is stable, but the
      // avatar and the presence dot are not, so the rows stay masked.
      mask: [page.getByRole('listitem')],
    });
  });

  test('the publishing page matches its visual baseline', async ({ page, api, data }) => {
    // 60 s. This test drove its own arrange through the UI — request a review, capture a version,
    // then settle two toasts — and paid for it three times: "Test timeout of 30000ms exceeded" in
    // CI runs #26 and #28 (48 §3.25f/§3.25g), then a HARD failure in the D5 baseline re-mint, where
    // webkit's `POST /stories/:id/review` hung ~20 s and answered 500. The page then sat on "Draft"
    // and `expectReviewState('In review')` burned its 30 s.
    //
    // The re-mint failure was NOT webkit-specific, and the diagnosis is the reusable part: a 500
    // comes from the server, which cannot see which engine sent the request. webkit was simply the
    // slowest of eight projects sharing a 2-vCPU runner at --workers=2, so it lost a contention race
    // that existed for all of them — the same shape as the axe mid-fade race in the a11y fixture,
    // where "webkit is different" was also the wrong answer. It does not reproduce on a 16-core box
    // at --workers=1 OR --workers=2, with no 5xx anywhere in the backend log.
    //
    // So the arrange now goes through the API, and only the RENDER is measured here. That is the
    // right split regardless of flakiness: `publishing.spec.ts` is what proves the buttons work, and
    // a visual baseline should assert what the populated cards look like, not re-test the mutations
    // that populate them. It also removes every toast this test used to raise, which is why
    // `settleToasts` is gone from it — no UI mutation, nothing to settle, ~9 s of dead time saved.
    test.setTimeout(60_000);
    // AF6/W3c (docs/49 §5). Arranged with a review in flight and one version captured, so the four
    // cards are all in a populated state rather than empty — the review chip, the gated publication
    // controls, the version row and the history timeline are exactly the tinted, state-carrying
    // chrome that dark mode breaks ([10 §8.4]).
    const story = await api.createPiece({ title: data.pieceTitle() });
    await api.requestReview(story.id);
    await api.captureSnapshot(story.id);
    const publishing = new StoryPublishingPage(page);
    await publishing.goto(story.id);
    await publishing.expectResolved();
    // Assert the arranged state is actually rendered before shooting: a screenshot of a card that
    // silently failed to load is a baseline of the wrong thing, and the page reads `Draft` for both
    // "no review" and "review request failed".
    await publishing.expectReviewState('In review');
    await publishing.expectVersionCount(1);
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
      // Raised from the config's 10 s for WEBKIT, where this assertion timed out mid-stabilisation in
      // CI run #26 — it produced neither an actual nor a diff, only "Timeout 10000ms exceeded" while
      // still re-taking the shot (48 §3.25f). Chromium, firefox and dark all passed.
      //
      // **Honest limit of this change:** the timeout is what the evidence supports, not a root cause.
      // Why the page needs >10 s to settle on webkit only is NOT established — plausible candidates
      // are the heavy arrangement above (five accounts, two mutations) and a `fullPage` shot whose
      // broad `listitem` mask includes the settings nav, but neither has been measured. If this
      // recurs after the raise, that is the thing to investigate rather than raising it again.
      timeout: 30_000,
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
    // 741px page, 720px fold — see `atScrollTop`.
    await atScrollTop(page);
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
    //
    // ⚠️ ARRANGEMENT CHANGED BY C-15, so this baseline needs a re-mint: the suggestion is now
    // proposed from the READER (the composer that lived on this page is gone, and with it the
    // "Suggest an edit" button that used to sit in this header). The shot's subject is unchanged —
    // a pending suggestion's diff rows — but the header has one fewer control, so the committed
    // image is stale until a `workflow_dispatch(update_visual_baselines: true)` run re-mints it.
    const story = await api.createPublishedPiece({
      title: data.pieceTitle(),
      body: 'The lantern burned low over the water.',
    });
    const reader = new ReaderPage(page);
    await reader.gotoSlug(story.slug as string);
    await reader.proposeEdit({ passage: 'lantern', suggested: 'The oil lamp burned low.' });

    const suggestions = new StorySuggestionsPage(page);
    await suggestions.goto(story.id);
    await suggestions.expectResolved();
    await settleToasts(page);
    // 745px page, 720px fold — see `atScrollTop`.
    await atScrollTop(page);
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
   * D5 deleted the three W8 AI baselines that sat here — `frontend-ai-conversations`,
   * `frontend-ai-prompts` and `frontend-ai-usage`. All three photographed routes that no longer
   * exist.
   *
   * The token-usage baseline's subject — a card of progress bars — survives on
   * `frontend-billing-usage`, which now shows per-tool allowances instead of token windows and is
   * re-minted for it. The prompt library's `aria-pressed` icon toggles had no other home.
   */

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
