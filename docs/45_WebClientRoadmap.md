# 45 — Web Client Roadmap (W-track)

**Status:** 🚧 In progress · **Scope:** close the gap between a backend/mobile that shipped AF1–AF6 and
two web clients that did not. **No new backend platforms.** Every epic below consumes a contract that
already exists and is already exercised by the mobile app; the one exception (B1) is a deliberately
additive read endpoint, justified in §3.

> **The shape of the problem.** Every AF epic shipped **backend + mobile** and deferred **frontend +
> admin**. The backend is complete through P7.4; mobile is complete through M10 + AF1–AF6. The web
> reader/writer app is missing whole surfaces — most starkly, it could publish a piece but not
> **read** one (closed by W1 on 2026-07-27). This doc is the ordered plan to close the rest, and it is the analog of
> [`18_DevelopmentRoadmap.md`](./18_DevelopmentRoadmap.md) for the web clients.

---

## 1. Current state — what actually exists

Measured, not assumed (routes read from `frontend/src/lib/routes.ts` and `admin/src/lib/routes.ts`).

| Surface       | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend**   | ✅ Complete through P7.4 + AF1–AF6.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Mobile**    | ✅ Complete: M1–M10, AF1–AF6, P7.1–P7.4. The most feature-complete surface, and the **reference implementation** for every W-track epic.                                                                                                                                                                                                                                                                                                                                                                                               |
| **Frontend**  | Features: `auth, feed, writing, profile, search, settings, notifications, analytics, ai, reading`. `reading` ✅ shipped (W1); `ai` ✅ has its first surface (W2 — in-editor assistant + Craft Coach); `collaboration` ✅ (W3); `monetization` ✅ (W4 — all five surfaces).                                                                                                                                                                                                                                                             |
| **Admin**     | 31 route modules — users, moderation, analytics, audit, security, privacy, system, ten operations consoles, AI settings. ~~**Nothing for AF3, AF4, AF5, or AF6.**~~ **Corrected 2026-08-19:** AF5 shipped with A1 + B8 (seven billing routes), AF6's admin half is trust and shipped with A2 + B9, and AF4's shipped with A3 (retrieval config + search analytics). **AF3 remains the only one with no admin surface** — `story-intelligence` has no admin controller, which is why A4 is a backend expansion rather than a client row |     |
| **Marketing** | Built (`qalam-web`); blocked only on config — Firebase values, domain, socials.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

## 2. The per-epic flow (unchanged from AF1–AF6 / P7.x)

Every epic below follows the pipeline this project has used throughout. It is not negotiable per-epic;
it is what makes each landing reviewable.

1. **Design first** — this doc, or a numbered successor for anything large enough to need its own.
2. **Backend enabler only if genuinely missing.** Default is none. The platforms exist; the clients
   consume them. Any enabler must be **additive** under the [freeze policy](./25_BackendFreeze.md).
3. **Client implementation** against the frozen contract, reusing the `@qalam/ui` tokens, the `qk.*`
   query factory ([12 §2](./12_StateManagement.md)), the response-envelope + error conventions
   ([05](./05_APIStandards.md)), and the existing page-object/selector policy for testability.
4. **Green locally**: unit tests → `tsc --noEmit` → `eslint` → app builds.
5. **E2E**: flip the ⏸ row in [e2e/06 §2](./e2e/06_PhasePlan.md) to ✅, add the spec, regenerate
   baselines **in the pinned image, light _and_ dark** ([e2e/10 §3.3, §8.3](./e2e/10_UIQuality.md)).
6. **Readiness report** + a single epic commit.
7. **Parity check** against [48 — Platform Parity Register](./48_PlatformParityRegister.md): confirm
   the epic delivered **only** what its row named, that the platform being ported from actually
   contains every part that was built, and that any remaining difference is recorded. Web and mobile
   ship the same features; a divergence is acceptable only when the register owns it.
