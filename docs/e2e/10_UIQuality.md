# E2E 10 — UI Quality (Visual, Responsive, Accessibility)

> **Status:** Binding for Phase 5 ([06_PhasePlan §7](./06_PhasePlan.md)). Functional E2E (Phases 1–4)
> proves the app _works_; this document defines how we prove it _looks_ and _reads_ right — the defect
> class role/label selectors are blind to (an invisible button, an off-screen menu, an unlabeled control).
> Three dimensions: visual regression, responsive, accessibility. It reuses the same harness, projects,
> and page objects — only new spec types + a few config additions.

---

## 1. Why this is a separate, final phase

A functional spec finds a control by role and clicks it. It passes even if that control is rendered
behind an overlay, pushed off a 375px viewport, has 2:1 contrast, or has no accessible name a screen
reader can announce. Those are real user-facing defects. Phase 5 catches them.

It runs **last** because (a) visual baselines taken against a still-changing UI are pure churn — they
only pay off once behaviour is locked, and (b) it introduces environment sensitivity (screenshots render
differently across OS/GPU) that must be controlled deliberately, not bolted onto every phase.

---

## 2. Visual regression

### 2.1 Mechanism

Playwright's `await expect(page).toHaveScreenshot()` / `expect(locator).toHaveScreenshot()`. First run
writes a **baseline** PNG (committed to git); later runs diff against it and fail on pixel drift beyond
threshold.

```ts
test('login page matches its visual baseline @phase5 @visual', async ({ page }) => {
  await new LoginPage(page, FE_LOGIN).goto();
  await expect(page).toHaveScreenshot('frontend-login.png', {
    maxDiffPixelRatio: 0.01,
    animations: 'disabled',
    mask: [page.getByTestId('build-version')], // mask volatile regions
  });
});
```

### 2.2 Rules (MUST)

- **Baselines are produced in ONE controlled environment** — a pinned CI runner OS or a Docker image —
  never on mixed dev machines. **Why:** font hinting, sub-pixel AA, and GPU differ across OS, so a
  Mac-authored baseline fails on Linux CI for no real reason. Update baselines only via that environment
  (`--update-snapshots` in CI, reviewed in the PR).
- **Mask or freeze every dynamic region**: timestamps, relative times, avatars, random seed data, charts
  with live values, anything with `Date`/random. Use `mask:` or seed deterministic data. **Why:** an
  un-masked clock makes every run red.
- **Disable animations** (`animations: 'disabled'`) and wait for the page to be settled (fonts loaded,
  network idle for the region) before snapshotting.
- **Per-engine baselines.** Chromium/Firefox/WebKit render differently; Playwright namespaces snapshots
  by project automatically — keep all three.
- **A diff is reviewed, never blind-accepted.** A visual failure is either a real regression (fix the
  app) or an intended change (update the baseline _in the PR that caused it_, so the diff is reviewed).

### 2.3 Scope (curated — [06 §7.2](./06_PhasePlan.md))

Snapshot **high-value pages/components**, not every workflow: login, register, feed, editor + publish
drawer, a piece page, profile, settings, one error/empty state; admin login, dashboard, users table +
edit modal, moderation queue, one analytics dashboard. A screenshot-per-test suite is unmaintainable —
resist it.

---

## 3. Responsive

### 3.1 Mechanism

Add **viewport projects** that re-run a curated subset at mobile and tablet widths, reusing the same
specs/page objects.

```ts
// playwright.config.ts (excerpt) — Phase 5 additions
{ name: 'frontend-mobile',  use: { ...devices['Pixel 7'],  baseURL: FE, storageState: FE_STATE }, dependencies: ['setup-frontend'], testMatch: /responsive\// },
{ name: 'frontend-tablet',  use: { ...devices['iPad Mini'], baseURL: FE, storageState: FE_STATE }, dependencies: ['setup-frontend'], testMatch: /responsive\// },
```

