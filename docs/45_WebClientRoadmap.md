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

| Surface       | State                                                                                                                                                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend**   | ✅ Complete through P7.4 + AF1–AF6.                                                                                                                                                                                                                                        |
| **Mobile**    | ✅ Complete: M1–M10, AF1–AF6, P7.1–P7.4. The most feature-complete surface, and the **reference implementation** for every W-track epic.                                                                                                                                   |
| **Frontend**  | Features: `auth, feed, writing, profile, search, settings, notifications, analytics, ai, reading`. `reading` ✅ shipped (W1); `ai` ✅ has its first surface (W2 — in-editor assistant + Craft Coach); `collaboration` ✅ (W3); `monetization` ✅ (W4 — all five surfaces). |
| **Admin**     | 31 route modules — users, moderation, analytics, audit, security, privacy, system, ten operations consoles, AI settings. **Nothing for AF3, AF4, AF5, or AF6.**                                                                                                            |
| **Marketing** | Built (`qalam-web`); blocked only on config — Firebase values, domain, socials.                                                                                                                                                                                            |

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

| #      | Epic                                                                                                                 | Size      | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Unblocks                           |
| ------ | -------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **B1** | By-slug read endpoint + freeze amendment ✅ **done**                                                                 | S         | Hard prerequisite for W1                                                                                                                                                                                                                                                                                                                                                                                                                                         | W1                                 |
| **W1** | **Reader page** `/p/:slug` ✅ **done**                                                                               | M         | The product hole. Backend contract and mobile's full `reading` feature both exist to port from — [report](./46_WebReaderReadinessReport.md)                                                                                                                                                                                                                                                                                                                      | E2E reader row; W3, W4             |
| **W2** | **AI writing assistant UI** (AF2) ✅ **done**                                                                        | S–M       | The data layer is already built — best value-to-effort ratio on the list — [report](./47_WebAiAssistantReadinessReport.md)                                                                                                                                                                                                                                                                                                                                       | E2E `af2` row                      |
| **W3** | Collaboration / publishing / trust (AF6) — **3 slices, [design](./49_WebCollaborationEpicDesign.md)**                | L         | Touches both the editor and the reader, so it needs W1 and W2 to exist first                                                                                                                                                                                                                                                                                                                                                                                     | —                                  |
| **W4** | Monetization (AF5) ✅ **done**                                                                                       | M         | ⚠️ This row's stated premise was half wrong — **premium pieces do not exist** (see B2). Its one real gate is metered AI (W2) — [report](./50_WebMonetizationReadinessReport.md)                                                                                                                                                                                                                                                                                  | E2E `af5` row ✅                   |
| **B2** | **Premium content** — enabler + both clients ⏸️ **HELD**                                                             | S–M + M×2 | **Held 2026-07-29 at the user's decision: recorded, not scheduled.** Model chosen (tier-gated); see [§4.5](#45-b2--premium-content-held-detail)                                                                                                                                                                                                                                                                                                                  | the first real `isEntitled` caller |
| **W5** | AF4 retrieval-backed discovery / search ✅ **DONE 2026-08-04** — [report](./51_WebDiscoverySearchReadinessReport.md) | M         | An upgrade of the existing M3/M6 `/discover` + `/search` surfaces rather than a new one. Three phases: audit + data layer, the four surfaces, then E2E/a11y/visual — see [§4.6](#46-w5--af4-retrieval-backed-discovery--search-detail)                                                                                                                                                                                                                           | —                                  |
| **W6** | AF3 story-intelligence client                                                                                        | L         | **Held** — but the rationale below was **corrected 2026-08-05**: the _reading_ half already has a client. Scope is the **analysis lifecycle** only; see [§4.8](#48-w6--what-is-actually-left-in-it-corrected-2026-08-05)                                                                                                                                                                                                                                         | —                                  |
| **W7** | Engagement & parity backfill (**both clients**)                                                                      | M–L       | Closes the unowned gaps [48 §5](./48_PlatformParityRegister.md) has been flagging: conversation layer on web, collections, clap/report, reader analytics, privacy prefs, and **P-2** (composing @mentions)                                                                                                                                                                                                                                                       | —                                  |
| **W8** | Remaining AI surfaces ✅ **DONE 2026-08-05** — [report](./52_WebAiSurfacesReadinessReport.md)                        | M         | AI conversations, prompt library, AI usage — mobile-shipped, no W row owned them. Ended up **web-only**: the step-0 audit found mobile's conversations list cannot be populated at all ([48 §3.12](./48_PlatformParityRegister.md) W8-1), so web is now the working reference for that surface. Four mobile/platform follow-ups recorded, not fixed                                                                                                              | —                                  |
| **D1** | **Decision:** what does accepting a suggestion mean? ✅ **ANSWERED 2026-07-29** — server-side rewrite (`f6827e0`)    | S         | **P-1**, [48 §5.1](./48_PlatformParityRegister.md) — correctness-shaped; a product call, not an engineering one                                                                                                                                                                                                                                                                                                                                                  | the client half of P-1             |
| **D2** | **Decision:** does the reader's "more like this" get its backend enabler, or is the upgrade formally dropped?        | S         | **W5-2**, [48 §3.9](./48_PlatformParityRegister.md). `RecommendationQueryDto.pieceId` is advertised on both sides of the wire and read by nothing, so piece-seeded recommendations fall back to `trending.getFeed()` — "Popular right now" presented as a recommendation. Either an additive enabler implementing the parameter the contract already advertises, or W1's tag search stands and the upgrade is struck from §4.1                                   | the last W5 deliverable            |
| **D3** | **Decision:** is the free tier meant to have AI writing, or only a token budget?                                     | S         | [48 §5.2](./48_PlatformParityRegister.md). `monetization.plans` grants `free` the `ai_budget` feature with a 20k/day, 200k/month allowance but **not** `ai_writing`. If the server ever enforced `ai_writing`, that allowance becomes unspendable. **Blocks scoping D4** — the contradiction has to be resolved before any row makes the server assert its declared features                                                                                     | D4                                 |
| **D4** | **Decision:** do the seven unenforced premium feature codes get a backend row?                                       | M         | [48 §5.2](./48_PlatformParityRegister.md). The catalogue sells eight `PremiumFeature` codes and the backend asserts exactly **one** (`ai_budget`); `PolicyEngineService.isEntitled()` has zero callers, so a subscriber's plan is computed correctly and then ignored on every route but the AI meter's. Until answered, **no client may gate on the seven** — a client-only wall in front of a route the server serves. Depends on **D3**                       | B2 shares the enforcement path     |
| **B3** | Profile lookup by **id** (both clients)                                                                              | S         | Recorded 2026-08-05 after being carried in three consecutive epics' "improvements not done" lists. Retrieval, collaboration and publishing DTOs all carry user **ids**, but `GET /users/:username` is keyed by username — so every W3c surface (reviewer, snapshot author, history actor, blocked person) shows a **truncated id to real users**. Three slices worked around it; it is a missing contract, not a nicety. Additive backend enabler + both clients | W7's reader-analytics rows         |
| **B4** | **Piece limit per plan** — enabler + both clients                                                                    | S + S×2   | **New feature, requested and specified 2026-08-05.** A cap on how many pieces an author may have, by subscription tier. The first premium feature to gate the product's **core write path** rather than AI tooling. Full spec, including the three decisions already taken, in [§4.9](#49-b4--piece-limit-per-plan-detail)                                                                                                                                       | —                                  |
| **B5** | **Per-account "turn AI off"** — enabler + both clients                                                               | S + XS×2  | **New feature, requested and specified 2026-08-05.** An author disables AI for their own account. Server-enforced; governs the user, not the story. Cheap because `GET /ai/features` already answers "which AI features are enabled **for you**" and both clients already consume it — see [§4.10](#410-b5--per-account-turn-ai-off-detail)                                                                                                                      | —                                  |
| **B6** | **Collaborators per story, by plan** — enabler + both clients                                                        | S + S×2   | **New feature, specified 2026-08-05.** Free 0 · Plus 3 · Pro/Ent unlimited, counted against the **story owner's** plan. The seat lever — collaboration becomes a paid capability. Spec: [§4.11](#411-b6--collaborators-per-story-by-plan-detail)                                                                                                                                                                                                                 | —                                  |
| **B7** | **Version-history depth, by plan** — enabler + both clients                                                          | S + XS×2  | **New feature, specified 2026-08-05.** Free 5 · Plus 25 · Pro/Ent unlimited. **Hidden, never deleted** — a read-time clamp, so upgrading restores history retroactively. Spec: [§4.12](#412-b7--version-history-depth-by-plan-detail)                                                                                                                                                                                                                            | —                                  |

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

**W7 — engagement & parity backfill.** Mostly mobile → web, one item on both:

| Item                                               | Direction    | Notes                                                                        |
| -------------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| Conversation layer (piece comments + responses)    | mobile → web | Distinct from AF6 collaboration comments, which are a story's private review |
| Collections (list + detail)                        | mobile → web | 48 §2 item 4                                                                 |
| Clap (1..50 accumulating) + report                 | mobile → web | Scoped out of W1 deliberately; no row picked them up                         |
| Reader analytics (the reader's own stats)          | mobile → web | 48 §2 item 6                                                                 |
| Privacy prefs (bookmarks / reading-history counts) | mobile → web | Small — 48 §2 item 8                                                         |
| Onboarding first-run flow                          | mobile → web | Needs a product shape for web before it is an engineering task               |
| **P-2** composing @mentions                        | **both**     | `mentions` are resolved user **ids**; neither composer sends any today       |

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

### 4.9 B4 — piece limit per plan (detail)

**Requested and specified 2026-08-05.** A cap on how many pieces an author may have, varying by
subscription tier. Recorded here to be folded into a pending row rather than run as its own epic.

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

### 4.10 B5 — per-account "turn AI off" (detail)

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

---

### 4.11 B6 — collaborators per story, by plan (detail)

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

---

### 4.12 B7 — version-history depth, by plan (detail)

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

---

## 5. Track A — admin (parallel with W, independent)

`A1` monetization · `A2` collaboration/trust · `A3` retrieval · `A4` story graph. All **M**, all
consuming shipped backends. Deliberately lower priority: admin already covers the operational surface
(31 route modules), so these add reach, not readiness.

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
