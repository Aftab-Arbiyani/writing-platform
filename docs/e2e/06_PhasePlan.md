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

| Workflow                                           | P1  | P2  | P3  | P4  | Notes / feature dir                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | --- | --- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login (valid) + logout                             | ✅  |     |     |     | `features/auth`                                                                                                                                                                                                                                                                                          |
| Login invalid → field error                        | ✅  |     |     |     |                                                                                                                                                                                                                                                                                                          |
| Register → verify email (Mailpit) → authed         | ✅  |     |     |     | Mailpit link ([04](./04_TestData.md))                                                                                                                                                                                                                                                                    |
| Forgot → reset password (Mailpit) → login          | ✅  |     |     |     |                                                                                                                                                                                                                                                                                                          |
| Guarded route redirect (`require-auth`)            | ✅  |     |     |     | `app/guards/require-auth`                                                                                                                                                                                                                                                                                |
| Guest-only redirect (`require-guest`)              | ✅  |     |     |     | `app/guards/require-guest`                                                                                                                                                                                                                                                                               |
| Write → save draft → publish → in feed             |     | ✅  |     |     | `features/writing` (TipTap, [05 §4](./05_Selectors.md))                                                                                                                                                                                                                                                  |
| Draft persistence (reload → draft still there)     |     | ✅  |     |     | `features/writing`, drafts route                                                                                                                                                                                                                                                                         |
| Feed loads + paginates; open a piece               |     | ✅  |     |     | `features/feed` — link **and** render asserted since `/p/:slug` shipped (W1); §4 discharged                                                                                                                                                                                                              |
| Reading view `/p/:slug` (cold load by slug)        |     | ✅  |     |     | `features/reading` — W1 ([45 §4.1](../45_WebClientRoadmap.md)); typography, engagement, 404                                                                                                                                                                                                              |
| Edit an existing piece → changes reflected         |     |     | ✅  |     | `features/writing`                                                                                                                                                                                                                                                                                       |
| Search → find seeded piece → open                  |     |     | ✅  |     | `features/search`                                                                                                                                                                                                                                                                                        |
| Profile: view own + edit profile                   |     |     | ✅  |     | `features/profile`, `me` route                                                                                                                                                                                                                                                                           |
| Follow another user (throwaway 2nd user)           |     |     | ✅  |     | `features/profile`, follow-requests                                                                                                                                                                                                                                                                      |
| Notifications: action → notification appears       |     |     | ✅  |     | `features/notifications` (in-app poll, `m8`)                                                                                                                                                                                                                                                             |
| Settings: change password (throwaway user)         |     |     | ✅  |     | `features/settings`, [04 §6](./04_TestData.md)                                                                                                                                                                                                                                                           |
| Silent token refresh survives navigation           |     |     | ✅  |     | [03 §7](./03_AuthStrategy.md)                                                                                                                                                                                                                                                                            |
| Analytics: own stats page renders real data        |     |     |     | ✅  | `features/analytics` (`m9` shapes)                                                                                                                                                                                                                                                                       |
| AI writing assistant: panel + gating               |     |     |     | ✅  | `features/ai` (`af2`) — W2 shipped the UI; ~~the model-backed _suggestion_ half needs a provider in the stack~~ suite runs with `AI_STUB_ENABLED=true` + `AI_DEFAULT_PROVIDER=stub`. **Generated suggestion → streamed → applied to the draft asserted end to end** via the `stub` provider (§6)         |
| Monetization: subscribe → entitlement granted      |     |     |     | ✅  | `features/monetization` (`af5`) — W4 ([45 §4](../45_WebClientRoadmap.md), [report](../50_WebMonetizationReadinessReport.md)); suite runs with `VITE_ENABLE_MONETIZATION=true` + `PAYMENTS_MANUAL_ENABLED=true`. **Subscribe → payment → entitlement asserted end to end** via the `manual` provider (§6) |
| Collaboration: invite by handle → accept           |     |     |     | ✅  | `features/collaboration` (`af6`) — W3a ([49](../49_WebCollaborationEpicDesign.md)); suite runs with `VITE_ENABLE_COLLABORATION=true`, and the server flag fails open, so **no untestable half**                                                                                                          |
| Inline review: comment → reply → resolve           |     |     |     | ✅  | `features/collaboration` (`af6`) — W3b; replies come from `GET /comments/:id/thread`, so a rendered reply proves the thread wiring                                                                                                                                                                       |
| Inline review: suggest an edit → accept            |     |     |     | ✅  | `features/collaboration` (`af6`) — W3b; includes the `SUGGESTION_CONFLICT` state. First proof this flow works on ANY client (mobile's create could only 400 — [48 §3.2](../48_PlatformParityRegister.md))                                                                                                |
| Publishing: review → approve → publish             |     |     |     | ✅  | `features/collaboration` (`af6`) — W3c; one actor end to end. It needed two until **W3c-1** was fixed — approving was coarse-gated on the platform `publishing.approve` an author does not hold ([48 §3.4](../48_PlatformParityRegister.md))                                                             |
| Publishing: capture a version → revert             |     |     |     | ✅  | `features/collaboration` (`af6`) — W3c; revert answers the **piece**, not the snapshot (defect P-1)                                                                                                                                                                                                      |
| Trust: a restricted account gets the wall          |     |     |     | ✅  | `features/collaboration` (`af6`) — W3c; arranged with a real admin restriction on a throwaway user, so the wall is driven by the server's own `effect`                                                                                                                                                   |
| Trust: blocks/mutes list → unblock                 |     |     |     | ✅  | `features/collaboration` (`af6`) — W3c; the row leaving the list proves the **blocked user's** id was sent, not the block row's (defect T-1). No mobile screen exists — [48 §3.3](../48_PlatformParityRegister.md)                                                                                       |
| Reading history / discover (For You)               |     |     |     | ✅  | `discover` route (`m3` contract)                                                                                                                                                                                                                                                                         |
| AI search: ranked, grounded results + an answer    |     |     |     | ✅  | `features/search` (`af4`) — W5 ([45 §4](../45_WebClientRoadmap.md)); `mode=ai` on the public `/search`. Real Retrieval Platform end to end; the optional answer comes from the `stub` provider (§6)                                                                                                      |
| AI search: saved searches (save → re-run → remove) |     |     |     | ✅  | `features/search` (`af4`) — W5; server-side, per-user, capped at 50, so the spec runs as a throwaway reader and cleans up after itself                                                                                                                                                                   |
| AI search: signed-out invitation, keyword intact   |     |     |     | ✅  | `features/search` (`af4`) — W5. The public half: **no session ⇒ no AF4 request at all**, which is defect [48 §3.9 W5-6](../48_PlatformParityRegister.md)                                                                                                                                                 |
| Discover: AF4 recommendation shelves               |     |     |     | ✅  | `features/search` (`af4`) — W5; two shelves, each item carrying the server's own reason. Silent while the flag is down, which is asserted too                                                                                                                                                            |
| Reader "More like this" from the recommender       |     |     |     | ✅  | `features/reading` (`af4`) — W5; the `pieceId` enabler ([48 §3.9 W5-2](../48_PlatformParityRegister.md)). Asserts the SOURCE through the reason line, plus the signed-out degrade to W1's tag search                                                                                                     |
| Error/empty/offline states                         |     |     |     | ✅  | `app/pages/offline`, `route-error`, `not-found`                                                                                                                                                                                                                                                          |

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
  visual dimensions in both themes. ~~What is still not asserted is a generated suggestion~~ **it now
  is** — see the closure record below. The two blockers named here were the AI flags' dark launch and
  the absent provider; both are addressed, neither by changing the production seed.

  **The premise was wrong in the same way `af5`'s was, and correcting it is what closed the gap.**
  The claim was that "the third-party allowance covers running against an inert **port** — which
  payments have and AI does not". Payments did not have one either (that is what W4-4 found), and
  neither did AI: every adapter is credential-gated (`OpenAiCompatibleAdapter.isConfigured()` and its
  Anthropic/Gemini siblings each test an `apiKey` for emptiness), so the registry did not no-op for a
  keyless stack — it **refused** with `AI_PROVIDER_NOT_CONFIGURED`. There was no inert port to run
  against, and no `AiProvider` value reserved for one.

  `StubAdapter` (`backend/src/modules/ai/providers/adapters/stub.adapter.ts`) is that port, built to
  the `ManualAdapter` template: registered in the same registry alongside anthropic/gemini/openai,
  gated on `AI_STUB_ENABLED` rather than a credential (there is none to hold), and refusing every call
  when the flag is down. Two properties are deliberate and both are asserted by
  `stub.adapter.spec.ts`:

  - **It streams in many chunks.** Fixed-width deltas (28 chars) with a 25 ms pause between them, then
    a terminal chunk carrying `finishReason` + `usage`. A single-blob reply would have left the
    streaming path — the one the assistant and Ask-My-Book both depend on, and the one most likely to
    be wrong — entirely unexercised. Verified live: one request produces 12 `delta` frames.
  - **Its output is deterministic.** One constant passage, pure chunking, arithmetic token counts, no
    clock and no random source, so nothing here can drift the `frontend-ai-panel` baselines the way an
    absolute date drifted the comment-tile golden.

  The stub's prose says what it is, because an accepted suggestion lands in the writer's draft: text
  that read like real prose could be published as if a model had written it.

  **The flags are the other half.** AF1 seeds `feature.ai.enabled` and every
  `feature.ai.<camelCase>.enabled` **disabled**, and that IS every deployment's starting state — so the
  suite raises them **per test through the admin API and restores them in `finally`**
  (`api.enableAiFeatures` / `api.restoreFeatureFlags`), the pattern `monetization.spec.ts` established
  for `feature.payments.enabled`, rather than changing the seed. The flags are global rows and the
  suite is `fullyParallel`, so the three tests that disagree about them live in one
  `test.describe.serial` block — two assert the flag-down surface, the third raises them. Only
  `writing_assistant` is raised, so the Craft Coach's separately-gated assertion keeps its meaning.
  The model row the registry needs is a catalogue entry (`stub-1`, zero cost, streaming + JSON), which
  the registry upserts on boot exactly like every other model.

  **What the row now asserts, with nothing mocked at the app boundary:** flags raised → the panel
  offers live controls → "Continue writing" → `POST /ai/completions/stream` through the real
  orchestrator (prompt template, context builders, safety, token accounting) → SSE deltas accumulate
  into the panel's live region until the full passage is present → **Accept** hands the text to the
  editor's registered target → it appears in the document, autosaves, and survives a reload. The panel
  is fed only by `aiApi.stream`, so matching the complete final text is an assertion that every chunk
  arrived and concatenated in order.

  **What remains unasserted is a real vendor**: its HTTP/SSE dialect, its error and rate-limit
  responses, and prose quality. Those are covered offline by the adapter unit tests, and closing them
  would need a paid key plus a tolerance for a third party mid-suite — the same trade declined for
  Stripe (48 §3.6 W4-4). Also still unasserted: the Craft Coach's generated report (its flag stays
  down, so `coach-report` parsing is unexercised end to end), and AF3's per-analysis JSON schemas — the
  stub answers a valid but schema-agnostic object when JSON is asked for, which AF3's tolerant parser
  degrades on rather than crashes; a caller needing a specific schema must teach `bodyFor` that schema.

  **Rows this unblocks:** `af2`'s last leg (closed here), **W5** (the AI-discovery/Ask-My-Book surface
  needed exactly this stub to assert a cited answer), **W8**, and the **AF3 client epic** — each of
  which needs a generating provider in the stack and now has one.

  **The four `frontend-ai-panel` baselines are expected to stay green, and that is a consequence of the
  per-test toggle, not luck.** The panel's appearance is driven entirely by `/ai/features` — a
  configured provider changes nothing about what it renders — and the `web-e2e-visual` job runs
  `--grep @visual` only, so no test in that job raises a flag. The panel therefore still screenshots
  its flag-down "AI is turned off" state, byte-identical to the committed baselines. Two consequences
  worth knowing: (a) a **local** whole-suite run mixes @visual with the flag-raising test and can
  produce a spurious diff — `updateSnapshots: 'none'` correctly refuses to mint over it, and the answer
  is to run @visual on its own in the pinned image, never to weaken that setting; (b) if the flags are
  ever raised suite-wide instead, all four baselines DO need re-minting by that workflow and the
  flag-down assertion has to move somewhere else first.

  Enabled by `AI_STUB_ENABLED=true` + `AI_DEFAULT_PROVIDER=stub` in `scripts/stack-up.sh` and both
  `web-e2e` job envs, and nowhere else. They are **backend** vars, not part of the Vite build step:
  the client has no AI switch, and `AI_DEFAULT_PROVIDER` is what makes the orchestrator resolve `stub`
  instead of the `openai` default, whose adapter would refuse for want of a key. With them on, every
  writer's suggestion is the same canned paragraph — test stacks only.

