# E2E 06 — Phase Plan & Coverage Matrix

> **Status:** Binding roadmap. This is the _what to build, in what order_ for the E2E suite — the analog
> of `docs/18_DevelopmentRoadmap.md` for browser tests. Coverage grows in five phases; **every spec runs
> on all three engines (Chromium, Firefox, WebKit) from Phase 1**. Phases 1–4 cover **functional**
> behaviour; the final **Phase 5** covers **UI quality** — visual regression, responsive, and
> accessibility (the "works but looks/reads wrong" defects functional tests are blind to). Each phase
> has explicit **exit criteria** that must be met before the next begins. Workflows map to the real
> frontend features (`frontend/src/features/*`) and admin screens.

---

## 1. Phasing principles

- **Smoke first, depth later.** Phase 1 proves the harness + the highest-risk flows (auth) work on all
  three engines before we invest in breadth.
- **One end-to-end journey per app in the first cut.** Alongside Phase 1, we land _one_ Phase-2 journey
  per app (frontend: publish; admin: user management) so the suite demonstrates real value immediately.
- **Each phase is independently shippable and green** before the next. We do not start Phase 3 with
  Phase 2 flaky.
- **Every phase = all three browsers.** No engine is deferred. (CI cost management via sharding is in
  [07_CI](./07_CI.md).)
- **Functional first, appearance last.** UI-quality checks (visual/responsive/a11y — Phase 5) come
  _after_ the functional suite is complete and stable. **Why:** visual baselines taken against a
  still-churning UI are pure churn; they only pay off once behaviour is locked.

---

## 2. Coverage matrix — the whole map

Legend: ✅ in-phase target · ⬚ later phase · — not applicable.

### 2.1 Frontend (reader/writer app, `:5173`)

| Workflow                                       | P1  | P2  | P3  | P4  | Notes / feature dir                                     |
| ---------------------------------------------- | --- | --- | --- | --- | ------------------------------------------------------- |
| Login (valid) + logout                         | ✅  |     |     |     | `features/auth`                                         |
| Login invalid → field error                    | ✅  |     |     |     |                                                         |
| Register → verify email (Mailpit) → authed     | ✅  |     |     |     | Mailpit link ([04](./04_TestData.md))                   |
| Forgot → reset password (Mailpit) → login      | ✅  |     |     |     |                                                         |
| Guarded route redirect (`require-auth`)        | ✅  |     |     |     | `app/guards/require-auth`                               |
| Guest-only redirect (`require-guest`)          | ✅  |     |     |     | `app/guards/require-guest`                              |
| Write → save draft → publish → in feed         |     | ✅  |     |     | `features/writing` (TipTap, [05 §4](./05_Selectors.md)) |
| Draft persistence (reload → draft still there) |     | ✅  |     |     | `features/writing`, drafts route                        |
| Feed loads + paginates; open a piece           |     | ✅  |     |     | `features/feed`                                         |
| Edit an existing piece → changes reflected     |     |     | ✅  |     | `features/writing`                                      |
| Search → find seeded piece → open              |     |     | ✅  |     | `features/search`                                       |
| Profile: view own + edit profile               |     |     | ✅  |     | `features/profile`, `me` route                          |
| Follow another user (throwaway 2nd user)       |     |     | ✅  |     | `features/profile`, follow-requests                     |
| Notifications: action → notification appears   |     |     | ✅  |     | `features/notifications` (in-app poll, `m8`)            |
| Settings: change password (throwaway user)     |     |     | ✅  |     | `features/settings`, [04 §6](./04_TestData.md)          |
| Silent token refresh survives navigation       |     |     | ✅  |     | [03 §7](./03_AuthStrategy.md)                           |
| Analytics: own stats page renders real data    |     |     |     | ✅  | `features/analytics` (`m9` shapes)                      |
| AI writing assistant: request → suggestion     |     |     |     | ✅  | `features/ai` (`af2`); may need `setTimeout`            |
| Monetization: subscribe → entitlement granted  |     |     |     | ✅  | `af5`, inert payment port ([00 §6](./00_Overview.md))   |
| Reading history / discover (For You)           |     |     |     | ✅  | `discover` route (`m3` contract)                        |
| Error/empty/offline states                     |     |     |     | ✅  | `app/pages/offline`, `route-error`, `not-found`         |

### 2.2 Admin (staff panel, `:5174`)

