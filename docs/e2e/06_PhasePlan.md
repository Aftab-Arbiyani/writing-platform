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

Legend: ✅ in-phase target · ⏸ targeted but deferred (client UI not yet shipped) · ⬚ later phase · — not applicable.

### 2.1 Frontend (reader/writer app, `:5173`)

| Workflow                                       | P1  | P2  | P3  | P4  | Notes / feature dir                                                                                                                                                                                                                          |
| ---------------------------------------------- | --- | --- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login (valid) + logout                         | ✅  |     |     |     | `features/auth`                                                                                                                                                                                                                              |
| Login invalid → field error                    | ✅  |     |     |     |                                                                                                                                                                                                                                              |
| Register → verify email (Mailpit) → authed     | ✅  |     |     |     | Mailpit link ([04](./04_TestData.md))                                                                                                                                                                                                        |
| Forgot → reset password (Mailpit) → login      | ✅  |     |     |     |                                                                                                                                                                                                                                              |
| Guarded route redirect (`require-auth`)        | ✅  |     |     |     | `app/guards/require-auth`                                                                                                                                                                                                                    |
| Guest-only redirect (`require-guest`)          | ✅  |     |     |     | `app/guards/require-guest`                                                                                                                                                                                                                   |
| Write → save draft → publish → in feed         |     | ✅  |     |     | `features/writing` (TipTap, [05 §4](./05_Selectors.md))                                                                                                                                                                                      |
| Draft persistence (reload → draft still there) |     | ✅  |     |     | `features/writing`, drafts route                                                                                                                                                                                                             |
| Feed loads + paginates; open a piece           |     | ✅  |     |     | `features/feed` — link **and** render asserted since `/p/:slug` shipped (W1); §4 discharged                                                                                                                                                  |
| Reading view `/p/:slug` (cold load by slug)    |     | ✅  |     |     | `features/reading` — W1 ([45 §4.1](../45_WebClientRoadmap.md)); typography, engagement, 404                                                                                                                                                  |
| Edit an existing piece → changes reflected     |     |     | ✅  |     | `features/writing`                                                                                                                                                                                                                           |
| Search → find seeded piece → open              |     |     | ✅  |     | `features/search`                                                                                                                                                                                                                            |
| Profile: view own + edit profile               |     |     | ✅  |     | `features/profile`, `me` route                                                                                                                                                                                                               |
| Follow another user (throwaway 2nd user)       |     |     | ✅  |     | `features/profile`, follow-requests                                                                                                                                                                                                          |
| Notifications: action → notification appears   |     |     | ✅  |     | `features/notifications` (in-app poll, `m8`)                                                                                                                                                                                                 |
| Settings: change password (throwaway user)     |     |     | ✅  |     | `features/settings`, [04 §6](./04_TestData.md)                                                                                                                                                                                               |
| Silent token refresh survives navigation       |     |     | ✅  |     | [03 §7](./03_AuthStrategy.md)                                                                                                                                                                                                                |
| Analytics: own stats page renders real data    |     |     |     | ✅  | `features/analytics` (`m9` shapes)                                                                                                                                                                                                           |
| AI writing assistant: panel + gating           |     |     |     | ✅  | `features/ai` (`af2`) — W2 shipped the UI; the model-backed _suggestion_ half needs a provider in the stack (§6)                                                                                                                             |
| Monetization: subscribe → entitlement granted  |     |     |     | ⏸   | `af5` — **deferred: no client subscribe UI/route shipped** (§6)                                                                                                                                                                              |
| Collaboration: invite by handle → accept       |     |     |     | ✅  | `features/collaboration` (`af6`) — W3a ([49](../49_WebCollaborationEpicDesign.md)); suite runs with `VITE_ENABLE_COLLABORATION=true`, and the server flag fails open, so **no untestable half**                                              |
| Inline review: comment → reply → resolve       |     |     |     | ✅  | `features/collaboration` (`af6`) — W3b; replies come from `GET /comments/:id/thread`, so a rendered reply proves the thread wiring                                                                                                           |
| Inline review: suggest an edit → accept        |     |     |     | ✅  | `features/collaboration` (`af6`) — W3b; includes the `SUGGESTION_CONFLICT` state. First proof this flow works on ANY client (mobile's create could only 400 — [48 §3.2](../48_PlatformParityRegister.md))                                    |
| Publishing: review → approve → publish         |     |     |     | ✅  | `features/collaboration` (`af6`) — W3c; one actor end to end. It needed two until **W3c-1** was fixed — approving was coarse-gated on the platform `publishing.approve` an author does not hold ([48 §3.4](../48_PlatformParityRegister.md)) |
| Publishing: capture a version → revert         |     |     |     | ✅  | `features/collaboration` (`af6`) — W3c; revert answers the **piece**, not the snapshot (defect P-1)                                                                                                                                          |
| Trust: a restricted account gets the wall      |     |     |     | ✅  | `features/collaboration` (`af6`) — W3c; arranged with a real admin restriction on a throwaway user, so the wall is driven by the server's own `effect`                                                                                       |
| Trust: blocks/mutes list → unblock             |     |     |     | ✅  | `features/collaboration` (`af6`) — W3c; the row leaving the list proves the **blocked user's** id was sent, not the block row's (defect T-1). No mobile screen exists — [48 §3.3](../48_PlatformParityRegister.md)                           |
| Reading history / discover (For You)           |     |     |     | ✅  | `discover` route (`m3` contract)                                                                                                                                                                                                             |
| Error/empty/offline states                     |     |     |     | ✅  | `app/pages/offline`, `route-error`, `not-found`                                                                                                                                                                                              |

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

**Implementation status (specs landed, static-verified — tsc + eslint + `playwright test --list` green):**

- Frontend `writing.spec.ts` — publish flow (landed in P1); **draft persistence across reload** (autosave
  creates the server draft `/write` → `/write/:id`, hard reload rehydrates title + body).
- Frontend `feed.spec.ts` — **Latest feed loads, paginates on infinite scroll** (arranges 21 published
  pieces via `api.createPublishedPiece` to force a 2nd page past the size-20 window), and a card opens the
  piece. ~~**Deferred:** the reader/piece page (`/p/:slug`) is a later frontend epic…~~ **Discharged by W1**
  ([45 §4.1](../45_WebClientRoadmap.md)): `/p/:slug` ships, so both this spec and `search.spec.ts` now
  assert the piece actually **renders** at the destination rather than only that the link points there,
  and `reader.spec.ts` covers the surface directly. The signed-in default tab is "Following" (empty for a
  fresh writer), so the spec drives the public **Latest** tab.
- Admin `users.spec.ts` — suspend cross-app (landed in P1); **search + view a user** (detail drawer);
  **grant then revoke a role** via the Edit-user modal, asserting the persisted `role` through the `api`
  fixture (`PATCH /admin/users/:id` under the hood, super-admin only).

Two bounded, additive app-source changes support these (tracked in `e2e/pages/README.md`): `aria-label="Role"`
on the admin Edit-user Role `Select` (an a11y fix, preferred over a testid per [05 §3.2](./05_Selectors.md))
and `data-testid="user-detail-drawer"` scoping the admin user-detail drawer body.

**LIVE-VALIDATED (2026-07-23): all 6 Phase-2 journeys pass on Chromium AND Firefox** (8/8 incl. both setup
projects, per engine) against an isolated throwaway stack. **WebKit** still blocked only by missing host OS
libs (works in CI via `--with-deps`). CI PR-gate promotion still pending.

The live run surfaced — and this effort fixed — three real defects (exactly the payoff E2E exists for):

1. **Frontend infinite scroll broke on cold load (app bug, fixed).** `useInfiniteScroll` attached its
   `IntersectionObserver` in an effect keyed on mount, but every list renders a skeleton first and only
   mounts the sentinel once data arrives — so the observer bound to an absent node and never re-attached.
   The feed (and search / notifications / profile / drafts, which share the hook) never loaded page 2 on a
   fresh visit. Fixed by switching the hook to a **callback ref** so it binds when the sentinel mounts.
2. **`storageState` reuse is incompatible with the rotating-refresh + reuse-detection auth model.** The app
   keeps its access token in memory and boot-refreshes from the `qalam_rt` cookie; that cookie is single-use,
   so the first test consumed it and later tests reusing the static file hit the login screen. Fixed with a
   **per-test fresh login** ([03 §fresh-login](./03_AuthStrategy.md), `e2e/fixtures/auth.ts`) — each test
   mints its own token family in its own context. This is the standing pattern for authenticated specs.
3. **`DataFactory` collided across tests + retries.** A per-instance counter reset each test, so every test's
   first `email()` matched the previous test's (→ `AUTH_EMAIL_TAKEN`), and retries re-used the failed value.
   Fixed with a process-wide monotonic sequence.

Plus two AntD-selector lessons folded into the page objects: the admin Users search + row-action menus are
fine by role/label, but the Edit-user **Role `Select` must be driven by keyboard** (focus → ArrowDown to open
→ navigate by `aria-activedescendant` → Enter) — clicking the option is unreliable (rc-select renders the
dropdown in a body portal that can sit outside the viewport, and a forced click on the overlaid combobox
dismissed the modal in Firefox).

---

## 5. Phase 3 — Depth

**Goal:** the surrounding workflows that make the apps real.

**Frontend:** edit piece; search→open; profile view/edit; follow (2nd user); notifications;
change-password (throwaway user); silent-refresh survival.
**Admin:** moderation queue approve/reject with cross-app FE effect (rejected piece hidden on FE);
audit-log entry; RBAC boundary (needs a moderator-only fixture + storageState).

**Exit criteria:** all P3 rows on 3 engines; moderation cross-app assertions proven; 3 green CI runs.

**Implementation status — LIVE-VALIDATED on Chromium + Firefox (2026-07-23).** All 11 Phase-3 journeys pass
(frontend: edit piece, search→link, profile view/edit, follow, notifications, change-password, silent-refresh;
admin: moderation queue + cross-app takedown, dismiss, audit-log entry, RBAC boundary). WebKit pending host OS
libs (CI-only); CI PR-gate promotion pending.

- **Moderation cross-app** is proven: a takedown (`Remove content`) resolved in the admin UI removes the piece
  from the reader Latest feed (asserted in a fresh frontend context). The report queue has no title column, so
  a bounded `data-testid="report-actions-<id>"` (full id) was added — the button's aria-label is only an 8-char
  UUIDv7 prefix and collides across close-in-time reports.
- **RBAC boundary:** a minted moderator (re-logged so the JWT claim updates) reaches the dashboard but the
  super-admin-only `/roles` screen renders the 403 page in place (no redirect) and the nav item is hidden.
- New selector lessons folded in: the AntD **Decision** select (like the Role select) is keyboard-driven, and
  `selectAntdOption` now presses ArrowDown until the target **renders** (rc-select virtualizes long lists) and
  is the active descendant before Enter — the earlier "fetch target id upfront" approach only worked for short
  (≤ a few option) lists. Cross-cutting fixes (`freshLogin` per test, `DataFactory` process-wide sequence, the
  `useInfiniteScroll` callback-ref) carried over from Phase 2 and covered the new specs unchanged.

---

## 6. Phase 4 — The rest

**Goal:** analytics, AI, monetization, dashboards, and resilience states.

**Frontend:** analytics stats; AI assistant suggestion; subscribe→entitlement (inert port);
discover/For-You; error/empty/offline states.
**Admin:** all four dashboards render (KPIs + chart presence, canvas caveat).

**Exit criteria:** all P4 rows on 3 engines; 3 green CI runs; the full **functional** matrix (§2) complete.

**Implementation status — LIVE-VALIDATED on Chromium + Firefox (2026-07-24).** All landed P4 journeys
pass (18 spec runs + 2 setup projects across the two engines, 20/20 green). WebKit pending host OS
libs (CI-only, as in P1–P3); CI PR-gate promotion still pending.

Landed specs:

- Frontend `analytics.spec.ts` — the writer stats dashboard (`/me/stats`, `features/analytics`, `m9`)
  renders real `/analytics/dashboard` aggregates. The page object accepts **either** real-data
  state — the overview KPI cards **or** the "no published pieces" empty state — and rejects only the
  load-error panel (lifetime-only aggregates, on-demand snapshots → data presence is non-deterministic,
  render success is not).
- Frontend `discover.spec.ts` — the discovery / "For You" surface (`/discover`, `m3`) renders its real
  section reads (`/discover/*`, `/feed/trending`). Featured/trending are engagement-driven, so a cold
  stack legitimately shows the page's own "Nothing to discover yet." empty state; both a rendered
  section and the empty state pass, only the load-error panel fails.
- Frontend `resilience.spec.ts` — three states: (a) an unrouted path renders the **not-found** page
  (the router catch-all → `NotFound`, also the 404 branch of the `RouteErrorBoundary`) with its "Back
  to the feed" exit; (b) the **`/offline`** destination renders the offline shell; (c) the live
  **offline banner** appears when the browser context goes offline (`context.setOffline(true)` → the
  app store's window `offline` listener flips `isOnline`) and clears on reconnect.
- Admin `dashboards.spec.ts` — the four read-only consoles each render real backend reads: **Analytics**
  (A8, `/analytics`), **Operations** (P7.4, `/operations`), **Security** (P7.2, `/system/security`),
  **System information** (P7.1, `/system`). Data-driven (one `ADMIN_DASHBOARDS` descriptor per console);
  each asserts the `<h1>` + a KPI tile that mounts only once its query resolves + the **absence** of the
  section error panel, so a failed read cannot masquerade as a rendered dashboard. Charts are canvas
  (ECharts), so tile presence — not chart pixels — is the assertion ([05 §6](./05_Selectors.md)).

**Deferred (no client UI shipped — asserted when the epic lands, per the reader-page precedent §2.1):**

- **AI writing-assistant suggestion** (row `af2`) — ~~no component consumes the AI layer and no
  route is registered~~ **the UI shipped in W2** ([45 §4.2](../45_WebClientRoadmap.md)):
  `assistant.spec.ts` drives the real panel over the real editor, and it is covered by the a11y and
  visual dimensions in both themes. **What is still not asserted is a generated suggestion**, and
  the reason is environmental rather than a client gap: the AI feature flags are dark-launched (AF1
  seeds them disabled) and the E2E stack configures **no AI provider**, so nothing can generate one.
  Stubbing `/ai/completions` is ruled out by the no-mocks invariant ([README §invariants]), and the
  third-party allowance ([00 §6]) covers running against an inert **port** — which payments have and
  AI does not. Closing it needs an OpenAI-compatible stub service in the E2E stack plus seeded
  provider/model rows; that is a stack item, tracked here, and it also unblocks the AF3/AF4 client
  epics that will need the same thing.
- **Monetization subscribe→entitlement** (row `af5`) — there is **no monetization/subscribe/billing
  feature or route** in the frontend; the client is deferred (backend + mobile shipped). The inert
  payment port lives backend-side and is exercised by backend tests, not the browser suite.

Both rows re-enter the matrix as `✅` the moment their client epics ship; until then they are tracked
here and in the [README](./README.md) status, not silently dropped.

**Live-run notes / findings (the payoff E2E exists for):**

1. **`/offline` serves the static PWA fallback, not the React route (expectation corrected).** The built
   app resolves `/offline` to `public/offline.html` (the service-worker offline shell) rather than the
   SPA `Offline` component, so its copy differs ("You’re offline" as an `<h1>`, curly apostrophe, no
   period). The page object now matches the offline shell by role + a case-insensitive substring,
   tolerant of whichever surface the runtime serves.
2. **The E2E backend must run with `RATE_LIMIT_ENABLED=false`.** The suite mints a fresh login per test
   ([03 §fresh-login](./03_AuthStrategy.md)); the `authLogin` tier is **5/min AND 20/hour per ip+email**
   (`packages/shared/src/rate-limits.ts`), so a full-suite run on a shared seeded account exhausts the
   hourly bucket and later logins 429. The documented load-test escape hatch (`RATE_LIMIT_ENABLED=false`,
   the guard's early-out) is the correct posture for the E2E stack — the rate-limiter's own behaviour is
   covered by backend tests, not the browser suite. This should be baked into the e2e backend env
   ([08_Runbook](./08_Runbook.md)).
3. **Watch-mode is watcher-hungry on a shared host.** `nest start --watch` + `vite dev` exhaust the
   system `fs.inotify.max_user_watches` when other projects hold watchers, crashing the servers
   (ENOSPC). Local live-validation ran the backend built (`node dist/main.js`) and the two apps via
   `preview` (CI mode) — no file watchers — which is also what CI serves.

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

**Implementation status — LANDED, live-validated in the pinned Playwright image (2026-07-25).** The full
`@phase5` suite is **green on all three engines** (83 tests incl. both setup projects, run inside
`mcr.microsoft.com/playwright:v1.61.1-noble` — the first WebKit-inclusive live validation in this effort).
Breakdown:

- **Accessibility (`@a11y`):** axe (WCAG 2.0/2.1 A + AA) scans of the curated pages (frontend: login,
  register, feed, editor, profile, settings, not-found; admin: login, dashboard, users, moderation,
  analytics) + a **keyboard-only walkthrough** of auth (login) and publish (the drawer is operable and
  submits by keyboard alone). Gate = zero **critical/serious** except a documented **known-debt register**
  ([10 §4.2], `fixtures/a11y.ts` `KNOWN_A11Y_FINDINGS`). **As of 2026-07-27 that register is empty**
  — all three entries (`color-contrast`, `label`, `aria-hidden-focus`) were traced to real app defects
  and fixed, so the gate now runs with no downgraded rules ([10 §8.1](./10_UIQuality.md)). Two bugs were
  fixed in the app during the phase itself: the TipTap contenteditable's `aria-label` with no role
  (`aria-prohibited-attr`, now `role="textbox"` + `aria-multiline`), and axe sampling mid-animation.
- **Responsive (`@responsive`):** mobile (Pixel 7) + tablet viewport projects. **Both apps now hold the
  strict zero-horizontal-scroll gate.** The reader shell's ~24–40px sub-`lg` overflow, first landed as
  characterized debt, was root-caused (the frontend skipped preflight and with it `box-sizing:
border-box`, so every `w-full` + `px-*` container overflowed by exactly its padding) and fixed — every
  reader page now measures 0px ([10 §8.2](./10_UIQuality.md)). Login + core-journey (admin users) run
  green at small widths; primary nav is asserted reachable at both widths.
- **Dark mode (added 2026-07-27):** two `*-dark` projects re-run the a11y + visual specs under
  `colorScheme: 'dark'` ([10 §3.3](./10_UIQuality.md)). Dark had shipped with **no coverage at all**
  and was materially broken — light UA button faces on the dark canvas at 1.08:1, and the whole
  accent ramp under AA. All fixed; dark is now gated like light ([10 §8.4](./10_UIQuality.md)).
- **Visual (`@visual`):** `toHaveScreenshot` baselines for the curated pages — static corridors full-page,
  data-heavy pages with dynamic regions **masked** so only chrome is guarded. **27 per-engine baselines**
  (9 × chromium/firefox/webkit) were produced in the pinned image and committed under
  `tests/**/*-snapshots/`; CI verifies them in that **same image** via a container job (`web-e2e.yml`
  `web-e2e-visual`), with a `workflow_dispatch` input to regenerate + review in-PR ([10 §2.2, §5]).

**Still open after Phase 5 (2026-07-27):** the release-gate write-up now exists
([docs/22 — Browser E2E](../22_ReleaseChecklist.md)), and two defects that made the workflow
un-runnable are fixed (unreachable `main`-only trigger; backend started before migrations, which
kills bootstrap via `SettingsService.onModuleInit`) — see [07 §6.1](./07_CI.md). What remains is
purely execution: **three consecutive green CI runs** have never happened for any phase, so the
suite is still advisory rather than a required PR gate.

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