- **Monetization subscribe→entitlement** (row `af5`) — ~~there is no monetization/subscribe/billing
  feature or route in the frontend~~ **the UI shipped in W4** ([45 §4](../45_WebClientRoadmap.md)), and
  ~~the payment leg cannot be asserted without a processor credential~~ **it now is**
  ([48 §3.6 W4-4](../48_PlatformParityRegister.md)). `monetization.spec.ts` drives all five surfaces
  against the real stack, covered by the a11y and visual dimensions in both themes.

  **The premise this row was parked on was wrong, and correcting it is what closed the gap.** The claim
  was that "the third-party allowance covers running against an inert **port**" — but there was no inert
  payment port. Every adapter is key-gated (`StripeAdapter.isConfigured()` and its Apple/Google siblings
  each test a secret for emptiness) and `PaymentProvider.Manual` sat in the vocabulary, documented as
  covering admin/comp grants, with **no adapter at all** — so the registry declined for every provider
  including `manual`. The port did not no-op; it refused.

  `ManualAdapter` fills that documented gap: it settles a charge without a processor, so the row asserts
  the whole chain for real, with nothing mocked at the app boundary —

  - **subscribe → payment → entitlement**, on a throwaway subscriber: a 499 succeeded payment row, a paid
    invoice, `ai_writing` flipping to allowed, and the client rendering both the new tier and the receipt.
  - **entitlement granted → the gate opens**, independently, through an **admin entitlement override** —
    the same Entitlement Service and the same snapshot the client gates on, asserted in both directions
    (deny closes the credit-balance gate, revoke reopens it).
  - **the honest refusal**, still asserted, because a platform with its flag down is every deployment's
    default state.

  Enabled by `PAYMENTS_MANUAL_ENABLED=true` in `scripts/stack-up.sh` and both `web-e2e` job envs, and
  nowhere else — it books revenue nobody collected, so it is a test-stack provider only.

  **What remains unasserted is Stripe specifically**: its redirect flow, its webhook path, and
  provider-side subscription state. Its HTTP client and webhook HMAC scheme are covered offline by
  `stripe.adapter.spec.ts`. Closing the rest would need a real Stripe test key and a tolerance for a
  third-party dependency mid-suite; that trade was considered and declined (48 §3.6 W4-4).