| Workflow                                                       | P1  | P2  | P3  | P4  | Notes                                                          |
| -------------------------------------------------------------- | --- | --- | --- | --- | -------------------------------------------------------------- |
| Super-admin login + dashboard loads                            | ✅  |     |     |     |                                                                |
| Login invalid → error                                          | ✅  |     |     |     |                                                                |
| Unauthorized/anon → redirect (route guard)                     | ✅  |     |     |     |                                                                |
| RBAC boundary: non-super-admin blocked from super-admin screen |     |     | ✅  |     | needs a 2nd admin-role fixture ([03 §2](./03_AuthStrategy.md)) |
| Users: search, view a user                                     |     | ✅  |     |     |                                                                |
| Users: grant/revoke a role                                     |     | ✅  |     |     | assert side effect via `api` ([02 §4](./02_Conventions.md))    |
| Users: suspend a user (throwaway) → login blocked              |     | ✅  |     |     | cross-app assert: suspended user can't log in on FE            |
| Moderation: queue lists a reported piece                       |     |     | ✅  |     | arrange report via `api`                                       |
| Moderation: approve → leaves queue                             |     |     | ✅  |     |                                                                |
| Moderation: reject/takedown → piece hidden on FE               |     |     | ✅  |     | cross-app assert                                               |
| Audit log: an admin action shows an entry                      |     |     | ✅  |     |                                                                |
| Dashboard: Analytics renders KPIs/charts                       |     |     |     | ✅  | canvas caveat ([05 §6](./05_Selectors.md))                     |
| Dashboard: Operations (P7.4) renders                           |     |     |     | ✅  | `p74-operations-platform`                                      |
| Dashboard: Security renders                                    |     |     |     | ✅  | `42_SecurityCompliancePlatform`                                |
| Dashboard: System/health renders                               |     |     |     | ✅  | `39_ProductionInfrastructure`                                  |

---

## 3. Phase 1 — Smoke + Auth (the harness proof)

**Goal:** the harness works end-to-end on all three engines, and the highest-risk flow (auth) is fully
covered for both apps.

**Deliverables (this is also the "first cut" alongside the harness):**

- `e2e/` package, `playwright.config.ts`, fixtures, both setup projects, `stack-up/down.sh`, e2e seed.
- `tests/frontend/auth.spec.ts`, `tests/admin/auth.spec.ts` (all rows marked P1 above).
- **One Phase-2 journey per app already landed** to prove depth: frontend publish flow + admin user
  management flow (see §4). This is the explicit "Phase 1 + one Phase-2 flow per app first" scope.
- `web-e2e.yml` CI job ([07_CI](./07_CI.md)).

**Exit criteria:**

1. All P1 specs (+ the two seeded Phase-2 journeys) pass on chromium, firefox, **and** webkit.
2. Green **three consecutive** CI runs, zero quarantined tests.
3. Trace/screenshot/video artifacts confirmed uploaded on an intentional failure.
4. Docs 00–08 merged; testid inventory started ([05 §3.4](./05_Selectors.md)).

---

## 4. Phase 2 — Core journeys

**Goal:** the money workflows — publish (frontend) and user management (admin) — fully covered.

**Frontend:** write→draft→publish→feed; draft persistence across reload; feed load/paginate/open.
**Admin:** users search/view; grant/revoke role (assert via API); suspend user → the suspended user
cannot log in on the frontend (**first cross-app assertion** — validates the shared backend).

**Exit criteria:** all P2 rows pass on 3 engines; cross-app suspend assertion proven; 3 green CI runs;
**E2E promoted to a blocking PR gate** now that core flows are stable ([07 §gate-policy](./07_CI.md)).

---

## 5. Phase 3 — Depth

**Goal:** the surrounding workflows that make the apps real.

**Frontend:** edit piece; search→open; profile view/edit; follow (2nd user); notifications;
change-password (throwaway user); silent-refresh survival.
**Admin:** moderation queue approve/reject with cross-app FE effect (rejected piece hidden on FE);
audit-log entry; RBAC boundary (needs a moderator-only fixture + storageState).

**Exit criteria:** all P3 rows on 3 engines; moderation cross-app assertions proven; 3 green CI runs.

---

## 6. Phase 4 — The rest

**Goal:** analytics, AI, monetization, dashboards, and resilience states.