### 3.2 What we assert

- **No horizontal overflow**: `expect(await page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth)).toBeTruthy()` on each page (the page body must never scroll sideways).
- **Key controls remain reachable**: the mobile nav/hamburger opens and its items are clickable; the
  editor's Publish, the admin table's row actions, primary CTAs are visible or reachable via the
  responsive menu.
- **Critical flows still complete on mobile**: login and one core journey (publish; admin users) run
  green at mobile width.

Responsive specs live in `tests/**/responsive/` and are tagged `@phase5 @responsive`. They target the
same curated page set as visual, plus the one core journey per app.

---

### 3.3 Dark mode

Both apps default to a `system` theme that resolves from `prefers-color-scheme`, so Playwright's
`colorScheme: 'dark'` is enough to stamp `data-theme="dark"` on `<html>` before first paint — no UI
toggling, no storage seeding. Two projects (`frontend-dark`, `admin-dark`) re-run the **UI-quality
specs only** (`testMatch: /(a11y|visual)\.spec\.ts$/`): a theme changes appearance, not behaviour,
so re-running functional journeys through differently-coloured pixels buys nothing. Chromium-only —
one engine × two themes is a better use of CI minutes than three engines × one.

Playwright namespaces snapshots by project, so dark baselines land beside the light ones as
`*-frontend-dark-linux.png` with no collision: **36 baselines total** (27 light, 9 dark).

