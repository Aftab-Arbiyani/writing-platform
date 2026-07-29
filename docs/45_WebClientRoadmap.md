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

| Surface       | State                                                                                                                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend**   | ✅ Complete through P7.4 + AF1–AF6.                                                                                                                                                                                                          |
| **Mobile**    | ✅ Complete: M1–M10, AF1–AF6, P7.1–P7.4. The most feature-complete surface, and the **reference implementation** for every W-track epic.                                                                                                     |
| **Frontend**  | Features: `auth, feed, writing, profile, search, settings, notifications, analytics, ai, reading`. `reading` ✅ shipped (W1); `ai` ✅ has its first surface (W2 — in-editor assistant + Craft Coach). **No monetization. No collaboration.** |
| **Admin**     | 31 route modules — users, moderation, analytics, audit, security, privacy, system, ten operations consoles, AI settings. **Nothing for AF3, AF4, AF5, or AF6.**                                                                              |
| **Marketing** | Built (`qalam-web`); blocked only on config — Firebase values, domain, socials.                                                                                                                                                              |

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

| #      | Epic                                                                                                  | Size | Rationale                                                                                                                                                                                                  | Unblocks               |
| ------ | ----------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **B1** | By-slug read endpoint + freeze amendment ✅ **done**                                                  | S    | Hard prerequisite for W1                                                                                                                                                                                   | W1                     |
| **W1** | **Reader page** `/p/:slug` ✅ **done**                                                                | M    | The product hole. Backend contract and mobile's full `reading` feature both exist to port from — [report](./46_WebReaderReadinessReport.md)                                                                | E2E reader row; W3, W4 |
| **W2** | **AI writing assistant UI** (AF2) ✅ **done**                                                         | S–M  | The data layer is already built — best value-to-effort ratio on the list — [report](./47_WebAiAssistantReadinessReport.md)                                                                                 | E2E `af2` row          |
| **W3** | Collaboration / publishing / trust (AF6) — **3 slices, [design](./49_WebCollaborationEpicDesign.md)** | L    | Touches both the editor and the reader, so it needs W1 and W2 to exist first                                                                                                                               | —                      |
| **W4** | Monetization (AF5)                                                                                    | M    | Gating needs something to gate: premium pieces (W1) and metered AI (W2)                                                                                                                                    | E2E `af5` row          |
| **W5** | AF4 retrieval-backed discovery / search                                                               | M    | An upgrade of the existing M3/M6 `/discover` + `/search` surfaces rather than a new one                                                                                                                    | —                      |
| **W6** | AF3 story-intelligence client                                                                         | L    | **Held.** No client exists on any platform and there is no product definition — it needs a shape before it is an engineering task                                                                          | —                      |
| **W7** | Engagement & parity backfill (**both clients**)                                                       | M–L  | Closes the unowned gaps [48 §5](./48_PlatformParityRegister.md) has been flagging: conversation layer on web, collections, clap/report, reader analytics, privacy prefs, and **P-2** (composing @mentions) | —                      |
| **W8** | Remaining AI surfaces (**both clients**)                                                              | M    | AI conversations, prompt library, AI usage — mobile-shipped, no W row owned them                                                                                                                           | —                      |
| **D1** | **Decision:** what does accepting a suggestion mean?                                                  | S    | **P-1**, [48 §5.1](./48_PlatformParityRegister.md) — correctness-shaped; a product call, not an engineering one                                                                                            | the client half of P-1 |

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

**W3 is _not_ closed.** The single remaining gate is the visual baseline for `frontend-collaborators`,
un-minted since W3a. It could not be minted here: there is no GitHub credential in this environment
(`gh` absent, no token, no credential helper), so `develop` cannot be pushed and `web-e2e` cannot be
dispatched — and minting locally is forbidden by [e2e/10 §8.3](./e2e/10_UIQuality.md), which this pass
respected by deleting the two host-rendered PNGs Playwright wrote. **To close:** push `develop`, run
`web-e2e` with `update_visual_baselines: true`, commit the artifact ([49 §6h](./49_WebCollaborationEpicDesign.md)).
Note the baselines requested for `story-publishing`, `settings-blocks` and comments/suggestions have **no
`@visual` tests yet**, so those must be written before they can be minted.

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

**W8 — remaining AI surfaces.** AI conversations, the prompt library, and AI usage: mobile has all
three, web has none, and W5/W6 cover discovery/search/ask and the story explorer respectively. Same
open stack caveat as `af2` — no AI provider in the E2E stack ([e2e/06 §6](./e2e/06_PhasePlan.md)).

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
