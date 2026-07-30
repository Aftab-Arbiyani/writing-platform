import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expectNoSeriousA11yViolations } from '../../fixtures/a11y';
import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { EditorPage } from '../../pages/frontend/editor-page';
import { FeedPage } from '../../pages/frontend/feed-page';
import { AssistantPanel } from '../../pages/frontend/assistant-panel';
import { BillingPage } from '../../pages/frontend/billing-page';
import { BillingHistoryPage, UsagePage } from '../../pages/frontend/billing-detail-pages';
import { PlansPage } from '../../pages/frontend/plans-page';
import { CollaboratorsPage } from '../../pages/frontend/collaborators-page';
import { InvitationsPage } from '../../pages/frontend/invitations-page';
import { SettingsBlocksPage } from '../../pages/frontend/settings-blocks-page';
import { StoryCommentsPage } from '../../pages/frontend/story-comments-page';
import { StoryPublishingPage } from '../../pages/frontend/story-publishing-page';
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

  test('the publishing page has no critical/serious a11y violations', async ({
    page,
    api,
    data,
  }) => {
    // W3c, scanned with a review IN FLIGHT and a version present, so the states axe cares about are
    // all on screen: four `region` landmarks named by their own headings, the notes field's
    // `aria-expanded` toggle, and the visibility group's `role="group"` + label.
    const story = await api.createPiece({ title: data.pieceTitle() });
    const publishing = new StoryPublishingPage(page);
    await publishing.goto(story.id);
    await publishing.requestReview();
    await publishing.captureVersion();
    // Scanned with the cursor left wherever arranging put it — resting on the last button clicked.
    // This spec used to park the pointer at (0,0) first, because AntD's derived hover colour for a
    // default button was 4.37:1 (W3c-3). That token is now pinned in `antd-theme.ts`, so the
    // workaround is gone deliberately: parking the pointer would hide the next regression in exactly
    // the state this page is most likely to regress in.
    await expectNoSeriousA11yViolations(page, { label: 'frontend /write/:storyId/publishing' });
  });

  test('the safety settings page has no critical/serious a11y violations', async ({
    page,
    api,
    data,
  }) => {
    // W3c. Scanned with a row present: the list carries the only destructive control in settings,
    // and its kind tag has to be readable rather than colour-only.
    const writerToken = await api.loginToken('writer@qalam.local', 'ChangeMe!Writer1');
    const target = await api.createVerifiedUser({
      email: `a11y-blocked-${data.username()}@qalam.local`,
      username: data.username(),
      password: 'ChangeMe!Blocked1',
    });
    await api.blockUser(target.id, writerToken);

    const blocks = new SettingsBlocksPage(page);
    await blocks.goto();
    await blocks.expectResolved();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /settings/blocks' });
  });

  test('the plan comparison has no critical/serious a11y violations', async ({ page }) => {
    // AF5/W4. The densest custom-widget surface in the feature: the interval control is a hand-rolled
    // `radiogroup` (AntD has no segmented control in this kit) and each plan card ends in a button whose
    // name has to disambiguate it from its neighbours. Both are exactly what axe checks and a selector
    // test scoped by card cannot see.
    const plans = new PlansPage(page);
    await plans.goto();
    await plans.expectResolved();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /settings/billing/plans' });
  });

  test('the billing hub has no critical/serious a11y violations', async ({ page }) => {
    // Scanned as the seeded writer, who is on the free tier — the state most viewers see, and the one
    // that must therefore be clean. Its card links wrap a two-line label, which is the pattern most
    // likely to produce an unreadable accessible name.
    const billing = new BillingPage(page);
    await billing.goto();
    await billing.expectResolved();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /settings/billing' });
  });

  test('the AI usage dashboard has no critical/serious a11y violations', async ({ page }) => {
    // AF5/W4. Carries the feature's only `progressbar`s and its only `<dl>` stat grids — a bar without
    // `aria-valuenow`/`aria-valuetext` conveys its quantity by width alone, which is invisible to a
    // screen reader and passes every role-based selector.
    const usage = new UsagePage(page);
    await usage.goto();
    await usage.expectResolved();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /settings/billing/usage' });
  });

  test('billing history has no critical/serious a11y violations', async ({ page }) => {
    // AF5/W4. Hand-rolled `tablist`/`tab`/`tabpanel` wiring (`aria-controls` + `aria-selected`) rather
    // than AntD's Tabs, so the relationships are ours to get right — and a mismatched `aria-controls` is
    // precisely an axe finding rather than a functional one. Scanned on the tab whose ledger rows carry
    // status tags, so the tinted tag colours are measured against this page's background too.
    const history = new BillingHistoryPage(page);
    await history.goto();
    await history.expectResolved();
    await expectNoSeriousA11yViolations(page, { label: 'frontend /settings/billing/history' });
  });

  test('the not-found page has no critical/serious a11y violations', async ({ page, data }) => {
    // The curated error/empty surface ([10 §2.3]).
    const resilience = new ResiliencePage(page);
    await resilience.gotoUnknownAndExpectNotFound(`/no-such-route-${data.username()}`);
    await expectNoSeriousA11yViolations(page, { label: 'frontend not-found' });
  });

  /**
   * Every QTag colour, on every page background, in one scan.
   *
   * **This test exists because the page-driven scans could not see the defect it guards.** A token
   * is only scanned if some page happens to paint it, and `QTag color="success"` was painted by no
   * scan at all: the comments scan never resolves a comment, and the blocks page had been switched
   * to `neutral` precisely to dodge the failure. So `success` shipped at 4.02:1, and `warning` and
   * `info` at 4.18 and 4.23, under a fully green a11y suite (docs/48 §3.5).
   *
   * Two properties make it a real guard rather than a snapshot of today's palette:
   *
   * 1. **The recipe is read from `q-tag.tsx` itself**, not restated here. Add a colour to the
   *    component's `COLOR` map and it is scanned on the next run; pair a fill with the wrong label
   *    token and this scan renders exactly that mistake. A copy of the class strings would have
   *    drifted the first time the component changed.
   * 2. **It renders into a live page**, so the app's real stylesheet, cascade and alpha compositing
   *    apply. [10 §8.4](../../../docs/e2e/10_UIQuality.md) is explicit that computed contrast against
   *    the documented tokens is not evidence — every defect it lists passed that check.
   *
   * Runs in both themes via the `frontend-dark` project, which is where the tint maths differs most.
   */
  test('every QTag colour clears AA on every page background', async ({ page }) => {
    // Parse the component's own fill/label pairs. Reading the source keeps this test honest about
    // what QTag actually renders; the assertions below fail loudly if the shape stops matching.
    const source = readFileSync(
      fileURLToPath(new URL('../../../packages/ui/src/components/q-tag.tsx', import.meta.url)),
      'utf8',
    );
    const colorMap = /const COLOR: Record<QTagColor, string> = \{([\s\S]*?)\n\};/.exec(source);
    expect(colorMap, 'could not find QTag COLOR map — update this parser').not.toBeNull();

    const recipes = [...(colorMap?.[1] ?? '').matchAll(/^\s*(\w+):\s*'([^']+)',/gm)].map(
      ([, name, classes]) => ({ name: name ?? '', classes: classes ?? '' }),
    );
    expect(recipes.length, 'parsed no QTag colours').toBeGreaterThanOrEqual(6);

    // The pairing rule itself, asserted statically: a tinted fill must take an `-on-tint` label.
    // This is the check that makes a sixth colour safe — it fails before any pixel is measured.
    const mispaired = recipes.filter(
      (r) => /bg-(\w+)\/12/.test(r.classes) && !/text-\w+-on-tint/.test(r.classes),
    );
    expect(
      mispaired.map((r) => `${r.name}: ${r.classes}`),
      'a tinted QTag colour pairs bg-<fam>/12 with a label that is not text-<fam>-on-tint',
    ).toEqual([]);

    // `SIZE.sm` from q-tag.tsx — the smallest text the tag renders, and so the hardest AA case.
    const TAG_BASE = 'inline-flex items-center gap-1 rounded-sm font-medium h-5 px-2 text-xs';
    const html = ['bg-surface', 'bg-canvas', 'bg-raised']
      .map((bg) => {
        const tags = recipes
          .map((r) => `<span class="${TAG_BASE} ${r.classes}">${r.name} on ${bg}</span>`)
          .join('');
        return `<div class="${bg} flex flex-wrap gap-2 p-4">${tags}</div>`;
      })
      .join('');

    await page.goto('/');
    // String-form `evaluate`: the e2e tsconfig omits the `dom` lib on purpose (see pages/shared/
    // viewport.ts), so the markup is built above in typed Node code and only the injection is a
    // string. Class names only — nothing here interpolates page or user data.
    await page.evaluate(
      `(html) => { const d = document.createElement('div'); d.id = 'qtag-contrast-matrix'; d.innerHTML = html; document.body.appendChild(d); }`,
      html,
    );

    await expectNoSeriousA11yViolations(page, { label: 'QTag colour × background matrix' });
  });
});