> **Why this exists.** Dark mode shipped with _no_ coverage of any kind, and it was materially
> broken — see [§8.4](#84-dark-mode-debt--burned-down). Contrast computed against the documented
> dark tokens looked fine on paper; the rendered page was not, because the real backgrounds often
> were not those tokens. Rendering is the only check that catches that.

## 4. Accessibility

### 4.1 Mechanism

`@axe-core/playwright` runs the axe engine against a rendered page and returns violations.

```ts
import AxeBuilder from '@axe-core/playwright';

test('feed has no critical/serious a11y violations @phase5 @a11y', async ({ page }) => {
  await new FeedPage(page).goto();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const blocking = results.violations.filter((v) =>
    ['critical', 'serious'].includes(v.impact ?? ''),
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});
```

### 4.2 Rules

- **Gate on `critical` + `serious`** violations (zero tolerance); log `moderate`/`minor` as warnings, do
  not block. **Why:** WCAG AA critical/serious are genuine blockers; chasing every minor axe note stalls
  the suite.
- **Scan the curated pages** (§2.3) after they reach a stable, data-loaded state.
- **Keyboard-only walkthrough** for the two highest-value flows — auth and publish: tab order reaches
  every control, focus is visible, no keyboard trap, Enter/Space activate. This is a scripted
  `page.keyboard` spec, complementary to axe (axe doesn't test tab order).
- Findings that are genuine-but-deferred get an issue + an `axe` disable with a linked reason — never a
  silent skip.

---

## 5. CI integration

- Visual + a11y + responsive specs are tagged `@phase5`; CI runs them in the same `web-e2e.yml` matrix
  ([07_CI](./07_CI.md)) but they only gate once Phase 5 lands.
- **Screenshots are generated on a pinned image.** Pin the `runs-on` OS (or run the visual job inside the
  Playwright Docker image `mcr.microsoft.com/playwright:vX.Y.Z`) so baselines are reproducible. A visual
  job on a floating OS will flake forever.
- Baseline PNGs are committed under `e2e/tests/**/__screenshots__/` (Playwright's default, per project).
  They are the only intentionally-committed binaries in `e2e/`.
- On failure, the HTML report shows the expected/actual/diff triptych — the reviewer decides regression
  vs intended change.

---

## 6. What Phase 5 is still NOT

- **Not pixel-perfect design sign-off** against Figma — that's a human/design review; visual regression
  only catches _drift from the approved baseline_.
- **Not a full manual a11y audit** (screen-reader UX, cognitive load) — axe + keyboard catches the
  mechanical majority, not everything.
- **Not testing third-party UIs** — same boundary as [00 §6](./00_Overview.md).

---

## 7. Dependencies added in Phase 5

| Dependency              | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `@axe-core/playwright`  | Accessibility scanning (dev dependency)     |
| _(none for visual)_     | `toHaveScreenshot` is built into Playwright |
| _(none for responsive)_ | `devices[...]` viewports are built in       |

Minimal footprint — one dev dependency. Everything else reuses the existing harness.

---

## 8. Landing state & debt burn-down (2026-07-27)

Phase 5 is **landed and green on all three engines** in the pinned image. The two registers this
phase opened are now **empty** — every entry was traced to a real, fixable app defect rather than
the library limitation each was first filed as. The suite therefore runs with **no downgraded
rules**: zero critical/serious axe violations, and the strict zero-horizontal-scroll gate on
**both** apps.

### 8.1 Accessibility debt — burned down (`KNOWN_A11Y_FINDINGS` is now empty)

| Rule                | Was filed as                           | What it actually was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color-contrast`    | "design-token change needing sign-off" | Three separate causes, all fixed: (1) `--q-text-muted` `#8f887a` → **`#726c61`** (3.52 → 5.21:1 surface, 4.87:1 canvas, 4.51:1 raised); (2) AntD's _derived_ muted colours — `colorTextDescription` (Input counter at 2.72:1) and `colorTextPlaceholder` — now pinned to that token, plus Menu `groupTitleColor` (2.77:1) and `itemSelectedBg` (accent at 4.22:1); (3) `--q-warning` `#a97a1f` → **`#8d651a`**, because it renders as 12px status text in the moderation queue (3.82:1) and so must clear the text bar, not the 3:1 non-text one. |
| `label`             | "AntD Table internal"                  | Our composition: AntD labels the header "select all" box and leaves the row boxes to the caller. `DataTable` now supplies an `aria-label` per row via `getCheckboxProps` (`selectionLabel` prop to override with something human).                                                                                                                                                                                                                                                                                                                |
| `aria-hidden-focus` | "AntD Table internal"                  | AntD copies the selection column's header into its zero-height `aria-hidden` measure row, so a **second, focusable** "Select all" checkbox lives in an aria-hidden subtree. `admin/src/styles/global.css` takes the duplicates out of the tab order with `visibility: hidden`, which preserves the layout box the measure row needs.                                                                                                                                                                                                              |

Also fixed during this pass, and worth keeping: **axe was sampling mid-animation.** It reads
_computed_ colours, so a card caught fading in at 0.93 opacity reported `#7c776c` instead of its
real `#726c61` and failed by 0.08. `expectNoSeriousA11yViolations` now emulates reduced motion
(the app's `MotionProvider` then skips its JS-driven transitions) and injects a stylesheet that
collapses CSS transitions to their end state — deterministic, no sleeps.

Dark mode was corrected in the same pass (`--q-text-muted` `#7a7367` → `#8f897f`, 5.04:1 on
surface) though the suite scans light mode only. Two tokens still sit just under AA **on the
`raised` background specifically** — `accentHover` (4.08:1) and `success` (4.33:1) — which no
scanned page currently exercises as small text; left alone rather than churned speculatively.

### 8.2 Responsive debt — burned down (frontend now on the strict gate)

The reader shell's ~24px (mobile) / ~40px (tablet) overflow was **not** a stray wide element. The
frontend deliberately skips Tailwind's preflight (AntD owns the base reset, docs/00 §6) — which
also skipped preflight's `box-sizing: border-box`, leaving every element at the CSS default
`content-box`. So each `mx-auto w-full … px-4` page container resolved to `100% + 32px` (or `+48px`
at `sm:px-6`) and overflowed its parent by exactly its padding; the unreset UA `body` margin added
its 8px on top. That arithmetic reproduces both figures exactly, which is why every reader page
overflowed by the same amount.

`frontend/src/styles/global.css` now sets both rules in its `base` layer. This is not the
base-element reset the ADR conflict rule warns about — AntD's own cssinjs styles already assume
border-box, so it aligns the two systems. Admin was never affected: it is composed from AntD layout
primitives and already zeroed its body margin. Measured after the fix: **0px** of horizontal
overflow on `/feed`, `/write`, `/me` and `/settings/profile` at both viewports, so
`tests/frontend/responsive/responsive.spec.ts` now holds the same strict zero-scroll gate as admin.

> Still open, same family, deliberately not fixed here: skipping preflight also skips its list
> reset, so `<ul>`-based navs (e.g. settings) render UA bullet markers. Cosmetic, no gate, and it
> would churn baselines again — worth folding into a future design pass.

### 8.3 Visual baseline provenance & workflow

Baselines are produced and verified **only** in `mcr.microsoft.com/playwright:v1.61.1-noble` (pinned to the
e2e `@playwright/test` version). Committed under `tests/**/*-snapshots/` (27 files = 9 pages × 3 engines).
CI verifies them in that same image (`web-e2e.yml` → `web-e2e-visual`, `docker run --network host` against
host preview servers). To update: run the `web-e2e` workflow with `update_visual_baselines: true`, download
the `updated-visual-baselines` artifact, and commit it in the PR so the diff is reviewed. Never regenerate
baselines on a dev machine's native browsers.

### 8.4 Dark-mode debt — burned down (2026-07-27)

Dark mode had never been rendered by any test. Scanning it found failures in two families:

| Finding                                                                               | Was                 | Cause & fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feed tab pills as light-grey chips on the dark canvas; admin panels behind muted text | **1.08:1** / 1.53:1 | **The missing preflight again** — un-preflighted `<button>` keeps the UA `ButtonFace` background. The frontend also never declared `color-scheme`, so the UA painted its widgets from the _light_ palette over a dark page (`#efefef`); admin, which does declare it, got the dark one (`#6b6b6b`). Fixed with preflight's `button { background-color: transparent }` in each app's `base` layer — where AntD's unlayered button styles still win, so only unstyled buttons reset — plus `color-scheme` per theme on the frontend. |
| Accent links, headings and the primary button                                         | 4.06–4.37:1         | AntD composites `colorLink`/`colorPrimary` at ~85% alpha over the surface, so the `#d07349` token _rendered_ as `#b46541`. The dark accent is now `#e08a5f` (renders `#c17854`, 5.07:1 surface / 5.38:1 canvas) and hover `#eaa47d`.                                                                                                                                                                                                                                                                                               |
| White label on the primary button                                                     | 4.30:1              | A dark theme's accent fill is _light_, so its label must be dark: `colorTextLightSolid` is now the near-black ink in dark mode (5.45:1, versus 3.45:1 for white).                                                                                                                                                                                                                                                                                                                                                                  |
| Danger badge text on its own tint                                                     | 4.23:1              | `--q-danger` `#d06a5f` → `#dc7b70` (5.09:1 on the tint, 5.92:1 on surface).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

**The lesson worth keeping:** per-token arithmetic against the _documented_ background is not
verification. Every one of these passed that check and still failed in a browser — the pills because
the background came from the UA rather than a token, the accent because AntD re-composited it.

### 8.5 Baseline height stability (found while adding dark coverage)

Three baselines were full-page shots of **data-length-dependent** pages: the feed (4650px tall, and
its own spec publishes a new piece every run), the admin users console (row count), and admin
analytics. Masking hides a region's _content_ but not its _height_, so each baseline silently
encoded how much data happened to exist — and would have size-mismatched against a fresh CI
database and failed before comparing a pixel. All three now capture the **viewport** instead; the
chrome they exist to guard is above the fold. Verified stable across three consecutive runs that
each add data. Static pages keep `fullPage`.