**Frontend:** analytics stats; AI assistant suggestion; subscribe→entitlement (inert port);
discover/For-You; error/empty/offline states.
**Admin:** all four dashboards render (KPIs + chart presence, canvas caveat).

**Exit criteria:** all P4 rows on 3 engines; 3 green CI runs; the full **functional** matrix (§2) complete.

---

## 7. Phase 5 — UI Quality (visual, responsive, accessibility)

**Goal:** catch the defect class functional E2E is blind to. A test that finds a button by role passes
even if that button is invisible behind another element, off-screen on mobile, or unreadable to a screen
reader. Phase 5 closes that gap across three dimensions. Full method + policy live in
[10_UIQuality](./10_UIQuality.md); this is the roadmap slice.

### 7.1 The three dimensions

| Dimension             | What it catches                                                                | How                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Visual regression** | Layout breakage, spacing, colour, overlap, theme glitches, a chart drawn wrong | Playwright `toHaveScreenshot()` baselines per key page/component, per engine, with masks for dynamic regions                    |
| **Responsive**        | Overflow, wrapping, unreachable nav/menus at small widths                      | Extra **viewport projects** (mobile + tablet) re-running a curated subset; assert no horizontal scroll + key controls reachable |
| **Accessibility**     | Contrast, missing/!wrong ARIA, keyboard traps, unlabeled controls              | `@axe-core/playwright` scan asserting zero critical/serious violations + keyboard-only walkthrough of auth + publish            |

### 7.2 Scope — curated, not every workflow

Visual/a11y checks target **high-value pages**, not the whole functional matrix (a screenshot per test
would be unmaintainable):

- **Frontend:** login, register, feed, editor (+ publish drawer), a piece page, profile, settings, an
  error/empty state.
- **Admin:** login, dashboard, users table (+ edit modal), moderation queue, one analytics dashboard.

### 7.3 Deliverables

- `10_UIQuality.md` — baseline/masking policy, viewport matrix, a11y ruleset, flake controls.
- Viewport projects (`*-mobile`, `*-tablet`) in `playwright.config.ts` for the curated subset.
- `@axe-core/playwright` dev dependency + an `a11y` helper fixture.
- `tests/**/*.visual.spec.ts` + `*.a11y.spec.ts`, tagged `@phase5`; committed screenshot baselines.
- CI: baselines generated on a **pinned runner OS / Docker image** so cross-OS rendering doesn't churn.

**Exit criteria:** visual baselines established and green on 3 engines; the responsive subset green at
mobile + tablet; **zero critical/serious** axe violations on the listed pages; keyboard-only auth +
publish pass; 3 green CI runs; the full suite (functional §2 + UI-quality) documented as the release-gate
reference in `docs/22_ReleaseChecklist.md`.

> **Cost/caveats (why this is last):** screenshots render slightly differently across OS/GPU, so baselines
> must be produced in one controlled environment (Docker/pinned CI image), never on mixed dev machines;
> and baselines only stop churning once the UI behaviour is frozen — hence after Phases 1–4.

---

## 8. Cross-app assertions — a first-class capability

Because both apps share one backend, several of the highest-value E2E assertions span apps: an admin
action in the admin app changing what a user sees in the frontend app. Playwright supports multiple
contexts in one test — a test can open an admin context _and_ a frontend context and assert the effect
propagates:

```ts
test('admin takedown hides the piece from the reader feed', async ({ browser, api, data }) => {
  const piece = await api.asWriter().createPiece({ title: data.pieceTitle(), status: 'published' });

  const adminCtx = await browser.newContext({ storageState: '.auth/admin.json' });
  const admin = new ModerationPage(await adminCtx.newPage());
  await admin.takedown(piece.id);

  const readerCtx = await browser.newContext({ storageState: '.auth/frontend.json' });
  const feed = new FeedPage(await readerCtx.newPage());
  await feed.expectPieceNotVisible(piece.title);
});
```

**Why this matters:** it's the deepest integration test we have — it proves the admin decision, the
backend state change, and the frontend read path all agree. These land in Phase 2 (suspend) and Phase 3
(moderation).

---

## 9. Tracking

Each phase is a tracked milestone. A phase's specs are tagged (`@phase1` … `@phase5`) so CI can run a
single phase (`--grep @phase2`) during rollout and the full suite once all phases land. Progress against
this matrix is recorded in the phase's completion note (see how the mobile/backend epics logged
reports), and a one-line status kept in [README](./README.md) once we begin implementing.
