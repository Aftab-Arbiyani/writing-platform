# 50 — W4 Monetization Readiness Report

**Epic:** W4 — monetization on the web (AF5) ([45 §4](./45_WebClientRoadmap.md)) ·
**Status:** ✅ complete, verified against a running stack · **Date:** 2026-07-29

> **The gap this closes.** AF5 shipped backend + mobile and deferred both web clients. The web app
> metered every AI request against a plan the reader could not see, on a subscription they could not
> manage, spending credits they could not inspect. All five of mobile's monetization surfaces are now
> live on web, dark-launched behind `VITE_ENABLE_MONETIZATION`.
>
> **This is the W-track's first true port.** `qalam-mobile/docs/56` had already audited all twenty AF5
> endpoints and found mobile's field mapping clean field-for-field — bodies, optionality, enum values and
> cursor pagination — so unlike W3 there was no contract to re-derive. Every shape was nonetheless
> re-confirmed live while the web layer was written, and that confirmed the audit. The five findings in
> §4 are in the contract or its published types, not in either client's reading of them.

---

## 1. What shipped

`frontend/src/features/monetization/` — 26 files, following the W3a/W3b conventions.

| Surface                                         | Delivered                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Billing hub** `/settings/billing`             | The monetization home (mobile's `subscription_screen`): plan + status, the status banner, cancel / reactivate / pause / resume, and links to the other four. A free reader gets an upsell, because `GET /subscription` 404s for them and that is the majority state. |
| **Plans** `/settings/billing/plans`             | The catalogue with a monthly/yearly `radiogroup`, the current plan marked, and one button that subscribes or changes plan depending on whether a subscription exists. Downgrades schedule for period end; upgrades apply immediately.                                |
| **Promo codes** (on Plans)                      | **New on web** — mobile has no coupon UI at all (§5, M5-2). Validates through the real `POST /coupons/validate` before checkout; hidden from existing subscribers, because the plan-change DTO would 400 on it (§4, W4-5).                                           |
| **AI usage** `/settings/billing/usage`          | Daily / monthly / lifetime rollups with accessible allowance bars, a labelled linear forecast, and the per-feature breakdown.                                                                                                                                        |
| **AI credits** `/settings/billing/credits`      | Balance (behind the one real premium gate), the conversion rate that makes a balance mean something, and the full ledger — infinite, where mobile takes only page one.                                                                                               |
| **Billing history** `/settings/billing/history` | Four tabbed ledgers: invoices, payments, purchases, plan changes. Mobile has the first two.                                                                                                                                                                          |
| **Entitlements**                                | `useEntitlements` / `useEntitlement` over one snapshot read, with mobile's cache semantics ported and tightened (§3).                                                                                                                                                |
| **`PremiumGate` / `PremiumBadge`**              | Ported, and — unlike mobile — actually wired (§2).                                                                                                                                                                                                                   |
| **Metered-AI upgrade state**                    | `features/ai` gained an `upgrade` availability state for `ENTITLEMENT_DENIED` / `INSUFFICIENT_CREDITS`, which were previously unmapped and therefore invisible (§2.2).                                                                                               |

### 1.1 Backend

**None.** W4 consumes the frozen `v1` contract. The roadmap's "no backend enabler" default held.

### 1.2 Availability

`VITE_ENABLE_MONETIZATION`, added to `config/env.ts` with the same zod `default('false')` pattern as
`VITE_ENABLE_COLLABORATION`, mirroring mobile's `QALAM_ENABLE_MONETIZATION`. The settings nav shows
**Billing** only while it is on, exactly as `SAFETY_SECTION` does. E2E runs it `true`.

Routes are registered unconditionally and each page renders its own "not available yet" state when the
flag is down — so a bookmarked URL explains itself rather than 404ing, which is how `blocks` behaves.

**Three independent gates, deliberately not conflated:**

| Gate                       | Where       | Answers                         | Default |
| -------------------------- | ----------- | ------------------------------- | ------- |
| `VITE_ENABLE_MONETIZATION` | client      | is the UI offered?              | off     |
| `feature.payments.enabled` | server flag | is the platform live?           | off     |
| Entitlement Service        | server      | may **this user** use **this**? | —       |

The first can neither grant nor protect anything. Only the third is authorization.

---

## 2. Premium gating — where it went, and why that is narrow

**This is the row's stated point, and it is the part where the row's premise did not survive contact
with the contract.** Both halves of "premium pieces (W1) and metered AI (W2)" were checked:

**Premium pieces do not exist.** `piece.entity.ts` has no premium or paywall column, `Visibility` is
public/unlisted/private, and no piece route consults the Entitlement Service. The reader's only
AI-adjacent section ("More like this") is a plain first-tag search, not AF4 recommendations. So there is
nothing in the reader to gate. That gap is owned by **B2**, held
([45 §4.5](./45_WebClientRoadmap.md#45-b2--premium-content-held-detail)) — W4 added nothing there.

**Metered AI is real, but narrower than the catalogue suggests.** Per
[48 §5.2](./48_PlatformParityRegister.md), the plan catalogue sells eight `PremiumFeature` codes and the
backend asserts exactly one:

| Feature         | Enforced by                                                           |
| --------------- | --------------------------------------------------------------------- |
| `ai_budget`     | `AiUsageMeterService.checkQuota` — the backend's only `assertAllowed` |
| the other seven | nothing; `PolicyEngineService.isEntitled()` still has zero callers    |

So the gating rule W4 follows is: **gate what the server enforces, badge what it does not.**

### 2.1 `PremiumGate` — one call site, and it is a real one

Gating an unenforced feature would be W3c-1 with the sign flipped — dead UI in front of a working route
instead of a dead button in front of a refusing one. So `PremiumGate` guards exactly one thing: the
**credit balance card**, on `ai_budget`.

That is a genuine gate rather than decoration. Credits are only spendable through an AI request, so an
account whose `ai_budget` is denied — a deny override, or a suspended standing — cannot spend one of
them; announcing "you have 5,000 credits" to someone the server refuses on every request is the
misleading half of the same defect class. Free accounts pass (`DEFAULT_PLAN_FEATURES` grants the free
tier `ai_budget`, confirmed live), so it withholds nothing from the ordinary viewer.

**It is deliberately not placed on the AI assistant**, even though that is where `ai_budget` bites, for
two reasons: `features/ai` may not import `features/monetization` ([26 §4](./26_FrontendArchitecture.md)),
and pre-hiding the assistant would regress W2 whenever monetization is dark. A denial there is better
explained after the fact than hidden in advance — which is what §2.2 does.

`PremiumBadge` annotates the viewer's tier on the hub and never gates.

### 2.2 The quota-exhausted state, which W2 half had

W2 already resolved a `quota` state from `GET /ai/usage/me` and from `QUOTA_EXCEEDED` /
`AI_USAGE_LIMIT_EXCEEDED`. What it did **not** have is the AF5-specific denial: `ENTITLEMENT_DENIED` and
`INSUFFICIENT_CREDITS` were unmapped, and an unmapped code returns `null`, which falls through to the
pre-flight answer — `available`. So a writer refused for either reason got a generic failure over a panel
still inviting them to try again.

W4 adds an `upgrade` state, kept distinct from `quota` because the remedies are opposites: an allowance
resets on its own and waiting is enough; a denied entitlement never resets and only a plan changes it.
It is the only blocked state carrying an action ("See plans"), and it says the writing is unaffected.

**Why it is reactive only.** Nothing in the AI module's own reads knows about entitlements — the denial is
raised by the monetization meter the orchestrator delegates to, at request time. Resolving it up front
would mean `features/ai` reading another feature's endpoint.

---

## 3. Entitlement caching — mobile's semantics, stated precisely

Mobile's `entitlement_cache_store` is the reference, and its staleness rules are unusual enough that the
port states them rather than implying them: **a fresh server response always wins; the cache is read only
when the server could not be reached; there is no TTL and `refreshAt` is not enforced as one; the floor is
deny.** It is a UX smoothing device so an offline reader keeps the gates they had a moment ago — never a
security boundary, because the server re-checks every premium action.

Two things the port got right that the naive shape would not have:

- **The offline fallback is in the `queryFn`, not `placeholderData`.** The first implementation used
  `placeholderData` alone; a unit test caught that TanStack serves placeholder data only while a query is
  _pending_ and drops it the moment it errors — so the snapshot vanished at exactly the moment it was
  needed. The fallback now catches `error.status === 0` (the api-client's offline/network class) and
  returns the cached snapshot. A 403 — which is what a withheld `billing.use` looks like — still errors,
  because that is an answer, not a lost connection.
- **The key lives in `lib/constants.ts` `STORAGE_KEYS`**, with the app's other localStorage keys, which is
  what lets sign-out clear it without `features/auth` importing this feature. It is the only user-scoped
  key there; theme, recent searches and reader typography belong to the browser and survive.

Stale times follow the data-class tiers ([12 §2.2](./12_StateManagement.md)): plans 1h (taxonomy —
admin-tunable config), subscription 60s (identity), entitlements **60s to match the server's own
`ENTITLEMENT_CACHE_TTL_SECONDS`**, usage/credits 30s (live — they move while the reader watches), history
5m (append-only ledgers).

---

## 4. Contract findings — recorded, not fixed

Five, all detailed in [48 §3.6](./48_PlatformParityRegister.md). Summarised by what they cost:

| #        | Severity | Finding                                                                                     | Client impact                                                          |
| -------- | -------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **W4-1** | medium   | `subscription/history` 404s where its three sibling ledgers answer an empty page            | Mapped narrowly to an empty page, else every free reader sees an error |
| **W4-2** | medium   | `@qalam/api-types` `RestorePurchasesResponse` has two of three fields wrong                 | Type declared locally from the controller                              |
| **W4-3** | —        | eight features sold, one enforced — see [48 §5.2](./48_PlatformParityRegister.md)           | Determined the whole gating design (§2)                                |
| **W4-4** | high     | **there is no inert payment port** — every provider including `manual` refuses without keys | Determined the E2E shape (§6) and the "payments unavailable" state     |
| **W4-5** | medium   | `@qalam/api-types` `ChangePlanRequest.couponCode` would 400 the whole plan change           | Promo field hidden from existing subscribers                           |

**The W3c-1 check this row asked for comes back clean.** All twenty routes are coarse-gated on
`BillingUse`, which `Role.User` holds, and **none asserts an entitlement** — the entitlement decisions
these routes return are data, not gates — so there is no AF5 route where the guard and the Entitlement
Service can disagree. Verified live on a **pre-existing** database, as instructed: every read answers 200
for the seeded writer, confirming the `billing.use` seed-grant defect fixed in `de61316` is closed in
practice and not just in code.

---

## 5. Mobile follow-ups this opened

Under the parity rule, two rows mobile now needs ([48 §3.7](./48_PlatformParityRegister.md)):

- **M5-1 · medium** — mobile's `PremiumGate` has **zero call sites**, while its own doc comment claims
  "every premium affordance elsewhere wraps its content in `PremiumGate`". No file imports it and no
  screen checks the snapshot either, so mobile computes entitlements correctly and gates nothing. The
  components exist; this is placement, not construction.
- **M5-2 · low** — `validateCoupon` is implemented end to end and called by nothing, and `plans_screen`
  passes no `couponCode`, so a mobile subscriber can never redeem a promotion.

---

## 6. Verification

Re-run in full at the register close-out (2026-07-29), across both repos:

| Check                             | Result                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Backend suite                     | ✅ **987 passed** (136 files) — +14 `ManualAdapter`, +9 api-types contract, +3 `listHistory` |
| Backend lint / tsc / `nest build` | ✅ clean                                                                                     |
| Migration                         | ✅ `1784620000000` applied, reverted and re-applied; index confirmed in `pg_indexes`         |
| `@qalam/api-types` build          | ✅ clean after the three corrections                                                         |
| Frontend unit suite               | ✅ **503 passed** (97 files)                                                                 |
| `eslint .` (frontend + e2e + be)  | ✅ clean, 0 errors 0 warnings                                                                |
| `npm run build`                   | ✅ (`tsc -b && vite build`)                                                                  |
| Bundle budget                     | ✅ within budget; entry unchanged at 144.1 kB gzip                                           |
| Mobile                            | ✅ `flutter analyze` **0 issues**; **572 tests passed** (+5 `formatMoney`)                   |
| Frontend E2E (functional + a11y)  | ✅ **105 passed**, chromium + dark, including the af5 payment assertion                      |
| Frontend E2E (visual)             | ⏸ **8 pages await their first baseline** — see §6.2, this is T-8 working as intended         |

### 6.1 The `af5` E2E row

**Updated 2026-07-29 (register close-out).** As shipped, this row asserted the entitlement leg end to end
and the subscribe leg only as far as the server's refusal, because [W4-4](./48_PlatformParityRegister.md)
found there was **no inert payment port** to run against: every adapter is key-gated and
`PaymentProvider.Manual` sat in the vocabulary with no implementation, so `manual` declined too.

`ManualAdapter` now fills that gap — a provider that settles a charge without a processor, off unless
`PAYMENTS_MANUAL_ENABLED` says otherwise. The row asserts the full chain:

1. **subscribe → payment → entitlement**, on a throwaway subscriber: a 499 succeeded payment, a paid
   invoice, `ai_writing` flipping to allowed, and the client rendering the new tier and the receipt.
2. **entitlement granted → the gate opens**, separately, via an admin override — both directions.
3. **the honest refusal**, still asserted, since a platform with its flag down is the default state.

Chosen over a Stripe test key because `StripeAdapter` makes a real call to `api.stripe.com` (a third-party
dependency and a flake class mid-suite), it would need a payment credential in CI, and it would not prove
more of what the row is about — Stripe's HTTP client and webhook HMAC are already covered offline by
`stripe.adapter.spec.ts`. **Stripe's redirect flow, webhook path, and provider-side state remain
unasserted** by the browser suite.

### 6.2 Visual baselines — T-8 changed what "green" means here

`playwright.config.ts` now sets **`updateSnapshots: 'none'`** ([48 T-8](./48_PlatformParityRegister.md),
closed at this pass), so a missing baseline **fails** instead of being silently written from the host's
browser. That is the fix, and it has an immediate visible consequence worth stating plainly rather than
hiding behind a filtered test run:

**Eight visual pages have no committed baseline** — the three W4 added (plans, billing hub, AI usage) and,
it turns out, five from W3 (collaborators, publishing, safety settings, comments, suggestions). Only eight
pages ever had one: login, register, not-found, editor, AI panel, settings, reader, feed.

So those five W3 pages had been **silently minting host-rendered baselines on every local run since W3**,
which is precisely the failure T-8 described and the reason its fourth occurrence was treated as decisive.
They now fail honestly and are queued for the same mint.

Verified twice over: a local run of a baseline-less spec failed and left the 44-file snapshot inventory
byte-identical (checksummed before and after, plus a clean `git status`), and the same spec with an explicit
`--update-snapshots` still wrote its PNG — which was then deleted. The `web-e2e-visual` job passes that flag
inside the pinned image, so the one sanctioned mint path is untouched.

### 6.3 Pre-existing E2E flakes, measured

The full frontend suite has a **latent flake under parallel load** — already recorded as
[48 T-7](./48_PlatformParityRegister.md), which established it during W3c by stashing every change. It was
re-measured independently here, the same way: stash **every** W4 change, rebuild, run the suite; then
restore and run it again.

| Condition                 | Runs | Fully green | Runs with one failure | Tests that flaked                                                        |
| ------------------------- | ---- | ----------- | --------------------- | ------------------------------------------------------------------------ |
| pre-W4 baseline (stashed) | 3    | 1           | 2                     | `assistant.spec.ts:60` ×1, register-page a11y (dark) ×1                  |
| with W4 (137 tests)       | 7    | 1           | 6                     | `assistant.spec.ts:60` ×4, register a11y ×1, `publishing.spec.ts:116` ×1 |

Three conclusions, and the third is the one that matters:

1. **The same tests fail with W4 entirely removed**, so they are pre-existing and unrelated. Each passes
   in isolation (verified for all three) and fails only in a loaded 8-worker run.
2. **The flake set is wider than T-7 records** — `assistant.spec.ts:60` is the frequent one, but the
   register-page a11y scan and `publishing.spec.ts:116` join it under contention. Worth folding into T-7,
   which currently names only the first.
3. **No W4 test failed in any of the ten runs**, baseline or otherwise, and one W4 run was fully green at
   137/137.

CI runs `retries: 2`, so all three are absorbed there; locally retries are 0 by design, which is why they
are visible at all.

---

## 7. Scope

Exactly the surfaces the row named. Nothing else was added, and three things were deliberately **not**
built:

- **No reader gating** — there is no premium-content model to gate (B2 owns it).
- **No credit-pack purchase** — `POST /credits/purchase` rejects an empty receipt before it reaches a
  provider, and a browser has no receipt to send. The page explains where credits come from instead of
  offering three buttons that could only fail.
- **No "restore purchases"** — same reason: store-receipt-only, so it has no browser path. The api method
  exists for contract completeness and is wired to no control.
