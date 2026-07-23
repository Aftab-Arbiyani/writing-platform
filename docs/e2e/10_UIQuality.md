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