8. **Reconcile the open ledger** — [48 §3.22](./48_PlatformParityRegister.md#322-the-open-ledger-verified-2026-08-20),
   added 2026-08-20. Fixed a ledger entry? Delete the line **and** strike its §3 diagnosis, in the same
   commit as the fix. Opened one? Add it **with a `file:line` anchor and today's date**. Read the code an
   entry points at without touching it? Re-date the anchor. **A finding may not be scheduled, sized, or
   reported from a §3 heading** — only from a ledger line whose anchor you have just re-verified. Two
   passes in a row scheduled work that was already done (eight stale entries, four of them three weeks
   old); this step is what stops the third.

> **Nothing is built that is not on this list.** Each epic ports the surface its row names from the
> platform that already has it. Extra scope — however small and however tempting — is an unplanned
> web/mobile divergence that a later epic has to reconcile; it already happened once and is recorded
> in [48 §3](./48_PlatformParityRegister.md).

> **Dark mode is not optional in step 5.** It shipped once with no coverage and was materially broken
> ([e2e/10 §8.4](./e2e/10_UIQuality.md)). Every new surface is scanned in both themes, and computed
> contrast ratios against the documented tokens are **not** accepted as evidence — only a rendered
> scan is.

---

## 3. B1 — the one backend enabler: read a piece by slug

**The gap.** `GET /pieces/:id` is guarded by `ParseUUIDPipe` — it accepts UUIDs only, and no by-slug
read exists. But the web URL scheme is already slug-based and shipped: `routes.ts` builds
`/p/${idOrSlug}`, and feed cards, search results and notification deep links all emit slugs. The
reader page (W1) therefore **cannot be built against today's API**.

**Options considered.**

| Option                                    | Verdict                                                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Add `GET /pieces/by-slug/:slug`**       | **Chosen.** Purely additive, which the freeze policy permits; preserves slug URLs, SEO, and every already-shipped deep link. |
| Relax `pieces/:id` to accept slug-or-UUID | Mutates a frozen endpoint's contract and discards `ParseUUIDPipe`'s validation. Rejected.                                    |
| Switch URLs to `/p/:id`                   | No backend change, but forfeits SEO and breaks shipped notification + mobile deep links. Rejected.                           |

**Contract.** Mirrors `getById` exactly — `@Public()` + `OptionalAuthGuard`, same visibility rule
(published + visible; the owner sees any status), same `PieceResponseDto`, same
`PieceNotFoundException` on miss. Only the lookup key differs. A slug is unique across live **and**
soft-deleted rows ([04 §1.5](./04_DatabaseDesign.md)), so it is a safe identity.

---

## 4. Track W — the web app (sequential)

| #      | Epic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Size      | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Unblocks                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **B1** | By-slug read endpoint + freeze amendment ✅ **done**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | S         | Hard prerequisite for W1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | W1                                                                                                                          |
| **W1** | **Reader page** `/p/:slug` ✅ **done**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | M         | The product hole. Backend contract and mobile's full `reading` feature both exist to port from — [report](./46_WebReaderReadinessReport.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | E2E reader row; W3, W4                                                                                                      |
| **W2** | **AI writing assistant UI** (AF2) ✅ **done**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | S–M       | The data layer is already built — best value-to-effort ratio on the list — [report](./47_WebAiAssistantReadinessReport.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | E2E `af2` row                                                                                                               |
| **W3** | Collaboration / publishing / trust (AF6) — **3 slices, [design](./49_WebCollaborationEpicDesign.md)**                                                                                                                                                                                                                                                                                                                                                                                                                                                 | L         | Touches both the editor and the reader, so it needs W1 and W2 to exist first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | —                                                                                                                           |
| **W4** | Monetization (AF5) ✅ **done**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | M         | ⚠️ This row's stated premise was half wrong — **premium pieces do not exist** (see B2). Its one real gate is metered AI (W2) — [report](./50_WebMonetizationReadinessReport.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | E2E `af5` row ✅                                                                                                            |
| **B2** | **Premium content** — enabler + both clients ⏸️ **HELD**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | S–M + M×2 | **Held 2026-07-29 at the user's decision: recorded, not scheduled.** Model chosen (tier-gated); see [§4.5](#45-b2--premium-content-held-detail)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ~~the first real `isEntitled` caller~~ — **D4's build wrote it 2026-08-24**; B2 inherits the pattern rather than setting it |
| **W5** | AF4 retrieval-backed discovery / search ✅ **DONE 2026-08-04** — [report](./51_WebDiscoverySearchReadinessReport.md)                                                                                                                                                                                                                                                                                                                                                                                                                                  | M         | An upgrade of the existing M3/M6 `/discover` + `/search` surfaces rather than a new one. Three phases: audit + data layer, the four surfaces, then E2E/a11y/visual — see [§4.6](#46-w5--af4-retrieval-backed-discovery--search-detail)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | —                                                                                                                           |
| **W6** | AF3 story-intelligence client                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | L         | **Held** — but the rationale below was **corrected 2026-08-05**: the _reading_ half already has a client. Scope is the **analysis lifecycle** only; see [§4.8](#48-w6--what-is-actually-left-in-it-corrected-2026-08-05)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —                                                                                                                           |
| **W7** | Engagement & parity backfill (**both clients**) ✅ **DONE 2026-08-10 (W7a/W7b/W7c) + P-2 2026-08-17** — marked 2026-08-20; the detail table below had said so since 2026-08-17 while this cell carried no status at all. **Onboarding is the one item left**, and it needs a product shape first                                                                                                                                                                                                                                                      | M–L       | Closes the unowned gaps [48 §5](./48_PlatformParityRegister.md) has been flagging: conversation layer on web, collections, clap/report, reader analytics, privacy prefs, and **P-2** (composing @mentions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | —                                                                                                                           |
| **W8** | Remaining AI surfaces ✅ **DONE 2026-08-05** — [report](./52_WebAiSurfacesReadinessReport.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                         | M         | AI conversations, prompt library, AI usage — mobile-shipped, no W row owned them. Ended up **web-only**: the step-0 audit found mobile's conversations list cannot be populated at all ([48 §3.12](./48_PlatformParityRegister.md) W8-1), so web is now the working reference for that surface. ~~Four mobile/platform follow-ups recorded, not fixed~~ — **W8-1 and W8-2 both closed** (mobile `5d055a5` + backend `b45ac03`, 2026-08-05), and their pairing defect **W8-6** — archive became a one-way trip on mobile once the list filtered by status — **fixed on both clients 2026-08-19** ([48 §3.21](./48_PlatformParityRegister.md)). W8-3/W8-4 (message shapes, low) remain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | —                                                                                                                           |
| **W9** | **AF4 story consumers web port** — Story Explorer + Ask My Book ✅ **DONE 2026-08-08**                                                                                                                                                                                                                                                                                                                                                                                                                                                                | S–M       | Opened 2026-08-07. Both are AF4 consumers of the AF3 graph (`retrieval/consumers/story-explorer.controller.ts`, `retrieval/consumers/ask-book.controller.ts`), not the held analysis lifecycle — see the [§4.8](#48-w6--what-is-actually-left-in-it-corrected-2026-08-05) correction. Shipped as two more tabs on W2's in-editor AI drawer, gated on a synced draft; the pre-flight audit found the contract sound and four projection behaviours the summary did not state — see [§4.12](#412-w9--af4-story-consumers-detail-done-2026-08-08)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                                                                           |
| **D1** | **Decision:** what does accepting a suggestion mean? ✅ **ANSWERED 2026-07-29** — server-side rewrite (`f6827e0`)                                                                                                                                                                                                                                                                                                                                                                                                                                     | S         | **P-1**, [48 §5.1](./48_PlatformParityRegister.md) — correctness-shaped; a product call, not an engineering one                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | the client half of P-1                                                                                                      |
| **D2** | **Decision:** does the reader's "more like this" get its backend enabler, or is the upgrade formally dropped? ✅ **ANSWERED + BUILT 2026-08-04, inside W5; both clients ported 2026-08-07**                                                                                                                                                                                                                                                                                                                                                           | S         | **W5-2**, [48 §3.9](./48_PlatformParityRegister.md). Built as part of W5 itself, not as a separate decision row — `relatedToPiece` (`acdd2e1`) + web's `useRelatedPieces` (`3919c7a`) ship, and mobile's `related_pieces_controller.dart` now ports the same recommender-first/tag-search-fallback behaviour (`qalam-mobile ef40cdf`). **Row fully closed on both clients.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | —                                                                                                                           |
| **D3** | **Decision:** is the free tier meant to have AI writing, or only a token budget? ✅ **ANSWERED 2026-08-08 — NEITHER: free gets no AI writing** · ✅ **BUILT 2026-08-17**                                                                                                                                                                                                                                                                                                                                                                              | S         | [48 §5.2](./48_PlatformParityRegister.md) item 4 + the sweep in [48 §6.13](./48_PlatformParityRegister.md). **Shipped 2026-08-17** in four commits — `bda3f08` (the map + the server gate), `390c1ac` (the existing-deployment audit), `af8448f` (web), `a826103` (mobile). What landed: a TOTAL `AiFeature → PremiumFeature` map in `@qalam/shared` (pinned by `satisfies` + a mutual-extends assertion, so a future AI feature that forgets to declare itself fails the build), the gate inside `AiUsageMeterService.checkQuota` beside the existing `assertAllowed(AiBudget)` — the one place every AI request already passes through, and the one that already returns early when payments are dark — and both clients gated through their OWN existing `PremiumGate` with a distinct FOURTH remedy (`upgrade-writing` on web, `AiErrorCopy.aiWritingLocked` on mobile), pinned apart from `AI_DISABLED`, `AI_DISABLED_BY_USER` and `QUOTA_EXCEEDED` by tests on both. Five AI features are sold behind `ai_writing`: `writing_assistant`, `craft_coach`, and the three vestigial AF1 codes. **Consequence (a) was NOT done, deliberately, and the doc's premise for it was wrong.** 48 §5.2 asked for free's `ai_budget` to be removed or zeroed as "an allowance that cannot be spent"; that was written before AF4 shipped. `ask_book` and semantic-search synthesis both route through `AiCompletionService.complete()` and therefore meter against `ai_budget`, and both are live on both clients — so free's allowance IS spendable. Removing it would have denied free users every metered AI feature, far wider than D3 decided, and would have pre-empted D4. Free keeps `ai_budget`; only writing is gated. (`recommendations` does NOT meter — it makes no model call — so it is two of the three, which does not change the answer.) Consequence (b), enforcement, is what shipped. ⚠️ **The behaviour REGRESSION for existing free users is LIVE from `bda3f08`.** No grandfather clause, no grace period, no free trial of the assistant — none was asked for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | D4 (now has a floor)                                                                                                        |
| **D4** | **Decision:** do the seven unenforced premium feature codes get a backend row? ✅ **ANSWERED 2026-08-21** — gate `story_intelligence`, declare the other five included in every tier · ✅ **BUILT 2026-08-24 (backend + mobile)** — `6fab0fe`, `qalam-mobile fd0778c` · ✅ **FULLY BUILT 2026-08-24** — backend, mobile, web, and the catalogue                                                                                                                                                                                                       | M         | [48 §5.2](./48_PlatformParityRegister.md). The catalogue sells eight `PremiumFeature` codes and the backend asserts exactly **one** (`ai_budget`); `PolicyEngineService.isEntitled()` has zero callers, so a subscriber's plan is computed correctly and then ignored on every route but the AI meter's. ~~Until answered, **no client may gate on the seven** — a client-only wall in front of a route the server serves.~~ ~~Depends on **D3**~~ — ~~**D3 is answered (2026-08-08) and D4 is UNBLOCKED but the owner has DEFERRED its scope: "will decide this later what enforcement we will do."**~~ _(both struck 2026-08-24 — answered; the surviving rule is at the end of this cell)_ What D3 fixed is that D4 now has a **floor rather than a blocker**: `ai_writing` must be enforced for D3 to mean anything, so the open question is no longer _whether_ to enforce but _how far past `ai_writing`_ to go. Three scopes were put to the owner — (a) only what D3 needs: `ai_writing` + zero free's `ai_budget`; (b) all seven; (c) the five AI codes only, leaving `advanced_analytics` + `publishing_pro`. **ANSWERED 2026-08-21, and none of the three:** each of the six was checked against the live screens instead, and five turned out to be **already free and in real use on both clients** — gating them would repeat D3's `ai_writing` regression without D3's sign-off. `story_intelligence` is the one exception (its Story Explorer ships, but nothing populates the graph, so enforcing it costs nothing observable **today** and would cost the same as the other five once either client ships an analyze trigger). **Built 2026-08-24:** the five AF3 analysis kinds map through `AI_FEATURE_PREMIUM_CODE`, and a new `StoryIntelligenceService.assertGraphReadEntitled` — dark-launch-aware — guards all six graph reads plus the AF4 explorer consumer, deliberately outside the `getGraphSnapshot` seam that Recommendations and Ask My Book share. Mobile wraps the Explorer body (not its Ask My Book action) in `PremiumGate`. **Web shipped 2026-08-24**, the same shape mobile took: `explorerGate` beside D3's `writingGate`, a dark-launch branch ahead of the gate (a `PremiumGate` alone would sell a plan for a feature that has not shipped, on a plans page that is switched off), availability resolved before entitlement, and Ask My Book left ungated per the decision. It disarmed the Story Explorer a11y scan on the way — caught and fixed in the same change, the fourth instance of that pattern and the first caught before landing. **The catalogue half shipped the same day**, and it was not the edit it looked like: a stored `monetization.plans` row shadows the compiled defaults wholesale, so editing `DEFAULT_PLAN_FEATURES` would have been inert on every existing deployment (the trap D3 escaped by needing no such edit). The five are unioned in at resolution from `UNIVERSAL_PLAN_FEATURES` instead — code, no migration — and both clients inherit it without a change, because each renders `plan.features` as the server sends it. Live-verified against a pre-decision database: free went from `[ai_budget]` to carrying all five, with `ai_writing` and `story_intelligence` still denied. **D4 is fully closed.** **The "no client may gate" rule now covers FIVE codes** — `ai_writing` and `story_intelligence` are out, and for the remaining five it is permanent rather than provisional | B2 shares the enforcement path                                                                                              |
| **D5** | **Decision:** the product leads with "AI" and sells prose generation, which this audience rejects. Remove the AI _surface_, keep the tools. ✅ **ANSWERED 2026-09-02** — Polish · Manuscript feedback · Story Map; generation, Ask My Book, conversations and the credit economy removed; per-feature action allowances replace the token budget; user-facing copy only. 🔨 **BUILDING** — **backend COMPLETE** 2026-09-03 (B1–B4: `9214fc6`, `7f3b459`, `952a790`, `d4d03b6`); V (vocabulary contract), C (table drops) and BOTH CLIENTS outstanding | L + M×2   | **Owner decision, 2026-09-02.** Literary writers and poets reject AI branding and specifically reject prose _generation_ and covert use of their manuscripts; today the paid headline is the Writing Assistant's `continue`/`rewrite`/`expand`/`tone`/`freeform`. **Kept, renamed:** `improve`/`simplify`/`condense` → **Polish**; Craft Coach → **Manuscript feedback**; Story Intelligence + Explorer → **Story Map**. **Removed:** Ask My Book, AI conversations, prompt library, the AI hub, the user-facing token page, the B5 switch UI, and the credit economy. **Search and recommendations were already non-LLM** — only search's optional "AI answer" called a model — so they became ordinary public product surfaces rather than needing a new engine. Tiers unchanged: Polish + feedback on `ai_writing` (Plus+), Story Map on `story_intelligence` (Pro+). **Rename scope is user-facing copy only**: `/ai/*` paths, `feature.ai.*` keys, the `ai` module and `AiFeature` wire values all stay. Disclosure is one line inside each tool plus a privacy-policy clause, not a switch — see [48 §5.2](./48_PlatformParityRegister.md). **D5 also partially revives the AF3 analysis lifecycle** that [48 §3.22d](./48_PlatformParityRegister.md) scoped out on 2026-09-01: "Map this story" is the first client-reachable `analyze` trigger, and the reason Story Map stops being a viewer of graphs nobody can build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Supersedes D3's free-tier reasoning; B2 unaffected                                                                          |
| **B3** | Profile lookup by **id** (both clients) ✅ **DONE 2026-08-08**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | S         | Recorded 2026-08-05 after being carried in three consecutive epics' "improvements not done" lists. Retrieval, collaboration and publishing DTOs all carry user **ids**, but `GET /users/:username` is keyed by username — so every W3c surface (reviewer, snapshot author, history actor, blocked person) shows a **truncated id to real users**. Three slices worked around it; it is a missing contract, not a nicety. Additive backend enabler + both clients. **Shipped:** `GET /users/by-id/:id` — same guards, same `ProfileResponseDto`, same 404, same private-account teaser as the username route, both delegating to one `buildPublicView` so the visibility rules cannot drift. Web routes every id through `useCollaboratorIdentity`; mobile gained the shared `actorProfileProvider` + `ActorName`/`ActorAvatar` it never had, sweeping **ten** call sites (the six listed, plus the member row, the two role/remove snackbars, the presence bar and publication history). Cost is one request per DISTINCT user, not per row — see [§4.13](#413-b3--profile-lookup-by-id-detail-done-2026-08-08)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | W7's reader-analytics rows                                                                                                  |
| **B4** | **Piece limit per plan** — enabler + both clients ✅ **done 2026-08-08**                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | S + S×2   | **New feature, requested and specified 2026-08-05.** A cap on how many pieces an author may have, by subscription tier. The first premium feature to gate the product's **core write path** rather than AI tooling. Full spec, including the three decisions already taken, in [§4.9](#49-b4--piece-limit-per-plan-detail)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | —                                                                                                                           |
| **B5** | **Per-account "turn AI off"** — enabler + both clients ✅ **DONE 2026-08-08**                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | S + XS×2  | **New feature, requested and specified 2026-08-05.** An author disables AI for their own account. Server-enforced; governs the user, not the story. Cheap because `GET /ai/features` already answers "which AI features are enabled **for you**" and both clients already consume it — see [§4.10](#410-b5--per-account-turn-ai-off-detail)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | —                                                                                                                           |
| **B6** | **Collaborators per story, by plan** — enabler + both clients ✅ **done 2026-08-08**                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | S + S×2   | **New feature, specified 2026-08-05.** Free 0 · Plus 3 · Pro/Ent unlimited, counted against the **story owner's** plan. The seat lever — collaboration becomes a paid capability. Shipped with the sentinel **inverted for this key alone** (`-1` unlimited, `0` none) because `0` already means unlimited everywhere else. Spec + what shipped: [§4.11](#411-b6--collaborators-per-story-by-plan-detail)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —                                                                                                                           |
| **B7** | **Version-history depth, by plan** — enabler + both clients ✅ **DONE 2026-08-08**                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | S + XS×2  | **New feature, specified 2026-08-05.** Free 5 · Plus 25 · Pro/Ent unlimited. **Hidden, never deleted** — a read-time clamp, so upgrading restores history retroactively. Spec: [§4.12](#412-b7--version-history-depth-by-plan-detail)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | —                                                                                                                           |

### 4.1 W1 — Reader page (detail)

New `frontend/src/features/reading/`, route `/p/:slug`, public with `OptionalAuthGuard` semantics.
Ported from mobile's `lib/features/reading/`, which already solves every hard part:

- **Content rendering** — TipTap JSON → React, reusing the existing `.qalam-prose` class, which
  [already styles both the editing surface and the read-only preview](../frontend/src/styles/global.css)
  so what a writer sees is what a reader gets. Only the whitelisted node/mark set the server accepts.
- **Reader preferences** — font size / theme, mirroring mobile's `reader_preferences_controller`.
- **Engagement** — like / bookmark / share bar (mobile's `engagement_controller`).
- **Author card + related pieces** — mobile's `reader_author_card` (author card only) plus a "More
  like this" section. ⚠️ Read [48 §3](./48_PlatformParityRegister.md): at the time this bullet was
  written the named mobile widget contained **no** related pieces, so the section was an unplanned
  web-first divergence (`W-1`), closed on 2026-07-28 by porting it to mobile. The lesson stands for
  every remaining row — open the named reference and confirm it contains what the bullet claims.
- **RTL** — Urdu/Nastaliq flows from the element `dir`, with the `--q-leading-nastaliq` leading token.
  This is a day-one requirement, not a follow-up ([07 §Typography](./07_DesignSystem.md)).
- **SEO/meta** — the reason the slug URL exists at all; a piece page needs real title/description tags.

**E2E impact:** flips the reader row, adds `reader.spec.ts`, and upgrades the feed/search specs from
link-URL assertions to real render assertions — the deferral recorded in
[e2e/06 §4](./e2e/06_PhasePlan.md) is discharged here.

> ✅ **Shipped 2026-07-27.** All of the above landed, plus the a11y/visual/responsive coverage in
> both themes. Two boundaries were drawn deliberately: clap/respond stay read-only counts (the
> engagement epic owns them), and "more like this" is a tag search rather than the AF4 recommender,
> which requires auth + `ai.use` and so cannot serve a signed-out reader — W5 upgrades it. Full
> accounting, including the shared-code move-down the author card forced, in
> [46](./46_WebReaderReadinessReport.md).

### 4.2 W2 — AI writing assistant UI (detail)

Only components and a route are missing. Wire the existing `use-ai-completion` / `ai-stream.store`
into the editor as a side panel: streaming output, suggestion accept/reject, and the Craft Coach
surface. Mobile's `features/ai` is the reference. Must be built with W4's metering in mind — every AI
request meters through the `AI_USAGE_METER` hook, so the UI needs a quota-exhausted state from day one.

> ✅ **Shipped 2026-07-27.** All of it, plus a11y/visual coverage in both themes. The editor and the
> AI feature meet at an app-level `AiEditorTarget` seam (mobile's pattern) rather than importing each
> other, so the AI never mutates the document — it hands text to the editor, which applies it through
> its own commands. **One gap is explicitly open:** the E2E stack configures no AI provider and the
> flags are dark-launched, so a _generated suggestion_ is not asserted end to end; closing it needs an
> inert AI port in the stack, tracked in [e2e/06 §6](./e2e/06_PhasePlan.md). Full accounting in
> [47](./47_WebAiAssistantReadinessReport.md).

### 4.3 W3 — Collaboration / publishing / trust (detail)

Size **L**, so it lands in **three independently-green slices** rather than one commit. Full design,
including the verified reference audit and the two deliberate departures from mobile, is
[49](./49_WebCollaborationEpicDesign.md). Ported from mobile's `lib/features/collaboration/`
(6 screens + `CapabilityGate`/`PresenceBar`/`RoleBadge`), which was opened and checked
surface-by-surface first.

| #       | Slice                           | Surfaces                                                                                                          | Status                                                                                                                                                                                                                                                                                                                                                                           |
| ------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **W3a** | Collaboration core (membership) | collaborators page, invite dialog, story invitations, invitations inbox + the three shared components             | 🟢 unit + **E2E green** (6/6 functional, a11y light **and** dark); only the visual baseline is outstanding — CI must mint it ([49 §6b–6d](./49_WebCollaborationEpicDesign.md))                                                                                                                                                                                                   |
| **W3b** | Inline review                   | comments (general + inline anchors, threads, resolve, @mentions), suggestions (accept/reject/withdraw + conflict) | 🟢 **shipped** `0c0de84` — unit + **E2E green** (5/5 functional incl. the conflict state, a11y light **and** dark); built from the DTOs, not ported ([49 §6f](./49_WebCollaborationEpicDesign.md))                                                                                                                                                                               |
| **W3c** | Publishing + trust              | review→approve→publish, snapshots + revert, publication history, restricted-state walls, blocks/mutes             | 🟢 **shipped** — unit + **E2E green** (9/9 functional, 33/33 a11y light **and** dark); ported from mobile's repaired screens, blocks/mutes built from the DTOs ([49 §6g](./49_WebCollaborationEpicDesign.md)). All four hand-off defects now fixed ([49 §6h](./49_WebCollaborationEpicDesign.md)); the owner now approves their own review, so that flow is one actor end to end |

**Status of W3 as a whole (2026-07-29): all four hand-off defects fixed, ONE gate still open.**
W3c-1 and W3c-4 landed in `2b0cf50`; W3c-2 and W3c-3 (the two shared-theme contrast defects) in
`1e4d526`, which also **deleted** the pointer-parking workaround rather than leaving it to hide the next
regression. Functional + a11y are green in light and dark on all three slices.

**The contrast class behind W3c-2 is now closed properly too (2026-07-29, [49 §6i](./49_WebCollaborationEpicDesign.md)).**
`success` was the colour a scan happened to reach, not the only one failing: the label and the fill were
the same token, so every tinted colour was measured against itself. Fixed structurally with a per-family
`-on-tint` label token — fills untouched — which closes **T-2 and T-3** and the same pairing in seven
other components. A permanent a11y spec now renders every QTag colour on all three backgrounds in both
themes, so the next bad token fails CI instead of waiting for a page to paint it.

**W3 is _not_ closed. One gate remains: the visual baselines.** It could not be minted here — there is no
GitHub credential in this environment (`gh` absent, no token, no credential helper), so `develop` cannot be
pushed and `web-e2e` cannot be dispatched. Minting locally is forbidden by
[e2e/10 §8.3](./e2e/10_UIQuality.md), which this work respected: nothing was generated on this host and no
image is committed.

**The mint must now re-mint ALL baselines, not the missing ones.** The re-tint changes tags, notification
glyphs, toolbar active states, the offline banner and admin's login error, so every committed baseline is
**stale**, not merely absent — a gap-filling run would leave the nine existing ones describing the old
palette. The four specs that were missing (`story-publishing`, `settings-blocks`, `comments`,
`suggestions`) now exist, so the full set is 13 pages. **To close:** push `develop`, run `web-e2e` with
`update_visual_baselines: true`, review the diff, commit the artifact.

**No backend enabler** — every surface maps to an existing AF6 route (flow step 2's default).

**Availability:** dark-launched behind `VITE_ENABLE_COLLABORATION` (default `false`), mirroring
mobile's default-off `QALAM_ENABLE_COLLABORATION`; E2E runs with it enabled. The server's
`feature.collaboration.enabled` **fails open**, so unlike W2's AI gap there is no untestable surface here.

> ⚠️ **One reference was found broken, not missing.** Mobile's invite sends `{role, email}` where the
> contract requires `{inviteeId, role}` under `forbidNonWhitelisted`, so every mobile invite 400s. W3a
> builds the contract-correct flow instead of porting a broken one; the mobile defect is logged as
> **M-1** in [48 §3.1](./48_PlatformParityRegister.md). The W-1 lesson generalizes: check the
> reference's actual request shape against the DTO, not just its screen list.

---

### 4.4 W7 / W8 / D1 — closing the unowned gaps (detail)

[48 §5](./48_PlatformParityRegister.md) has listed these as _tracked but unowned_ since the register
was written, with the explicit note that they need "a roadmap decision, not more building". These rows
are that decision. They are **last** on purpose: every one of them is a gap on _one_ client with the
other already shipped, so nothing is blocked on them — unlike W3–W6, which closed a total absence.

**W7 — engagement & parity backfill.** Mostly mobile → web, one item on both.

**Sliced, by the W3 → W3a/b/c and W5 → three-phase precedent.** Six scopeable items in one M–L row is
not one epic: **W7a** = the conversation layer (rows 1–2, ✅ **done 2026-08-10** —
[report](./53_WebConversationLayerReadinessReport.md)); **W7b** = collections + clap/report (✅ **done
2026-08-10** — [report](./54_WebEngagementReadinessReport.md)); **W7c** = reader analytics + privacy
prefs (✅ **done 2026-08-10** — sweep [48 §6.10](./48_PlatformParityRegister.md)); **P-2** (@mentions) stayed its own
item because it touches BOTH clients (✅ **done 2026-08-17**, both the same day — sweep
[48 §6.11](./48_PlatformParityRegister.md)); onboarding stays blocked on a product shape for web.

**W7's only open item is now onboarding**, and it is not an engineering task until web has a product
shape for it. Every other item in the table below has shipped or is closed by evidence — including
the two mobile follow-ups this row opened, **M7-1** and **M7-3**, both closed 2026-08-17.

> **W7c is the third slice to correct this row, and it corrected it twice.** Row 4 said web had "writer
>
> - per-piece analytics only" — but all seven reader fields were **already rendering**, inside the
>   writer dashboard, so the work was a **move** to `/me/reading` as much as a build. Row 5 turned out to
>   need **no code at all**: its one server-backed control already shipped and its other two are local
>   display gates with nothing cross-user to enforce, so it is **closed-not-built**. Both rows also
>   shrank: mobile's Continue Reading / Recently Read / Weekly Activity read a device store the frozen
>   `v1` has no endpoint for, and are now recorded as **platform-inherent**
>   ([48 §4](./48_PlatformParityRegister.md)) rather than left as an unexplained absence. This is the
>   third §2 cell in the W-track to misdescribe what a client already had (cf. **W8-1**, **M7-3**).

> **W7b corrected this row's direction on one item.** The table below said `mobile → web` for all of
> clap/report. Report was a straight port; **the clap was not, because mobile has no clap control at
> all** — [48 §2 row 5](./48_PlatformParityRegister.md) credited it with one and was wrong
> ([48 §3.15](./48_PlatformParityRegister.md), **M7-3**). Web is now the reference for the clap
> interaction, and mobile owns the follow-up. Escalated before any code was written, because building a
> web surface mobile lacks is the one failure mode [48 §1](./48_PlatformParityRegister.md) names.
>
> **That follow-up closed on 2026-08-17** — mobile now has the clap, ported from web across three
> commits (`a5f27c8` data, `85d34c9` controller, `0c4b1e8` UI; 22 tests). It is the only row in the
> W-track where mobile did the porting, and mobile ended with **more** than the reference: an offline
> burst queues onto its durable outbox, which web has no story for. Sweep:
> [48 §6.12](./48_PlatformParityRegister.md).

| Item                                                                                        | Direction                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Piece comments (thread, replies, edit, tombstone) ✅ **DONE 2026-08-10 (W7a)**              | mobile → web                   | Distinct from AF6 collaboration comments, which are a story's private review. Shipped **inline on the reader**, not as a route — [48 §4.1](./48_PlatformParityRegister.md); [report](./53_WebConversationLayerReadinessReport.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Responses (public list + write → editor) ✅ **DONE 2026-08-10 (W7a)**                       | mobile → web                   | A response IS a piece: `POST` creates a linked draft and the flow ends in the editor, so there is no inline composer on either client. List is public; the write is gated on `piece.create`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Collections (list + detail) ✅ **DONE 2026-08-10 (W7b)**                                    | mobile → web                   | 48 §2 item 4. Shipped on the SAME paths mobile uses (`/me/collections`, `/me/collections/:id`), reached from web's account menu — [48 §4.1](./48_PlatformParityRegister.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Report (piece · comment · response · user) ✅ **DONE 2026-08-10 (W7b)**                     | mobile → web                   | ONE generalized control over `ReportEntityType`, mounted in four places — the shape mobile settled on in M7. Includes reporting a **comment**, which W7a held back for this row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Clap (1..50 accumulating) ✅ **DONE — web 2026-08-10 (W7b), mobile 2026-08-17 (M7-3)**      | ~~mobile → web~~ **web-first** | **Direction reversed** — mobile had no clap control at all ([48 §3.15](./48_PlatformParityRegister.md) **M7-3**), so web built it first and mobile ported it. Accumulating, debounce-batched into one `POST` carrying `count`, capped client-side at `MAX_CLAPS_PER_USER_PER_PIECE`, removal is all-or-nothing. **Both clients use the same 600 ms idle window, deliberately** — touch repeat-taps faster than a mouse, so web's lower bound holds more strongly. **Mobile has one thing web does not:** an offline burst queues onto the durable outbox, with a handler whose merge SUMS rather than latest-wins (latest-wins silently loses claps the reader already watched land). Three differences recorded in [48 §4.1](./48_PlatformParityRegister.md); sweep [48 §6.12](./48_PlatformParityRegister.md)                                                                                                                                                                                                                                                                                                                                                        |
| Reader analytics (the reader's own stats) ✅ **DONE 2026-08-10 (W7c)**                      | mobile → web                   | 48 §2 item 6. **PARTIAL BY DESIGN, and the row's premise was wrong.** All seven `ReaderAnalyticsDto` fields were ALREADY rendering on web — inside the **writer** dashboard at `/me/stats`, a page headed "Your writing's reach", so a reader who had never published went there to see what they had read. The fix was a **move** as much as a build: `/me/reading` now owns them, reached from the account menu, fed by `GET /analytics/readers/me` (the reader half alone), with the writer dashboard's label changed to "Your writing's stats" and the two cross-linked. Plus a **bounded** bookmarks count (`50+`; `v1` has no `COUNT(*)`, and `bookmarksReceived` on the profile is a hardcoded `0` — so the real endpoint is `GET /me/bookmarks`). **NOT ported:** Continue Reading · Recently Read · Weekly Activity — all three read a device Hive store and the frozen `v1` has no reading-history endpoint, so they are **platform-inherent** ([48 §4](./48_PlatformParityRegister.md)). Web shows an **error, never a fabricated zero**, on failure — mobile degrades to local history and web has none. Sweep: [48 §6.10](./48_PlatformParityRegister.md) |
| Privacy prefs (bookmarks / reading-history counts) ✅ **CLOSED-NOT-BUILT 2026-08-10 (W7c)** | mobile → web                   | 48 §2 item 8. **Nothing was written, because there was nothing left to write** — this row is closed by evidence. Mobile's privacy screen has three controls and its own docblock (`privacy_settings_screen.dart:1-9`) says only one is real: private account, "server-backed (`Profile.isPrivate` via `PATCH /me`)" — **which web already ships**, at `frontend/src/features/settings/pages/edit-profile-page.tsx:253`. The other two are "LOCAL display gates": the frozen `v1` never exposes another user's reading history or bookmarks, so there is nothing cross-user to enforce, and `profile-stats.tsx:6-11` already omits those counts because the profile fields are hardcoded `0` server-side. A web toggle would hide a figure web does not display. Recorded as platform-inherent in [48 §4](./48_PlatformParityRegister.md); the dedicated-screen-vs-section arrangement is in 48 §4.1                                                                                                                                                                                                                                                                    |
| Onboarding first-run flow                                                                   | mobile → web                   | Needs a product shape for web before it is an engineering task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **P-2** composing @mentions ✅ **DONE 2026-08-17 (both clients, same day)**                 | **both**                       | Shipped on web (`7ff62d4`) and mobile (`738c8d9`). A mention is stored as `@<uuid>` **inside the body** — `CommentService.parseMentions` re-derives `mentions[]` from it (`comment.service.ts:46`), so the body **is** the mention, and it is rename-proof. The composer never shows a uuid: the writer types and edits **handles**, and one pure module per client (`mention-text.ts` / `mention_text.dart`, same regexes, same round-trip) is the only display↔raw translation. Candidates are the **story roster** (`GET /stories/:id/members`), **not** `GET /users/:username` — `notifyComment` does no access check on a mentioned id (`comment.service.ts:250-270`), so an arbitrary-handle lookup would let a mention tell a stranger a private story exists. Found and fixed a constant defect on the way: the AF6 composer was counting against the 2,000 **engagement** cap. Sweep: [48 §6.11](./48_PlatformParityRegister.md)                                                                                                                                                                                                                              |

**W8 — remaining AI surfaces.** ✅ **Done 2026-08-05** —
[report](./52_WebAiSurfacesReadinessReport.md). AI conversations, the prompt library, and AI usage: mobile
had all three, web had none, and W5/W6 cover discovery/search/ask and the story explorer respectively.
~~Same open stack caveat as `af2` — no AI provider in the E2E stack.~~ **That caveat is discharged**: the
`stub` provider closed it for `af2` and W5 has now used it to assert a synthesised answer end to end
([e2e/06 §6](./e2e/06_PhasePlan.md)).

All three shipped under `/settings/ai` (a hub + four sub-pages), deriving placement from web's own IA
rather than copying mobile's editor menu — see the report §3.1. Two things the row's framing did not
anticipate:

- **It was not a symmetric "both clients" row.** The step-0 audit found mobile's client field-for-field
  correct on all seven routes but its conversations list **impossible to populate** — nothing on mobile
  ever calls `POST /ai/conversations`, and completions do not create one
  ([48 §3.12](./48_PlatformParityRegister.md) W8-1, confirmed live: 68 AI requests, 0 conversations). So
  web builds the create path and is now the reference; mobile's fix is a separate row.
- **AI usage overlaps W4's billing usage visibly.** Escalated rather than reconciled: the decision was a
  separate, cross-linked page, which is also mobile's shipped shape. Report §3.4.

**D1 — the accept-a-suggestion decision.** Not an epic; a question that must be answered before its
work can be scoped:

> When a reviewer's suggestion is accepted, does the **server** rewrite the piece, or does the
> **client** apply the replacement through the editor?

Server-side is one change and behaves identically on both clients; client-side is two integrations and
keeps the editor the only writer of prose. Until it is answered, both clients record the decision
without changing the text — and **mobile's "Suggestion accepted." toast implies an edit that did not
happen**, which is worth correcting whichever way D1 lands.

**Before each of these rows starts:** run the reference audit ([48 §6](./48_PlatformParityRegister.md)
step 2) against the shipping platform's request/response shapes. Three AF6 surfaces have been audited
so far and **all three were broken** (M-1, M-2, M-3); a screen list is not evidence.

---

### 4.6 W5 — AF4 retrieval-backed discovery / search (detail)

**Complete 2026-08-04** — full account in [51](./51_WebDiscoverySearchReadinessReport.md), in three phases, each landed and verified before the next began:

| Phase | What                                                                                                               | State                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1     | Step-0 contract audit of all nine `/ai/*` retrieval routes + the web retrieval data layer                          | `acdd2e1` — four findings, two of which changed the row's scope |
| 2     | The four surfaces: AI search (`mode=ai`), saved searches, two discover shelves, reader "More like this"            | `3919c7a` — 548 frontend unit tests green                       |
| 3     | E2E page objects + functional specs, a11y in both themes, one visual spec, and the live `ai.use` / `pieceId` proof | this pass — 4 consecutive green whole-project runs              |

**The row is an upgrade, and every phase kept that promise:** keyword search, the editorial discover page and
W1's related-pieces section behave exactly as before for a signed-out reader and on any deployment that has
not raised the AF1 flags — which is what AF1 seeds, and therefore the state these surfaces mostly run in.
Phase 3 asserts that additivity rather than assuming it.

**Phase 3 found three real defects, all fixed here** ([48 §3.9](./48_PlatformParityRegister.md) W5-6/7/8):
the public reading page never rendered for a signed-out visitor (high — W5's shared AI gate put an
authenticated read on a public page, and the resulting 401 cleared the query cache); re-running a saved
search silently used the keyword engine; and "Explain these results" produced no answer because the cached
retrieval plan outranked the request. Two harness gaps were closed alongside them (a cross-worker mutex for
the global AI flags, and two flakes traced to assertions that were not quite about the feature).

**What is not asserted, deliberately:** Ask My Book and the Story Explorer (AF3 surfaces, W6's row), a real
vendor behind the synthesised answer (the `stub` provider is the inert port — [e2e/06 §6](./e2e/06_PhasePlan.md)),
and a populated AI result set as a visual baseline (a live ranking is not a stable screenshot —
[e2e/10 §2.3](./e2e/10_UIQuality.md)).

**One open gate, the standing one for any new visual spec:** `frontend-search-ai-off` has no committed
baseline, and only the `web-e2e` workflow's visual job may mint one ([e2e/10 §8.3](./e2e/10_UIQuality.md)).
Verified in the pinned image: 32 existing baselines still match in light and dark, and the new spec fails
with "A snapshot doesn't exist", which is the correct state until CI mints it.

### 4.5 B2 — premium content (HELD) (detail)

**Status: recorded, not scheduled.** Held by the user on 2026-07-29 — "maybe we will implement it in
future". This section exists so the decisions already taken are not re-litigated when it thaws.

**Why the row exists.** W4's rationale named "premium pieces (W1)" as one of the two things
monetization would gate. **There is no premium-content model anywhere** — verified: `piece.entity.ts`
has no premium/paywall column, `Visibility` is only `public | unlisted | private`, no piece route
consults the Entitlement Service, and the reader's "More like this" is a plain first-tag search. So
half of W4's stated premise had no contract behind it, and W4 correctly gates only metered AI. This is
the **third** roadmap dependency found to be aspirational rather than verified (after W-1's related
pieces and W3c-1's review gate) — see [§7](#7-what-this-roadmap-is-not).

**Model chosen: tier-gated.** Decided by the user 2026-07-29 over two alternatives, both rejected on
size rather than merit:

| Model                         | Why not chosen                                                                                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-piece unlock with credits | Needs an unlock ledger and credit-spend on the read path; makes credits do double duty alongside AI metering. **L.**                                                                               |
| Author revenue share          | Earnings attribution, payouts, tax, KYC, author accounting — **none of which exists** in the backend. A multi-epic program. `marketplace` is a reserved `PremiumFeature` code that anticipates it. |

Tier-gated: an author marks a piece premium, `plus`/`pro`/`enterprise` subscribers read it in full,
free readers get a server-truncated excerpt. It reuses the subscription and entitlement machinery W4
builds and needs no payout system.

**Scope when it thaws — B2, the enabler (S–M).** Breaks the roadmap's "no backend enabler" default, as
B1 did, and needs the same freeze amendment.

- Add `PremiumContent: 'premium_content'` to `PremiumFeature` and grant it in `plus`/`pro`/`enterprise`
  under the `monetization.plans` setting. **No migration** — codes are varchar-backed by design.
- `pieces` gains one additive `is_premium boolean not null default false` (metadata-only on PG 11+).
  **Orthogonal to `Visibility`** — a piece can be public _and_ premium; state that in the entity
  comment, since a client has already shipped a defect from misreading that enum.
- **Read-path enforcement**: the by-slug endpoint and piece detail call
  `PolicyEngineService.isEntitled(userId, 'premium_content')` — the **first real caller** of a port that
  has had zero since AF5 shipped. Unentitled or anonymous → excerpt plus a lock flag; entitled → full
  content; the author always sees their own piece whole.
- **Excerpt derived server-side** from the TipTap JSON using `@qalam/utils`' existing `extractPlainText`.
  Do **not** add a third flattener — two already exist with deliberately different semantics, and
  `content-text.divergence.spec.ts` exists to stop them being merged.
- Feed, search, discovery and related-pieces mark premium in their DTOs so clients badge without a
  second fetch. The premium toggle joins the piece update DTO.

**Scope — the clients (M each, both platforms).** The parity rule makes this a pair, not a web row with
mobile deferred. Reader shows excerpt + a paywall CTA linking to plans; publish settings gain the
toggle; lists gain the badge. This is **`PremiumGate`'s first genuine call site** on either platform,
which also retires **M5-1** (a mobile component whose own doc comment claims usage it does not have).

**Non-negotiable: enforcement truncates content server-side.** A client-side veil ships the full prose
to anyone who opens devtools. The paywall is a read-path decision, not a rendering one.

**Two product questions still open** (neither blocks holding it):

1. How long the free excerpt is.
2. Whether an author may mark an **already-published** piece premium retroactively. The column defaults
   to `false`, so existing pieces are unaffected either way — but the retroactive case has a
   reader-trust dimension worth deciding deliberately rather than by default.

**Sequencing when it thaws:** `W4 → B2 → clients → W5`. B2 should precede W5, because W5 owns three
more unenforced feature codes (`ai_discovery`, `premium_search`, `premium_recommendations`) and B2
establishes the enforcement pattern they would otherwise each invent. Do not start B2 before W4's
hand-off lands — B2's read-path lock flags must fit the entitlement client layer W4 builds.

---

### 4.8 W6 — what is actually left in it (corrected 2026-08-05)

**The held-rationale in §4 was stale.** It read "no client exists on any platform", and that is no longer
true for half the epic. The correction matters because it changes W6 from a product-definition problem
into two differently-shaped pieces:

**The reading half already has a client, and it is not W6's.** The **Story Explorer** is an **AF4**
consumer of the AF3 graph (`retrieval/consumers/story-explorer.controller.ts` — _"Story Explorer (AF4).
Structured views over the AF3 knowledge graph"_), serving `GET /ai/stories/:storyId/:view` over eight
views: `characters · relationships · timeline · locations · events · objects · concepts · map`
(`packages/shared/src/retrieval.ts`). Mobile renders all eight
(`lib/features/ai/presentation/screens/story_explorer_screen.dart`) and it became **reachable on
2026-08-05** when [48 §3.9](./48_PlatformParityRegister.md) W5-3 closed. So a working reference exists.
W5 excluded it as "AF3 → W6", which was a mislabel: it is AF4, and porting it to web is an ordinary
port against an exercised reference, not a held epic.

**The analysis half is genuinely clientless on both platforms.** The AF3 module
(`backend/src/modules/story-intelligence/`) exposes seven routes that **no client calls** — verified by
grep across `qalam-mobile/lib`, which returns nothing for `analyze`, `/graph` or `analyses`:

| Route                                        | What it does                      |
| -------------------------------------------- | --------------------------------- |
| `POST /stories/:storyId/analyze`             | Run an analysis; builds the graph |
| `GET /stories/:storyId/graph`                | The whole graph                   |
| `GET /stories/:storyId/graph/characters`     | Character nodes                   |
| `GET /stories/:storyId/timeline`             | Timeline projection               |
| `GET /stories/:storyId/analyses`             | Analysis history                  |
| `GET /stories/:storyId/analyses/:analysisId` | One analysis result               |
| `DELETE /stories/:storyId/graph`             | Reset the graph                   |

This is the part with no product definition, and the questions are real ones: who triggers an analysis
and when, what it costs against the AI budget, whether extracted entities are the writer's to confirm or
correct, and what resetting a graph means for anything built on it. [35](./35_StoryIntelligenceArchitecture.md)
deliberately scoped clients out; nothing has scoped them back in.

**Consequence for the roadmap.** W6 stays **held** — but only the analysis lifecycle is held. If the
explorer views are wanted on web, that is a normal port and should be its own row rather than waiting
behind an undefined epic. Deciding that is a roadmap call, not an engineering one.

---

### 4.9 B4 — piece limit per plan (detail) ✅ **done 2026-08-08**

**Requested and specified 2026-08-05. Shipped 2026-08-08** — enabler + both clients, in one pass.
A cap on how many pieces an author may have, varying by subscription tier.

**What landed, against the scope below.** All of it, plus three things the scope did not name and
one it named that turned out not to apply:

|                                              |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`maxPieces` in the catalogue**             | Free 25 · Plus 250 · Pro 0 · Enterprise 0, in `settings.catalog.ts` **and** `DEFAULT_PLAN_LIMITS`. No type change, no migration, as predicted                                                                                                                                                                                                                                                                                         |
| **Enforced on `POST /pieces`**               | `PiecesService.createOwnDraft` — a new entry point, because `createDraft` is also the shared construction path for **responses**, and capping a reply is not what B4 asks for                                                                                                                                                                                                                                                         |
| **…and on `POST /pieces/:id/duplicate`**     | **Beyond the letter of the scope, decided 2026-08-08.** Duplicate ends with one more live piece and is a shipped button on the web dashboard, so leaving it uncapped made the cap bypassable in one click. It is creation, not publish or update, so the "keep everything" rule is untouched                                                                                                                                          |
| **`PIECE_LIMIT_REACHED` (402)**              | New code + `PieceLimitReachedException`, carrying `{used, limit}`. Explicitly **not** `QUOTA_EXCEEDED` — the two sit next to each other in `error-codes.ts` with the contrast written down                                                                                                                                                                                                                                            |
| **`GET /me/pieces/limit`**                   | Additive read: `{used, limit, remaining, unlimited, canCreate}`. Both clients need the count before it bites, and nothing already returned it                                                                                                                                                                                                                                                                                         |
| **`mergePlans` now merges `limits` per key** | **The defect this epic nearly shipped.** `syncDefinitions` inserts with `orIgnore()`, so an existing database keeps the `monetization.plans` row it was first seeded with; a flat spread let that stored `limits` replace the compiled one wholesale, `maxPieces` read as absent, absent means unlimited — and the cap would have been inert on every deployment except a fresh one. Covered by `monetization.config-service.spec.ts` |
| **api-types guard: not applicable**          | Checked (48 §3.11). `@qalam/api-types` contains **no** piece shapes at all — the web client types pieces locally — so the new DTO falls outside the guard's register and pinning it would mean introducing pieces to the package. The guard passes untouched                                                                                                                                                                          |

**Counting rule, stated because the code cannot state it twice.** The count is the author's
non-deleted pieces — `countByAuthor`, `deleted_at IS NULL`. **Responses count** (a response is an
ordinary piece row the author owns) but are **not gated**, since enforcement is on `POST /pieces`
only. That asymmetry is deliberate and recorded: the number shown to the author is exactly the
number enforced against them, which a response-excluding count would not be.

**Clients.** Web: the count beside "New draft", a disabled-not-hidden create control with
`aria-describedby` pointing at the notice, and — because the web editor creates the draft lazily on
first autosave — a distinct `limit-error` save status, so the indicator stops promising "will
retry" for a create that will be refused identically forever. Mobile: the same count and notice on
the drafts screen, the FAB visibly inert with a labelled reason, and an explanation on any draft
whose sync the cap refused (the reachable race where another device took the last slot).

**One a11y gap found, not introduced.** The mobile blocked state passes `textContrastGuideline` and
`labeledTapTargetGuideline` rendered in **both** themes, and `iOSTapTargetGuideline` (44). It does
not pass `androidTapTargetGuideline` (48), because `QButton` clamps every button in the app to
`max(visualHeight, 44)` — app-wide and pre-existing. Recorded rather than papered over with a
one-off taller button.

**This is the first premium feature that gates the core write path.** Every other premium code gates
AI tooling; this one gates the product's primary object. That is why the three questions below were
settled before any work was scoped.

**It is a LIMIT, not a feature code.** The eight `PremiumFeature` codes gate capabilities; a piece cap
is a number, which is what `PlanLimits` is for. `PlanLimits` already carries an index signature
(`[key: string]: number`) documented **"0 / absent = unlimited"** (`packages/shared/src/monetization.ts`),
so a new `maxPieces` key needs **no type change and no migration**, and the uncapped tiers come free.
It also sidesteps [D4](#4-track-w--the-web-app-sequential) entirely: a limit is either enforced or
absent, so it cannot join the seven codes that are advertised and never checked
([48 §5.2](./48_PlatformParityRegister.md)).

**The three decisions, taken:**

| Question                   | Answer                                                                                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What does it count?        | **Pieces you may HAVE** — a stock cap on live pieces. Deleting one frees a slot. Rejected: a monthly create-quota (punitive on a writing platform — deleting would not help), and published-only (hard to explain, and unpublishing to make room is an odd interaction)                               |
| What happens on downgrade? | **Keep everything, block new creation.** Existing pieces stay live, visible and editable; the author simply cannot create another until back under the limit. Rejected: hiding pieces over the cap (breaks live URLs and removes work from readers without the author acting) and hard-blocking edits |
| Starting numbers           | **Free 25 · Plus 250 · Pro unlimited · Enterprise unlimited.** Generous enough that a real hobbyist never hits it, so the cap reads as an anti-abuse ceiling rather than a paywall. These live in `monetization.plans` as data and are tunable at runtime without a deploy                            |

**Scope — the enabler (S).**

- Add `maxPieces` to each tier's `limits` in the `monetization.plans` catalogue default
  (`backend/src/modules/settings/settings.catalog.ts`). `0` for Pro and Enterprise.
- Enforce on **`POST /pieces`** (`pieces.controller.ts:61`) by counting the author's pieces where
  `deletedAt IS NULL`. **Pieces are soft-deleted** (`Piece extends QalamAuditEntity`), so a deleted
  piece frees its slot even though the row and its reserved slug survive — that is the intended
  reading of "pieces you may have", and it must be stated in the entity/service comment so nobody
  later "fixes" the count to include tombstones.
- Read the limit through the existing entitlement path (`EntitlementService.getLimits`), the same way
  `UsageService.assertWithinQuota` reads the token caps — do **not** add a second source of plan data.
- Honour `0 = unlimited` exactly as `usage.service.ts:57` already does.
- A new domain exception + error code so clients can distinguish "you are at your plan's limit"
  (remedy: **see plans**, or delete a piece) from every other 4xx. Do not reuse `QUOTA_EXCEEDED`,
  whose remedy is "wait for reset" — the W4 lesson (48 §3.6) was that conflating those two tells a
  blocked user to wait for something that will never help them.
- **Do not enforce on publish or update.** Only creation is capped; an author at their limit must
  still be able to edit and publish what they already have, which is what "keep everything" means.

**Scope — the clients (S each, both platforms).** Parity is binding, so this is a pair.

- Surface the count before it bites: "24 of 25 pieces" near the create action, not only an error after
  the fact.
- Handle the new error code with its own copy and a route to plans — reuse the `PremiumGate`/upsell
  patterns W4 established rather than inventing a dialog.
- An author over the limit after a downgrade needs an honest empty-slot state, since that is a real
  and reachable condition under the chosen downgrade rule.

**Where it lands:** fold the enabler into whichever pending row touches monetization next; the client
halves sit with **W7** or a mobile parity pass. It is deliberately **not** its own epic — S + S×2.

---

### 4.10 B5 — per-account "turn AI off" (detail) ✅ **DONE 2026-08-08**

**Requested and specified 2026-08-05.** An author switches AI off for their own account: no assistant
panel, no Craft Coach, no AI discovery or search prompts.

**What already exists, so this is not built from nothing:**

| Already there                                                                                                                                                                                            | Not there                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| A **platform-wide** kill switch — `feature.ai.enabled` plus per-feature flags, with an admin UI (`admin/src/features/ai/pages/ai-config-page.tsx`)                                                       | Any **per-account** control                    |
| `GET /ai/features` — contract: _"which AI features are enabled **for you** (master + per-feature flags)"_, consumed by both clients (`frontend/src/features/ai/api/ai.api.ts`; mobile's `ai_repository`) | The user preference that endpoint would report |
| `ai_personalization` consent — _"use of the user's content to improve AI features"_                                                                                                                      | —                                              |

**The three decisions, taken:**

| Question              | Answer                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whose switch?         | **The author's**, per account. The platform-wide one already ships                                                                                                                                                                                                                                                                                                              |
| What does "off" mean? | **Server-enforced, UI follows.** Stored server-side; AI requests are refused for that user and the clients hide affordances _because the server says so_. A client-only hide is the exact defect class this project keeps finding — W3c-1 and the seven unenforced codes ([48 §5.2](./48_PlatformParityRegister.md)) are both "the UI claims something the server never checks" |
| Shared stories?       | **Governs the user, not the story.** A co-author who has AI on may still use it on a story you co-author; your switch controls only your own affordances                                                                                                                                                                                                                        |

**Keep it separate from `ai_personalization`, deliberately.** "Don't train on my work" and "don't offer
me the tools" are different choices a user may want independently. Conflating them would mean a writer
who wants the assistant but not the training has no way to say so. Document the distinction where both
are surfaced.

**Scope — the enabler (S).**

- A per-user preference on the **existing `UserSettings` entity**
  (`backend/src/modules/users/entities/user-settings.entity.ts` — PK = FK → `users`, already holds
  `theme`). One additive nullable/defaulted column, one migration. **Do not add a column to `users` and
  do not invent a preferences subsystem** — the precedent exists and this is it.
- **Enforce in the AF1 orchestrator (`AiCompletionService`), not per controller.** [35](./35_StoryIntelligenceArchitecture.md)
  establishes that every AI path runs through it, so one guard covers every current AI feature _and_
  every future one. A per-controller check would be a second authz path — the W3c-1 mistake.
- **Fold it into `listFeatureStates()`** so `GET /ai/features` reports everything off for an opted-out
  user. Both clients already read that endpoint, which is why the client halves are XS: they largely
  work already. Precedence is **admin off beats user on** — the master flag is the outer gate.
- A distinct error code for "you have turned AI off", separate from a disabled platform flag and from
  quota/entitlement denials. Its remedy is "turn it back on in settings" — not "see plans", not "wait
  for reset". Conflating remedies was the W4 defect (48 §3.6).
- **Metering:** an opted-out user issues no AI requests, so nothing meters. Confirm no credit or token
  accounting fires on the refusal path.

**Scope — the clients (XS each, both platforms).** Parity is binding, so this is a pair.

- The switch itself, in settings, next to (not merged with) the `ai_personalization` consent.
- Verify the AI surfaces already respect `GET /ai/features` rather than assuming they do — mobile's
  reachability record (R-1, M5-1, W5-3, W8-1) is four instances of code that looked wired and was not.
- Toggling off must not leave AI entry points stranded in menus that were built before the switch
  existed.

**Where it lands:** the enabler fits any pending row that touches the AI module; the client halves are
small enough to ride with **W7** or a mobile parity pass. **Not its own epic** — S + XS×2.

#### What shipped (2026-08-08)

**The column, and why nothing changed on deploy.** `user_settings.ai_enabled boolean NOT NULL
DEFAULT true` — one additive column on the existing satellite, migration
`1786181711060-UserAiPreference`, generated (not hand-written) and verified to run **and** revert.
Postgres records a non-volatile default in the catalogue rather than rewriting the heap, so it is a
metadata-only `ALTER` on a table every authenticated session reads. Every existing row, and every
user with no settings row at all, reads as AI-on. The read path defaults a missing row the same way
(`SettingsService.isAiEnabledFor` → `?? true`), which is deliberate: it also means the gate never
lazily INSERTs a row on the hot path.

> ⚠️ **The generator emitted far more than this change, and the rest of it is pre-existing drift.**
> `migration:generate` produced ~110 statements: dropping every FK, both `search_vector` generated
> columns, and the trigram/partial indexes — the accumulated gap between entity metadata and the
> hand-tuned SQL of earlier migrations. Applying it would have been destructive. The body was
> reduced to the one intended statement, keeping the generated filename and timestamp. **The drift
> is real and unowned**; it will bite the next person who generates a migration, and it deserves its
> own row.

**One guard, in the orchestrator, ahead of the meter.** The check lives in
`AiFeatureService.assertEnabled` — the single function docs/35 already routes every AI path through
— and the orchestrator calls it as the first statement of `AiCompletionService.prepare()`
(`ai-completion.service.ts`). That places it before `meter.checkQuota` and far before
`meter.recordConsumption`, which is what makes §4.10's metering requirement true rather than
assumed; `ai-completion.user-switch.spec.ts` asserts it with a **real** `AiFeatureService` in front
of a spy meter, for `complete()` **and** `stream()` (both share `prepare()`, so an unguarded stream
would have been the bypass). No per-controller check was added anywhere.

**Precedence, and the signature change.** Order inside `assertEnabled` **is** the rule: platform
flag → user switch → feature flag, so admin-off-beats-user-on falls out of it and an opted-out user
on a dark deployment gets `AI_DISABLED`, not a remedy that would not help. `listFeatureStates()`
gained a `userId` (the route's contract was always "enabled **for you**"; nothing about it had been
per-caller until now) and `assertEnabled` gained one too — **five call sites** updated: the
orchestrator plus `ask-book` ×2, `semantic-search` ×2 and `recommendation`, all of which already had
the caller's id in hand.

**A distinct code.** `AI_DISABLED_BY_USER` (403), because the remedy is the caller's own switch —
not "wait for an admin" (`AI_DISABLED`), not "wait for reset" (`AI_USAGE_LIMIT_EXCEEDED` /
`QUOTA_EXCEEDED`), not "see plans" (`ENTITLEMENT_DENIED`). Four walls, four sentences; collapsing any
pair is the W4 defect ([48 §3.6](./48_PlatformParityRegister.md)).

**One field added to the contract**, and it earns its place. `AiFeaturesResponse.userAiEnabled`
reports the caller's own switch alongside the ANDed `aiEnabled`, because otherwise no client can tell
"you turned AI off" from "an administrator did" — and the two need different copy and different
actions. Pinned by the §3.11 `@qalam/api-types` guard, which covers this DTO. `SettingsResponseDto` /
`UpdateSettingsDto` also gained `aiEnabled`; neither is in that package, so no pin was needed there.

**Both clients, and what the sweep actually found.** The client halves were XS _for the surfaces that
already gated on `GET /ai/features`_ — and four did not:

| surface                                   | before                                                            | now                                |
| ----------------------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| mobile AI Discovery hub                   | compile-time `enableAi` **only** — never asked the server         | ANDs `aiFeatures.aiEnabled`        |
| mobile AI Search screen                   | **no runtime gate at all**                                        | refuses, names the writer's switch |
| mobile Story Explorer (screen + overflow) | `enableAi && isRemote` — the route has no flag, so no server read | ANDs `aiFeatures.aiEnabled`        |
| web editor's AI button                    | rendered on a slot check alone → a drawer of four notices         | hidden when AI is off for you      |

Everything else followed for free, which was the bet §4.10 made: mobile's `AiFeatures.isEnabled()`
already ANDs the master value, and web's `resolveAvailability` already reads it, so one server field
turned off the assistant, the coach, Ask My Book, recommendations and "More like this" on both
clients with no change. Web gained a `self-off` availability state (its own copy, its own action —
"AI settings"); mobile gained the matching `AI_DISABLED_BY_USER` copy and `AiFeatures.disabledByUser`.

**The switch itself** is on `/settings/ai` (web: the W8 hub; mobile: a new screen + hub tile),
rendered unconditionally — including while AI is off, since it is the one control that turns it back
on. Mobile had **no `/settings` client at all** (its notification toggles use the separate
`/notification-preferences` route), so B5 added the minimal one: entity, datasource, repository,
provider, controller.

> ⚠️ **§4.10 says "next to the `ai_personalization` consent". There is nothing to sit next to.**
> `GET/PUT /privacy/consent` ships with **no client surface on either platform** (verified
> 2026-08-08) — the consent model exists server-side and no screen reaches it. So the "not merged"
> requirement was met the only way available: the switch states the distinction in its own copy
> ("this is separate from whether your work may be used to improve AI features"), asserted by a test
> on both clients, and the privacy module was not touched. **Surfacing the consent is unowned work**
> — it belongs with W7's privacy-prefs row, and when it lands it belongs on this same screen.

**Verified:** backend 1178 tests green, `tsc --noEmit` + eslint clean, migration up **and** down
against a live database. Web 745 tests green, typecheck + lint + build clean. Mobile 731 tests green,
`dart analyze lib test` clean (3 pre-existing infos, none new), settings screen asserted in light
**and** dark.

---

### 4.11 B6 — collaborators per story, by plan (detail) ✅ **DONE 2026-08-08**

**Specified 2026-08-05.** A cap on how many collaborators a story may have, by the plan of the author
who owns it. Like [B4](#49-b4--piece-limit-per-plan-detail) this is a `PlanLimits` key, not a
`PremiumFeature` code — a number, not a capability, so it cannot join the seven advertised-but-unchecked
codes ([48 §5.2](./48_PlatformParityRegister.md)).

**Decisions taken:**

| Question                    | Answer                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Numbers                     | **Free 0 · Plus 3 · Pro unlimited · Enterprise unlimited** (`0` free means solo; unlimited is `0` in `PlanLimits` — see the collision note below). Collaboration becomes a paid capability outright |
| Whose plan governs?         | **The story owner's.** A Free user invited to a Pro author's story consumes one of that story's seats and is not charged for it — seats belong to the story, billed to its owner                    |
| Does the owner take a seat? | **No.** The cap counts collaborators, not participants                                                                                                                                              |
| Downgrade                   | **Keep everyone, block new invites** — same rule as B4. Existing collaborators keep their access; the owner simply cannot invite another until back under the limit                                 |

> ⚠️ **`0` is overloaded here and the existing code reads it as "unlimited"** (`usage.service.ts:57`,
> `PlanLimits` doc comment: _"0 / absent = unlimited"_). Free needs **zero seats**, which is the exact
> opposite. Do **not** encode Free as `0`. Pick an explicit representation — e.g. `-1` for unlimited
> with `0` meaning none, or a separate `collaborationEnabled` check — and state the choice in the
> catalogue comment. **This is the one place B6 can silently invert its own rule**, handing free users
> unlimited collaborators.

**Scope — the enabler (S).**

- `maxCollaborators` in each tier's `limits` in `monetization.plans`
  (`backend/src/modules/settings/settings.catalog.ts`), with the `0` semantics resolved as above.
- **Enforce at invite time**, on `POST /stories/:storyId/invitations`
  (`collaboration.controller.ts:162`) **and** on `POST /stories/:storyId/members`
  (`:100`, the direct-add path) — both create a seat and both must be capped, or one becomes the
  bypass.
- **Count members + PENDING invitations**, not members alone. Counting only members lets an owner
  issue unlimited invites that all land later and blow through the cap. `GET .../invitations` is
  pending-only ([49 §6c](./49_WebCollaborationEpicDesign.md) recorded that), so the pending set is
  already queryable.
- Also re-check on `POST /invitations/:id/accept` (`:183`): an invite issued under Pro must not be
  acceptable after the owner downgrades. Refusing at accept needs its own copy — the invitee did
  nothing wrong.
- Read the limit through `EntitlementService.getLimits(ownerId)` — **the owner's** id, not the actor's.
  This is the one place the acting user and the governing plan differ, so it is the likeliest bug.
- A distinct error code, separate from B4's and from the quota family. Remedy: **see plans**, or remove
  a collaborator.

**Scope — the clients (S each, both platforms).** Parity is binding.

- Show seats used before the wall: "2 of 3 collaborators" on the collaborators screen.
- Free authors need an honest upsell where the invite action is, not a dead button — `CapabilityGate`
  hid affordances silently once already (mobile C-1) and that must not repeat here.
- The accept-side refusal needs its own state on the invitations inbox.

#### What shipped (2026-08-08)

**The sentinel decision, and how it was reconciled.** `maxCollaborators` uses **`-1`
(`UNLIMITED_SEATS`) for unlimited and `0` for none** — the inverse of every other `PlanLimits` key.
The alternative (a separate `collaborationEnabled` flag) was rejected because it makes the cap two
reads instead of one, and forgetting the second read reproduces exactly the bug the warning above is
about. The deviation is not left implicit:

| Where                                                                   | What it says                                                                                                                                                      |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEGATIVE_UNLIMITED_LIMIT_KEYS` (`packages/shared/src/monetization.ts`) | The explicit list of keys whose unlimited sentinel is negative. `maxCollaborators` is the only member                                                             |
| `resolvePlanLimit(limits, key)`                                         | The ONE correct way to read any limit — it consults that list. Reading `limits.maxCollaborators` by hand is what re-creates the inversion                         |
| `mergePlans` doc comment                                                | Names the exception directly under the "`0` is how an admin says unlimited" promise it breaks                                                                     |
| The `monetization.plans` setting **description**                        | Admin-facing, rendered beside the JSON editor: "0 means UNLIMITED for every key EXCEPT `maxCollaborators`, where 0 means NO collaborators and -1 means unlimited" |

**How an admin expresses "unlimited collaborators": `-1`.** Pinned by
`monetization.config-service.spec.ts`, which asserts from **one** stored catalogue that an admin's
`0` resolves to _unlimited pieces_ and _zero seats_ — so normalising the two conventions in either
direction fails a test rather than silently inverting a tier.

**Enforcement.** One `CollaboratorSeatService`, three doors, two gates:

| Door                           | Gate                 | Counts                                                  | Refusal                                |
| ------------------------------ | -------------------- | ------------------------------------------------------- | -------------------------------------- |
| `POST .../invitations`         | `assertCanOfferSeat` | members **+ outstanding invitations**                   | `COLLABORATOR_LIMIT_REACHED` (402)     |
| `POST .../members`             | `assertCanOfferSeat` | same — capping only one door makes the other the bypass | same                                   |
| `POST /invitations/:id/accept` | `assertCanClaimSeat` | **members only**                                        | `COLLABORATOR_SEATS_UNAVAILABLE` (409) |

Accept counts members alone on purpose: including the pending set would make an invitation block
**its own** acceptance (2 members + this invitation = 3 against a limit of 3). Pending invitations
exist to stop an owner _issuing_ more claims than they can honour; once someone is claiming one,
what matters is whether the seat exists. A downgraded story therefore fills first-come-first-served.

Every read is `getLimits(facts.authorId)` — the owner's, never the actor's. `getLimits`' fallback was
also changed from a three-key stub to the compiled defaults **for that tier**, because that stub
would have left `maxCollaborators` absent, and absent is the one state with no honest reading.

**Two error codes, not one**, because two different people read them. The owner gets 402 with
`{used, limit}` and "see plans, or remove a collaborator". The invitee gets 409, no plan size, and
no upsell — they cannot buy a seat on someone else's plan, and quoting a stranger's plan at them
both blames the wrong person and leaks what the owner pays. Neither is `QUOTA_EXCEEDED`: nothing
about a seat resets, so that remedy would never arrive (the W4 defect, [48 §3.6](./48_PlatformParityRegister.md)).

**Read endpoint.** `GET /stories/:storyId/collaborators/limit` → `CollaboratorLimitDto`, mirroring
B4's `PieceLimitDto` field-for-field plus `members` / `pendingInvitations`, since the count is
composite and "2 of 3" reads differently when one of the two has not accepted. Authorized as
`story.invite`: the allowance is only meaningful to someone who could spend a seat, and it is a
coarse signal of what the owner pays for.

**Clients.** Both show the count beside the invite action, keep that action **visible and disabled**
with the reason attached (`aria-describedby` on web, the tooltip on mobile), and render an offer —
not an error — for a free author, so they can see the feature exists and what it costs. The
accept-side refusal is its own persistent state on the invitations inbox, worded for the invitee.

**Not covered by the §3.11 api-types guard**: `@qalam/api-types` has no collaboration namespace at
all, so `CollaboratorLimitDto` has nothing to drift from — the same position B4's `PieceLimitDto` is
in. Each client declares the type in its own feature layer.

**The `MAX_STORY_COLLABORATORS` ceiling (20, 409) stays.** It is anti-abuse and no plan raises it;
the plan cap is checked first because for every tier that can hit it, it binds far below 20.

---

### 4.12 B7 — version-history depth, by plan (detail) ✅ **DONE 2026-08-08**

**Specified 2026-08-05.** How many story snapshots an author can _see_, by plan.

**Decisions taken:**

| Question          | Answer                                                                                                                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Numbers           | **Free 5 · Plus 25 · Pro unlimited · Enterprise unlimited**                                                                                                                                                                                                 |
| Beyond the limit? | **Hidden, never deleted.** A read-time clamp — the rows stay and upgrading restores full history **retroactively**. No pruning job, no scheduled work, and consistent with B4's "never take away what someone made". Cost: storing history not being served |
| Where enforced    | Read time only. Snapshot **capture is never blocked** — an author at their limit still gets new snapshots; they just cannot see the oldest                                                                                                                  |

**Why capture must stay unblocked:** D1's accept path captures a `pre_edit` snapshot inside the same
transaction that settles a suggestion (`f6827e0`). Blocking capture on a plan limit would make
**accepting a suggestion fail** for a free author — turning a monetization limit into a correctness
bug in the collaboration flow. Clamp the read; never the write.

**Scope — the enabler (S).**

- `maxSnapshotHistory` in each tier's `limits`.
- Clamp `GET /stories/:id/snapshots` (`publishing.controller.ts:162`) to the N most recent for the
  story owner's plan. Return the true total alongside the clamped list so clients can say "5 of 32
  versions — see plans" rather than pretending 32 do not exist.
- **`GET /snapshots/:id` (`:184`) and `POST /stories/:id/snapshots/:snapshotId/revert` (`:195`) must
  also refuse a hidden snapshot**, with the same remedy. Clamping only the list view leaves revert as
  an open door for anyone who kept an old id — the exact shape of an unenforced gate.
- Reverting is the feature history exists for, so the refusal copy matters: this is "upgrade to reach
  older versions", not an error.

**Scope — the clients (XS each, both platforms).** Publishing surfaces already list snapshots on both
platforms (mobile's `publishing_workflow_screen`, web's `snapshot-list`), so this is a count line plus
an upsell state — no new screens.

#### What shipped (2026-08-08)

**The sentinel, stated because the neighbouring row inverts it.** `maxSnapshotHistory` uses the
**ordinary** convention — `0` = unlimited, exactly like `maxPieces`. B6's `maxCollaborators` is the
one inverted key in this codebase, and the two rows are easy to confuse because both resolve the
**story owner's** plan; the difference is that B6 needs to express _zero seats_ and B7 never needs to
express zero versions (Free is 5). So B7 stays out of `NEGATIVE_UNLIMITED_LIMIT_KEYS`, and that is
said in four places rather than remembered: the catalogue comment, `PlanLimits`' doc, the
`SnapshotHistoryService` doc, and a `monetization.config-service.spec.ts` case that asserts a single
stored `{maxSnapshotHistory: 0, maxCollaborators: 0}` catalogue resolves to **unlimited history and
zero seats**. Normalising the two conventions in either direction fails a test.

**Capture is untouched, and a test keeps it that way.** `POST /stories/:id/snapshots` has no plan
check, and neither does the private `write()` every capture path funnels through. Three tests hold
the line: `snapshot.service.spec.ts` builds `SnapshotService` with a `SnapshotHistoryService` that
**throws on contact**, so any plan check on the write fails there; `publishing.service.spec.ts` does
the same for the pre-existing capture case; and `suggestion.service.spec.ts` wires a **real**
`SnapshotService` into `SuggestionService.accept` with that same throwing stub, so the D1 path — the
one that captures a `pre_edit` version inside the settling transaction (`f6827e0`) — is asserted
across the two units rather than against a mock. Without that last one, every accept test stubs
`SnapshotService` and none of them would notice capture starting to refuse.

**Three doors, one decision.** `SnapshotHistoryService.window(storyId, ownerId)` resolves the visible
range; `list` clamps to it, `get` and `revert` refuse below it. Revert mattered most: it is the whole
reason a version history exists, so it is exactly the door someone holding an old id would try, and
clamping only the list would have left it open — the unenforced-gate shape
[48 §5.2](./48_PlatformParityRegister.md) catalogues seven instances of.

**The window's floor is a POSITION, not arithmetic.** `snapshotVersionAtOffset(storyId, limit - 1)`
reads the oldest visible version by offset rather than computing `maxVersion - limit`.
`pruneSnapshots` deletes older prunable rows while keeping `publish`/`review` ones forever, so
versions have gaps; the arithmetic would hide rows inside the window and reveal rows outside it. The
clamp is also applied in SQL (`listSnapshots(storyId, take)`), because a snapshot row carries the
whole story body and fetching 100 to show 5 would read the hidden versions into memory on every list.

**The list response changed shape**, from `SnapshotDto[]` to `SnapshotHistoryDto`
`{ items, total, visible, hidden, limit, unlimited }`. The true total has to ride with the clamped
list: five rows out of thirty-two look exactly like five rows out of five, so a client reading only
the array would report "5 versions" — false — and the hidden ones would be invisible rather than for
sale. This is not a freeze amendment: `/stories/:id/snapshots` was added by AF6 on 2026-07-20, after
the 2026-07-09 `v1` baseline of 102 paths ([25 §1](./25_BackendFreeze.md)), and its only consumers
are the two clients this row also ships.

**A distinct code, `SNAPSHOT_HISTORY_LIMITED` (402).** Not `QUOTA_EXCEEDED`, whose "wait, it resets"
remedy would never arrive (the W4 defect, [48 §3.6](./48_PlatformParityRegister.md)). Not
`PIECE_LIMIT_REACHED` or `COLLABORATOR_LIMIT_REACHED` either, even though both are 402 stock caps:
those refuse to CREATE and their remedies are "delete a piece" / "remove a collaborator", and
deleting things is precisely what does **not** make an older version visible here. And not a 404 —
the row exists. The message is an upgrade sentence: _"Your plan shows the 5 most recent versions of a
story. Version 3 is still saved — upgrade to open it."_

**The clients** got a count line and an offer, no new screens:

| Part    | Web (`snapshot-list.tsx`)                                                 | Mobile (`publishing_workflow_screen.dart`)  |
| ------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| Count   | "5 of 32 versions" beside the "Versions" heading                          | same string, beside the "Snapshots" heading |
| Offer   | tinted row at the **end of the list**, where the hidden versions would be | same, same copy, `QTokens` tint             |
| Copy    | "27 older versions are saved but not shown." + "Nothing was deleted — …"  | identical                                   |
| Action  | "See plans" → billing plans                                               | same                                        |
| Capture | stays enabled, asserted by a test                                         | same                                        |

Both are driven off `total`, never `items.length`, and both fall silent when nothing is withheld —
"3 of 3 versions" is noise beside a list already showing three rows.

**Verified.** Backend 1154 tests · `tsc` · `eslint` clean. Frontend 733 tests · `tsc` · `eslint` ·
build clean. Mobile 714 tests · `flutter analyze` clean, with the a11y scan (contrast, labelled and
iOS tap targets) run on the new surfaces in **light and dark**. The §3.11 api-types guard was checked
and does not apply — the package carries no publishing namespace. Parity sweep:
[48 §6.5](./48_PlatformParityRegister.md).

---

### 4.12 W9 — AF4 story consumers (detail) ✅ **DONE 2026-08-08**

**What shipped.** Story Explorer and Ask My Book on the web, ported against mobile's two screens.
Both are **tabs on W2's in-editor AI drawer** rather than routes of their own — mobile reaches both
from the editor's AI overflow menu (`editor_screen.dart:280-291`), and this drawer is the web's
editor AI menu. W8's `/settings/ai` hub is deliberately not their home: it holds the ACCOUNT-scoped
surfaces (conversations, prompts, usage), and these two are per-story
([48 §4.1](./48_PlatformParityRegister.md)).

| Part        | Where                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| API layer   | `frontend/src/features/ai/api/story-retrieval.api.ts`                                                                            |
| Explorer    | `components/story-explorer-tab.tsx` + `components/graph-node-detail.tsx`, `hooks/use-story-explorer.ts`, `lib/explorer-views.ts` |
| Ask         | `components/ask-book-tab.tsx`, `hooks/use-ask-book.ts`, `stores/ask-book.store.ts`, `lib/ask-scopes.ts`                          |
| Entry point | `components/writing-assistant-panel.tsx` (two tabs, hidden until the draft has a server id)                                      |
| Wire type   | `AskBookStreamEvent` added to `@qalam/api-types`, exempted by name in the §3.11 guard                                            |

**The one piece of unanticipated work: the editor→AI seam had no story id.** `AiEditorTarget` carried
`selectionText / documentText / title / language / wordCount` and nothing identifying the piece, while
both new surfaces are per-story and must stay hidden until the draft has synced (mobile's
`st.draft.isRemote`). `storyId: string | null` now rides the same seam, registered by the editor from
its route param. It sits on the store rather than inside `AiEditorTarget` because it is a fact about
the document, not a capability of the editor.

**Why the API layer is not in `features/search`.** `retrieval.api.ts` owns every other `/ai/*`
retrieval endpoint, but it lives in `features/search` because that is the feature it serves. These two
hang off the editor, and a feature may never import another feature (docs/26 §4) — so they get a
sibling module in `features/ai`, split by consumer exactly as the existing one is.

**Why Ask streams into its own store.** The SSE **transport** is reused wholesale (`stream<T>()`
parses these frames with no AF4-specific code). The **state** is a sibling of `ai-stream.store.ts`
for three reasons that each break on their own: both streams can be live in one drawer and would share
a `text` buffer; the panel's availability gate treats `errorCode` as authoritative per tab, so a
shared code would let a wall on the assistant present as a wall on the ask; and the field sets diverge
in both directions (`sources` has no AF1 counterpart, `provider`/`model`/`finishReason` are never
forwarded here). Recorded in the store's own doc comment.

**Gating follows the two routes, which differ.** The explorer is `ai.use` only, with **no feature
flag and no model call**, so it resolves through a widened `resolveAvailability({ feature: null })`
that skips both the flag and the quota gate — a writer who has spent their allowance can still read
their own story graph. Ask additionally needs the `AskBook` flag, which AF1 seeds dark. Gating the
explorer on a neighbouring flag would hide a surface the server would have served; mobile calls out
the same distinction at `editor_screen.dart:241-247`.

**Verification — executed, not reasoned.** 688 frontend unit tests (36 new), 72 backend contract
assertions (up from 71), whole workspace typecheck + lint clean. The E2E half was **run against a live
local stack** rather than left as a claim:

| Ran                                                                                | Result                                                                                                                                                    |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two new axe scans × `frontend-chromium` + `frontend-dark`                          | **4/4 pass**, zero critical/serious violations in the new markup                                                                                          |
| `frontend-ai-panel.png` baselines × both themes                                    | **pass, unchanged** — they shoot a blank `/write`, where there is no story id and therefore no new tabs                                                   |
| `assistant.spec.ts` + `writing.spec.ts` (the panel and the editor seam W9 touched) | 9 pass, 1 pre-existing flake (**T-7**, [48 §3.5](./48_PlatformParityRegister.md)) — verified 3/3 green in isolation, which is that record's own signature |

**The first run of those scans failed 4/4, and the reason is worth keeping.** They were written on the
belief that the explorer "has no flag to raise", which is true of the ROUTE
(`story-explorer.controller.ts` carries `ai.use` alone) and false of the CLIENT: the tab resolves
through `resolveAvailability({feature: null})`, which still reads `aiEnabled` — the **master** flag,
seeded dark like every other. So the scans found "AI is turned off" and no chips. `api.enableAiFeatures`
had already written the correction in its own comment ("a per-feature flag alone resolves to `off`, not
`feature-off`"). Both scans now take the AI-flag lock, the explorer's with an EMPTY feature list, which
is what makes the asymmetry with Ask an assertion rather than a claim. The second half of the same
mistake: flags must go up **before** the panel opens, or the 60 s `staleTime` on `/ai/features` serves
the flag-down answer for the rest of the test.

**Found while building, fixed here (web).** A stream that closes without a terminal frame (a dropped
connection mid-answer) left the tab in `streaming` forever — spinner on Ask, no Try again, no way out
but closing the drawer. Mobile guards the same case in `ask_book_controller.dart:98-101`; the web did
not. Settled on loop exit, with a test that pins it. Recorded as **W9-1**.

**Found by the sweep, fixed on mobile the same day.** Two defects in the reference this row ported
_from_, both in [48 §6.2](./48_PlatformParityRegister.md) and both closed 2026-08-08:

- **W9-2** — Ask My Book was reachable with `feature.ai.askBook` down. The editor's overflow gated it
  correctly; the Story Explorer's app-bar action and a deep link did not, and the screen checked only
  the client's `enableAi`. The gate now lives on the screen, where all three doors lead.
- **W9-3** — `StoryGraphEdge.fromJson` dropped the `evidence` the backend sends on every edge, while
  `StoryGraphNode` parsed the identical field. Now parsed and serialised, `required` so it cannot
  silently regress.

They were opened as unowned mobile rows per step 1 (an epic delivers only what its row names) and then
taken as a scoped follow-up at the user's direction — recorded rather than folded into W9's own commit.

**One line worth keeping.** All **four** defects are the same shape — a correct rule applied in fewer
places than it holds (**W9-4** is in [48 §6.2](./48_PlatformParityRegister.md): the two a11y scans
asserted a surface the master AI flag had turned off) — and none was a misread of the contract, which
the audit found sound. That is the class a per-surface comparison catches and a per-endpoint one does
not.

### 4.13 B3 — profile lookup by id (detail) ✅ **DONE 2026-08-08**

The row had no §4.x spec — the table row was the spec. What shipped, and the three things worth
knowing before the next row touches an identity surface.

**The enabler.** `GET users/by-id/:id` on `ProfilesController`, mirroring B1's `pieces/by-slug/:slug`
shape exactly: `@Public()` + `OptionalAuthGuard`, `ParseUUIDPipe` on the id, the same
`ProfileResponseDto`, the same `USER_NOT_FOUND` 404, the same private-account teaser. Three path
segments against the username route's two, so no collision — the same reasoning B1 documented, in the
same place. Additive under the freeze (docs 25 §Amendments, §3 here). `ProfileResponseDto` is
**unchanged and is not pinned** by the `@qalam/api-types` guard ([48 §3.11](./48_PlatformParityRegister.md)),
so there was nothing to regenerate — verified, not assumed.

The visibility rules are **not duplicated**: `getPublicProfile` and `getPublicProfileById` each do
one lookup and hand the `User | null` to a shared `buildPublicView`. Six unit cases assert the two
paths return an identical DTO for every visibility state (public/private × stranger/follower/pending/
owner/signed-out), and the e2e asserts it live through the real guard stack, including that a stranger
gets the SAME teaser both ways.

**The N+1 question, measured.** Cost is one request per **DISTINCT user per view**, not per row —
asserted on both clients rather than asserted about: web renders four rows naming two people in **2**
requests (TanStack query-key dedup), and mobile answers 21 reads of two ids with **2** repository
calls (`keepAlive` family). Against that, the realistic worst cases:

| Surface                       | Rows                | Distinct users = requests                                     |
| ----------------------------- | ------------------- | ------------------------------------------------------------- |
| Comment thread / suggestions  | 20 default, 50 max  | ≤ owner + `maxCollaborators` → **4** on Plus; ≤ 50 on Pro/Ent |
| Collaborators list            | = roster            | same seat bound → **4** on Plus                               |
| Publishing (history/versions) | small, story-scoped | the story's actors, in practice **1–4**                       |
| **Blocked list**              | **unpaginated**     | **= number of blocks. Unbounded.**                            |

The first three are bounded by B6's seat cap and are fine at any thread length. **The blocked list is
not**: `TrustRepository.listBlocks` has no limit and every row is a different, arbitrary user, so a
reader with 200 blocks costs 200 lookups on one screen. That is the only genuinely bad case, it is
**pre-existing** (the list was already unpaginated), and B3 does not make it worse in kind — it makes
it visible.

**Recommendation, not built here:** a batch lookup (`GET /users/by-ids?ids=…`, capped at one page)
plus pagination on `me/blocks`. Both are separate rows — the constraint on this row is explicit that a
batch endpoint is not to be built inside it, and neither client needs one at current list sizes.

**Clients.** Web's `CollaboratorIdentity` no longer takes a `username` prop: the id resolves every
time, the docblock describing the workaround is gone, and the resolution moved to
`hooks/use-collaborator-identity.ts` so the presence bar shares it (its private `shortId` is gone
too). `MemberList`'s `ownerUsername` prop went with it — nothing passed it. Mobile had no equivalent
component at all; it now has `actorProfileProvider` + `ActorName` / `ActorAvatar` / `ActorIdentity`,
and **ten** call sites route through them: the six the row listed plus the collaborators member row,
its two snackbars, the presence bar and publication history. Two of the four were worse than a short
id: `PresenceEntry.label` is `displayName ?? userId` and `PresenceDto` sends no `displayName`, so a
screen reader announced the **raw** uuid; and `PublicationEvent` parsed an `actorName` the wire has
**never** sent (`PublicationEventDto` carries `actorId` only), so every history row rendered no actor
at all. That phantom field is removed — the same defect class as C-4 / C-5 / M-1. Web's
`publication-history.tsx` already resolved `actorId`, so this was mobile catching up, not a new
divergence.

**The fallback stayed.** A deleted account, a failed lookup, or a first paint still renders the short
id — it stopped being the default, it did not disappear. `shortActorId` moved to `shared/util/` as the
single definition. Both clients assert it: a failed lookup shows `019f…6ebe`, never a blank row and
never an invented name.

**Visual baselines.** Five surfaces render resolved names now, so **20 baselines** move (5 × chromium
/ firefox / webkit / dark): `frontend-collaborators`, `frontend-comments`, `frontend-suggestions`,
`frontend-settings-blocks`, `frontend-story-publishing`. They must be re-minted by the web-e2e
workflow's visual job in the pinned image ([e2e/10 §8.3](./e2e/10_Runbook.md)) — never locally.
Determinism was checked **first**, and it was not free: four of the five show the seeded writer
(`e2e_writer`, fixed), but the blocked list shows throwaway users whose pen name defaults to
`data.username()`, a per-run **variable-length** string. Masking hides a row's pixels, not its box, so
that would have minted an unstable baseline. Those two users now get fixed pen names
(`api.setPenName`).

---

---

## 5. Track A — admin (parallel with W, independent)

`A1` monetization ✅ · `A2` ~~collaboration/trust~~ **trust** ✅ · `A3` retrieval ✅ · `A4` story graph ⏸.
All **M**,
all consuming shipped backends. Deliberately lower priority: admin already covers the operational surface
(31 route modules), so these add reach, not readiness.

**A2's name in that list was wrong** and is struck through above rather than silently edited, because the
row was scoped from it. Collaboration has **no admin controller**: `collaboration.controller.ts` is
`@Controller()`, user-scoped, and the module contains no admin equivalent. There was never a
collaboration admin screen to build.

### A1 — monetization ✅ **DONE 2026-08-17** (sweep [48 §6.14](./48_PlatformParityRegister.md))

Sliced three ways on the W3 / W5 / W7 precedent, each landing green on its own. **Fourteen** endpoints,
not fifteen — the count in the row's own brief was wrong, and `admin-monetization.controller.ts` carries
exactly 14 route decorators (§6.14).

| Slice   | Commit    | What shipped                                                                                                                                                                                                  |
| ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1a** | `f8644ea` | `/billing/plans` (resolved catalogue + cross-cutting config) and `/billing/entitlements` (read, grant, revoke). The feature skeleton, `RequirePermission(billing.manage)`, and 7 nav entries in **Platform**. |
| **A1b** | `ea3335d` | `/billing/coupons` (list, create, activate/deactivate) and `/billing/actions` (credit adjustment + refunds).                                                                                                  |
| **A1c** | `7ae5ca9` | `/billing/revenue`, `/billing/subscriptions`, `/billing/usage` — three read-only dashboards on the P7.4 idiom, each with an honest empty state.                                                               |

**Gates:** admin `pnpm typecheck` clean, `eslint --max-warnings=0` clean, **61 test files / 259 tests**
(from 53 / 156), `pnpm build` clean. **E2E:** `tests/admin/monetization.spec.ts` (17 tests across the
three slices) plus extensions to the existing `rbac.spec.ts` and `a11y.spec.ts` — the a11y scans run in
light AND dark with no new config, because the `admin-dark` project already re-runs `a11y.spec.ts`. Two
visual baselines are **deliberately unminted** (`admin-billing-plans.png`, `admin-billing-actions.png`,
× 4 admin projects); only the web-e2e workflow's visual job may mint them.

**The audit corrected the brief in twelve places and found six backend gaps**, all recorded in §3
(A1-1 … A1-7) and none fixed — the backend is frozen. The three that shaped the UI: no admin route
reads another user's subscription or credit balance, and none lists payments, so A1 does **not** close
"an operator cannot see a subscription". `PATCH config` writes 4 of its 7 fields. Plans have no admin
writer at all. Full reasoning in §6.14.

#### A1 enablers ✅ **DONE 2026-08-17** (row **B8**; sweep [48 §6.15](./48_PlatformParityRegister.md))

The row that makes the paragraph above false. It closes all seven gaps A1 recorded and deletes the
compensating copy A1 wrote in their place — a stale apology being worse than the gap it described.

| Commit    | What it closed                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cd05b0a` | **A1-3, A1-5, A1-7** — three `admin/monetization/users/:userId/*` reads (subscription, payments, credits), each pure plumbing over a service method that already existed. |
| `3d5695b` | **A1-1, A1-2, A1-4, A1-6** — `PAYMENT_NOT_REFUNDABLE`; the config DTO's remaining three properties; three coupon response fields; `byCurrency` on revenue analytics.      |
| `de85f6b` | The seven UI sites, rewired to real data with their apology copy deleted.                                                                                                 |
| `7be6b9f` | Browser coverage for the two flows that only exist now — the refund picker and the subscription drill-through.                                                            |

**It breaks the "no backend expansion" default of §7 deliberately**, as B1 and B7 did, and with B7's
lighter ceremony rather than B1's: `admin/monetization` is AF5, outside the frozen 102-path baseline,
so the change is recorded in [25 §9](./25_BackendFreeze.md) with every consumer moved in the same
commit, and needs no ADR or version bump. §8 still binds one thing hard, and A1-6 obeys it — the
per-currency breakdown is ADDED beside `totalRevenue` and the four scalars keep their types.

**Gates:** backend `tsc` clean, `eslint --max-warnings=0` clean, **150 suites / 1254 tests** (from
146 / 1216), `nest build` clean. Admin `tsc` clean, lint clean, **63 files / 290 tests** (from 61 /
259), `vite build` clean. **E2E:** `admin-chromium` **53** tests (was 47), `admin-dark` **15** (was
14), including a fourth monetization a11y scan. No visual baseline minted; the two pending ones are
unchanged and still named in `visual.spec.ts`.

**Two things deliberately left.** The zero clamp on credit deduction stays (over-spend is prevented
upstream, and the confirmation now projects the clamped result honestly), and the plan catalogue is
still read-only — `updatePlans` is unexposed, which is not one of the seven. One new gap was opened
and not fixed: **B8-1**, an admin per-account read cannot distinguish an unknown user from one with no
data.

### A2 — trust ✅ **DONE 2026-08-18** (sweep [48 §6.16](./48_PlatformParityRegister.md))

**Trust admin, not "collaboration/trust"** — see the correction above §5's list. Five shipped routes on
`trust.admin.controller.ts`, all consumed, no backend change.

| Commit    | What shipped                                                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `d0fa3fa` | The reads: `GET users/:id/trust` + `GET users/:id/restrictions`, one panel with two entry points — a Trust tab on the user detail drawer and a `/trust` route — plus the clients' own vocabulary, copied. |
| `c865737` | The mutations: `POST users/:id/strikes`, `POST users/:id/restrictions`, `DELETE restrictions/:id`. Each confirmed; all three gated on `trust.manage` while the reads gate on `trust.view`.                |
| `d22343b` | Browser coverage: `tests/admin/trust.spec.ts`, two RBAC tests, two a11y scans (light + dark, via the `admin-dark` project), one visual baseline named and unminted.                                       |

**Two entry points, and the second one is not decoration.** The drawer tab is the right place to READ a
standing — it is where an operator suspends the account, so the two sanctions can be told apart there.
But `/users` is gated `RequireRole min={Role.Admin}` while `Role.Moderator` is the one role whose grants
explicitly name `trust.view` + `trust.manage`, so a drawer-only surface would have been invisible to its
primary operator. The `/trust` route carries `RequirePermission(trust.view)` and sits below the admin
floor. Same panel, same words, same actions.

**Gates:** admin `eslint --max-warnings=0` clean, **67 test files / 347 tests** (from 63 / 290),
`vite build` clean. **`pnpm typecheck` and `pnpm build` are RED with 18 pre-existing errors**, all in
`features/monetization` and identical with this row's diff stashed — recorded as **A2-6** (48 §3), and
the reason §6.15's "Admin `tsc` clean" was not true when written. **E2E:** `admin-chromium` 69 tests
(was 53), `admin-dark` 18 (was 15); `admin-trust.png` is deliberately unminted, one candidate of four
after a determinism check. The browser suite was **NOT executed** — no stack on this machine.

**The audit corrected the brief in five places and found six gaps** (A2-1 … A2-6, all in 48 §3, none
fixed — the backend is frozen). The two that shaped the UI: **A2-1**, the account suspension and the
trust `suspended` restriction are disjoint and neither implies the other, so the panel explains the
difference in three places instead of reconciling it; and **A2-2**, no route lists or revokes a strike,
so the escalation figure in the confirmation is an honest projection rather than a confirmed total.

#### B9 — A2's six findings, closed ✅ **DONE 2026-08-18** (sweep [48 §6.17](./48_PlatformParityRegister.md))

A2's follow-up row, same day. **The premise A2 built on was wrong in one place, and correcting it is what
made the row small:** A2 recorded "the backend is frozen" as the reason its six findings could not be
fixed, but the Trust module is AF6, added after the 102-path `v1` baseline — so the two missing routes
were always additive and always available. `admin/trust` is in the freeze log at
[25 §9](./25_BackendFreeze.md) with no ADR and no version bump, exactly as B7 and B8 were.

| Commit    | Closes                    | What shipped                                                                                                                                                 |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `6a7a102` | **A2-6**                  | All 18 admin type errors, the production one by deleting a redundant annotation, plus the regression test that was missing. §6.15 struck in place and dated. |
| `acaf5a7` | **A2-5**                  | `TrustStatus.Banned` marked RESERVED where it is declared, with where a ban actually lives.                                                                  |
| `045c28f` | **A2-1** (backend)        | The Policy Engine's fifth self-registered port: `users.status` is read, `AccountStatusRule` ordered above the trust rule.                                    |
| `86fbe37` | **A2-4, A2-2, A2-3**      | The trust GET stops writing and 404s an unknown id; `GET users/:id/strikes` and `DELETE strikes/:id`; the lift/revoke split documented.                      |
| `8f86d16` | **A2-2, A2-1, A2-3** (UI) | The strike list with a revoke action, the account-status badge, and every hedge this row invalidated deleted.                                                |
| `fae7ee5` | the new routes            | Browser coverage for the list and the revoke — and four specs repaired that had been using A2-4 as a fixture.                                                |

**Three decisions, answered before any Phase-2 code.** The one worth reading is DECISION 1: convergence
went ONE way. The Policy Engine now refuses a suspended ACCOUNT — the direction that was a security hole,
since a closed account read as being in good standing for every decision it could reach. A trust
suspension still does **not** refuse a login, and that was declined with reasons rather than deferred:
`assertCanSuspend` reserves account closure for admins while trust restrictions need only `trust.manage`,
`maybeEscalate` reaches the trust suspension automatically at six strike weight with no human deciding,
and `TokenService.rotate` reads neither status nor trust so a login block would stop only people who log
out. **Nobody's ability to sign in changed.** DECISION 2 found A2-3 dissolves once a revoke exists — the
two remedies are distinct on purpose — and DECISION 3 marked `Banned` reserved rather than standing up a
third sanction system.

**Gates, before → after.** Backend jest **150 suites / 1254 tests → 152 / 1288**; `tsc`, `nest build` and
lint clean throughout. Admin `pnpm typecheck` **18 errors → 0**, `pnpm build` **failing → clean**, lint
clean throughout, vitest **67 files / 347 tests → 67 / 363**. E2E `tsc` + lint clean; `admin-chromium`
**69 → 75**, `admin-dark` 18 unchanged. The browser suite was **NOT executed** — no stack on this machine,
so the specs typecheck, lint and collect, and nothing more is claimed.

**One new gap: B9-1** (48 §3.17) — `POST /admin/users/:id/suspend` is not retryable. `setStatus` commits,
then `logoutAll` runs un-transacted, and a retry throws `UserStatusConflictException` before reaching the
revocation — so a failed suspend leaves the account closed with live sessions and no path that completes.
Same shape in five places. Not fixed: frozen v1 paths, and the fix is a design choice. A2-1's port shrinks
its blast radius, which is why it is medium.

### A3 — retrieval ✅ **DONE 2026-08-19** (sweep [48 §6.20](./48_PlatformParityRegister.md))

**The last unheld row on either track.** Two admin surfaces over AF4's three admin routes —
`GET`/`PUT /admin/ai/search-config` and `GET /admin/ai/search-analytics` — at
`/ai-settings/search-config` and `/ai-settings/search-analytics`, both behind `ai.manage`.
Report: [55](./55_WebAiRetrievalAdminReadinessReport.md).

**Folded into the existing `features/ai` slice rather than given its own feature**, and that was forced
rather than chosen: `admin/src/features/ai/api/ai.api.ts` declares itself "the only place `/admin/ai/*`
endpoints are named", and `AdminRetrievalController` is mounted on `admin/ai`. The 2026-08-17 sizing note
said A3 "folds in; very small" — the folding held; "very small" did not, because the audit found three
defects in the surface itself. It also said **2** routes; there are **3** (the config has a read and a
write).

**Three fixed, one recorded** (48 §3.20, all in AF4 and therefore additive — checked before accepting
"frozen", which is what A2 failed to do):

- **A3-1 (medium)** `avgConfidence` shared the integer `mean()` used for milliseconds, so the endpoint's
  central quality figure could only ever return **0 or 1**. It had never had a consumer, and A3's
  dashboard is the first — a page rendering `1.00` is more convincing than one rendering nothing.
- **A3-2 (medium)** the aggregation is capped at 5,000 rows newest-first (correctly), but `totalQueries`
  was that count and nothing in the response revealed the truncation, so a busy install's figures
  described the newest slice while the heading claimed the window. `truncated` was added to the contract —
  **A3's only contract extension**, made because an honest surface was otherwise impossible.
- **A3-3 (medium)** the two config tables accepted any key and any value; a non-numeric weight then fails
  the planner's `weight > 0` test and **silently removes the signal from ranking**. Closed at the write
  path (enum-key allowlists + member checks, the B8 `IsRateTable` shape) and at the read path (the
  "defensive" merge defended against a non-object, not a bad member inside one).
- **A3-4 (low, open)** `AsyncSection` is now duplicated **five** times. Still not a feature row's refactor
  to make, but the count is named so the sixth is not added silently.

**Bounds moved to `@qalam/shared` once** (`RETRIEVAL_CONFIG_BOUNDS`, `SEARCH_ANALYTICS_DEFAULT_WINDOW_DAYS`),
read by the DTO, the controller default and the admin form — the AF1 `AI_PARAM_BOUNDS` idiom. The DTO had
hardcoded four ranges and documented a fifth it did not enforce.

**The E2E write saves the form unchanged, deliberately:** `ai.retrieval.config` is global and the frontend
AF4 specs run in parallel asserting ranked results and a grounded answer, so a mutated topK or a disabled
source would change their subject matter mid-run. Same conclusion B8 reached for `monetization.config`.

**And the suite was RUN** — 7/7 functional, 2/2 a11y in **both** themes, 1/1 RBAC, plus the whole
admin-chromium suite at 77 passed / 1 known contention failure (verified in isolation). A1 and B8 shipped
with specs that had never executed; A3 is the first admin row where the browser evidence exists at
hand-off.

---

## 6. Track M — marketing site

Config only: real `NEXT_PUBLIC_FIREBASE_*` values for the waitlist, the production domain, and social
links. Hours, not days. See `qalam-web/DEPLOYMENT.md`.

---

## 7. What this roadmap is NOT

- **Not a backend expansion.** One additive endpoint (B1). If an epic appears to need more, that is a
  signal to re-read the existing platform docs (34–38) before writing a controller.
- **Not a redesign.** Every surface uses the shipped design system and tokens.
- **Not a reason to defer dark mode or E2E again.** Both are step-5 obligations, not follow-ups —
  deferring them is exactly how the debt in [e2e/10 §8](./e2e/10_UIQuality.md) accumulated.