**`af4` — AI search / discover shelves / reader recommendations (added 2026-08-04, W5 Phase 3).** Five new
frontend rows, live-validated on Chromium (4 consecutive green whole-project runs, 99 tests) and Firefox,
with the a11y dimension green in **both themes** (47 scans, no new known-debt entries):

- `ai-search.spec.ts` — the flag-down refusal (every deployment's starting state), keyword search proven
  unaffected, a ranked + grounded result set with its relevance stated in the accessible name, an opt-in
  synthesised answer from the `stub` provider, the "Try instead" suggestion row, and saved searches
  (save → cold-load → re-run in the AI engine → remove, verified server-side each time). Plus two
  **signed-out** tests, which are the ones that found [48 §3.9 W5-6](../48_PlatformParityRegister.md).
- `discover.spec.ts` — the two AF4 shelves, asserted through the reason string the server composes per kind,
  and asserted **silent** while the flag is down.
- `reader.spec.ts` — "More like this" answered by the recommender for a signed-in reader (the `pieceId`
  enabler) and degrading to W1's tag search for an anonymous one.

**Three real defects came out of running it**, all fixed here and recorded in [48 §3.9](../48_PlatformParityRegister.md):
a public reading page that never rendered for a signed-out visitor (W5-6, high), a saved search that re-ran
in the wrong engine (W5-7), and "Explain these results" answering nothing because the cached retrieval plan
outranked the request (W5-8). None was visible to a unit test; all three needed a browser against a real
stack, which is the entire argument for this suite.

**The AI feature flags now have a cross-worker mutex** ([48 §3.9 W5-9](../48_PlatformParityRegister.md)) —
four spec files disagree about those global rows, and `describe.serial` cannot order across files. Anything
that raises them, asserts the dark state, or screenshots a flag-dependent baseline takes the lock, and the
restore runs on its own request context so a test timeout cannot leak a raised flag into the rest of the run.

**Not asserted, deliberately:** the visual dimension pins the AI search **refusal**
(`frontend-search-ai-off`), not a populated result set — a live ranking's content and height differ every
run, so masking it to stability would leave only the toggle ([10 §2.2](./10_UIQuality.md)). Ask My Book and
the Story Explorer are AF3/W6 surfaces and are not in this row.

Both rows have now re-entered the matrix as `✅` — `af2` with W2, `af5` with W4 — and **both stack gaps
are closed**: `af5`'s by the `manual` payment provider, `af2`'s by the `stub` AI provider. What each
still lacks is its real third party: a Stripe key for Stripe's own redirect + webhook paths, a vendor
key for a real model's wire dialect and error responses. Both are scoped above and tracked here.

Neither closure changed a client, a seed, or a production default — each is one inert adapter plus
per-test flag toggling, which is the shape any future "the E2E stack cannot reach X" gap should take.

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
4. **`EditorPage.waitForSaved()` cannot detect a _second_ save, and mistaking that for a bug costs an
   afternoon.** The autosave indicator reads "Saved · HH:MM" from the previous save, so on a draft that
   has already saved once it matches **instantly**; a reload then races the 2 s autosave debounce and
   reads the pre-change content back. That looked exactly like "the accepted AI suggestion is never
   persisted" — the app was fine, the wait was not. `waitForNextAutosave()` (armed _before_ the change,
   awaited after; it waits for the `PATCH /pieces/:id` response) is the correct wait for any test that
   changes content and then reloads. `waitForSaved()` remains right for the FIRST save, where the URL
   swap `/write` → `/write/:id` is the real signal.
5. **The AI panel disables its quick actions on an empty document**, independently of availability
   (`nothingToWorkWith` in `assistant-tab.tsx`). So `AssistantPanel.expectAvailable()` — which asserts
   _enabled_, because that is what distinguishes `available` from a still-loading `unknown` — requires a
   draft with text in it. Asserting on a blank draft fails for a reason that has nothing to do with
   flags or providers.

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
