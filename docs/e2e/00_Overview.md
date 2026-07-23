# E2E 00 — Overview, Goals & Philosophy

> **Status:** Binding. Derives from `docs/00_ArchitectureDecisions.md` and `docs/18_DevelopmentRoadmap.md`
> (the "e2e becomes a blocking gate once infra is automated" note). This document defines _why_ the
> browser E2E suite exists, _what_ it does and does not cover, and the principles every later document
> refines into rules.

---

## 1. Why browser E2E, given we already have backend E2E and Vitest?

We already have three test layers:

| Layer               | Where                                 | Proves                                                              |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------- |
| Backend unit/integ. | `backend/src/**/*.spec.ts`            | Each service/guard/util behaves in isolation                        |
| Backend E2E         | `backend/test/**/*.e2e-spec.ts`       | The **API** returns the right envelope/status against real PG/Redis |
| Frontend component  | `frontend/src` + `admin/src` (Vitest) | A component renders/behaves given props + mocked hooks              |

None of them proves the thing the user actually experiences: **open a browser, log in, write a piece,
publish it, and see it in the feed** — with the _real_ frontend bundle talking to the _real_ API,
across the _real_ browser engines our audience uses. That gap is exactly where integration bugs live:
routing guards, token refresh, form→API wiring, optimistic cache invalidation, AntD/TipTap quirks,
and engine-specific CSS/JS differences (WebKit especially).

Browser E2E closes that gap. It is the **top of the test pyramid**: fewest tests, highest confidence,
slowest to run — so we are deliberate about what earns a spot here.

### 1.1 What earns an E2E spot

A workflow belongs in E2E when it satisfies **all** of:

- It is a **user-visible journey**, not a single function (that's a unit test).
- It **crosses the browser↔API boundary** (that's what the lower layers can't cover).
- Breaking it is **high-impact** (auth, publish, moderation, payment) or **high-integration-risk**
  (multi-step forms, cache invalidation, guarded routes).

If a behavior can be fully proven by a Vitest component test or a backend E2E test, it lives there,
**not** here. E2E is expensive; we spend it on integration, not on re-testing units.

---

## 2. Goals

1. **Confidence that real workflows work end-to-end** in Chromium, Firefox, and WebKit.
2. **Fast, unambiguous failure diagnosis** — every failure yields a trace, screenshot, and video.
3. **Deterministic, parallel-safe runs** — no flakiness from shared state or timing.
4. **Low maintenance cost** — page objects and stable selectors so UI refactors don't cascade.
5. **A phased, reviewable rollout** — value on day one (smoke + one core flow per app), expanding
   phase by phase to full coverage (see [06_PhasePlan](./06_PhasePlan.md)).

## 3. Non-goals

- **Not a replacement** for unit/component/backend-E2E tests. It sits on top of them.
- **Not visual-regression testing** (pixel diffing). Considered a later add-on, out of scope now.
- **Not load/performance testing** — that is `docs/43_PerformanceScalabilityPlatform.md` (k6/bench).
- **Not a coverage-percentage target.** E2E value is measured in _workflows covered_, not lines.
- **Not testing third-party UIs** (Stripe Checkout, Google OAuth consent). We stop at our boundary
  and stub/replace those seams — see §6.

---

## 4. Testing philosophy (the principles the rules derive from)

### 4.1 Test like a user, assert like a user

Interact through what a user sees (roles, labels, visible text), and assert on user-visible outcomes
(a toast appears, the piece shows in the feed, the URL changed) — never on internal state,
`localStorage` internals, or implementation details. **Why:** tests coupled to the DOM structure or
component internals break on every refactor and prove nothing about the user experience.

### 4.2 Real stack over mocks

The browser hits the real app; the app hits the real API; the API hits real Postgres/Redis/MinIO.
**Why:** the entire point of this layer is to catch integration failures. A mocked response can't
regress when the API contract changes — a real one can, and that's the bug we want to catch.

### 4.3 Deterministic before parallel

Every test must pass in isolation, in any order, and concurrently on three engines. That requires a
**fixed seeded baseline** plus **unique per-test data** (see [04_TestData](./04_TestData.md)).
**Why:** a suite that only passes when run alone is worse than no suite — it erodes trust and gets
disabled.

### 4.4 Web-first assertions, never sleeps

Use Playwright's auto-retrying, web-first assertions (`await expect(locator).toBeVisible()`). Never
`waitForTimeout`. **Why:** fixed sleeps are simultaneously too slow (padding) and too fast (flaky);
auto-retry waits exactly as long as needed and no longer.

### 4.5 Cheap to read, cheap to change

A spec reads as a sentence of user intent; the _how_ lives in page objects. **Why:** when the login
form changes, one page object changes — not forty specs.

### 4.6 A flaky test is a failing test

There is no "just re-run it." A test that flakes is quarantined and fixed (see
[08_Runbook §flake-policy](./08_Runbook.md)). **Why:** tolerated flakiness trains everyone to ignore
red, and then real failures ship.

---

## 5. Scope — apps, workflows, browsers

### 5.1 Apps

- **frontend** — reader/writer app on `:5173` (auth, writing/TipTap, feed, search, profile,
  notifications, settings, analytics, AI assistant, monetization).
- **admin** — staff panel on `:5174` (auth, users/roles, moderation queue, audit log, dashboards:
  analytics/operations/security/system).

Both are covered as separate Playwright _projects_ in one `e2e/` package ([01_Architecture](./01_Architecture.md)).

### 5.2 Browsers — all three, every phase

Chromium, Firefox, and WebKit run **every** spec from Phase 1 onward. This is the explicit
"in-depth, all three browsers" decision. Rationale and the CI cost trade-off are in
[07_CI](./07_CI.md). Mobile viewport projects (Mobile Chrome/Safari emulation) are an optional
Phase-4 add-on, not part of the baseline three.

### 5.3 Workflow coverage

The full per-phase, per-app coverage matrix is [06_PhasePlan](./06_PhasePlan.md). Summary:
Phase 1 smoke+auth → Phase 2 core journeys → Phase 3 depth → Phase 4 the rest.

---

## 6. The boundary — how we handle third parties

E2E stops at **our** boundary. Uncontrollable external services are handled deterministically so a
test never depends on a third party being up:

| External seam            | E2E strategy                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Email** (verify/reset) | Route to **Mailpit** (dev SMTP catcher, already in `docker-compose`); read the message via its API to extract the verification/reset link.                           |
| **Payments** (Stripe)    | The monetization payment port is key-gated (`af5-monetization`). E2E runs against the **inert/test** port; assert entitlement state changes, not Stripe's hosted UI. |
| **Social login** (OAuth) | Not driven through the provider's consent screen. Covered by seeding a verified user; the OAuth _callback_ handling is a component/backend concern.                  |
| **Object storage**       | **Real MinIO** (it's in the stack) — uploads genuinely round-trip. Not stubbed.                                                                                      |
| **Push (FCM)**           | Out of scope (mobile concern; web uses in-app polling per `m8-notifications-contract`).                                                                              |

**Why:** these are the only mocks we tolerate, and only because the alternative is non-determinism or
testing someone else's UI. Everything inside our two apps + our API is real.

---

## 7. Success criteria for the whole effort

The E2E suite is "done" for a phase when its exit criteria ([06_PhasePlan](./06_PhasePlan.md)) are met:
all listed workflows pass on all three browsers, green three consecutive CI runs (no quarantine), and
the phase's docs are updated. The _effort_ graduates to a **blocking PR gate** only after Phase 2 is
stable in CI (matching the roadmap's "blocking once infra is automated" posture) — until then it runs
on `workflow_dispatch` + merge-to-`main`, non-blocking. See [07_CI §gate-policy](./07_CI.md).
