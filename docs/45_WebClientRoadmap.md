# 45 — Web Client Roadmap (W-track)

**Status:** 🚧 In progress · **Scope:** close the gap between a backend/mobile that shipped AF1–AF6 and
two web clients that did not. **No new backend platforms.** Every epic below consumes a contract that
already exists and is already exercised by the mobile app; the one exception (B1) is a deliberately
additive read endpoint, justified in §3.

> **The shape of the problem.** Every AF epic shipped **backend + mobile** and deferred **frontend +
> admin**. The backend is complete through P7.4; mobile is complete through M10 + AF1–AF6. The web
> reader/writer app is missing whole surfaces — most starkly, **it can publish a piece but cannot
> read one**. This doc is the ordered plan to close that, and it is the analog of
> [`18_DevelopmentRoadmap.md`](./18_DevelopmentRoadmap.md) for the web clients.

---

## 1. Current state — what actually exists

Measured, not assumed (routes read from `frontend/src/lib/routes.ts` and `admin/src/lib/routes.ts`).

| Surface       | State                                                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend**   | ✅ Complete through P7.4 + AF1–AF6.                                                                                                                                                                                                            |
| **Mobile**    | ✅ Complete: M1–M10, AF1–AF6, P7.1–P7.4. The most feature-complete surface, and the **reference implementation** for every W-track epic.                                                                                                       |
| **Frontend**  | Features: `auth, feed, writing, profile, search, settings, notifications, analytics, ai`. **`ai` is headless** (api + stores + hooks + types, no components, no route, zero importers). **No reader page. No monetization. No collaboration.** |
| **Admin**     | 31 route modules — users, moderation, analytics, audit, security, privacy, system, ten operations consoles, AI settings. **Nothing for AF3, AF4, AF5, or AF6.**                                                                                |
| **Marketing** | Built (`qalam-web`); blocked only on config — Firebase values, domain, socials.                                                                                                                                                                |

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

| #      | Epic                                     | Size | Rationale                                                                                                                         | Unblocks               |
| ------ | ---------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **B1** | By-slug read endpoint + freeze amendment | S    | Hard prerequisite for W1                                                                                                          | W1                     |
| **W1** | **Reader page** `/p/:slug`               | M    | The product hole. Backend contract and mobile's full `reading` feature both exist to port from                                    | E2E reader row; W3, W4 |
| **W2** | **AI writing assistant UI** (AF2)        | S–M  | The data layer is already built — best value-to-effort ratio on the list                                                          | E2E `af2` row          |
| **W3** | Collaboration / publishing / trust (AF6) | L    | Touches both the editor and the reader, so it needs W1 and W2 to exist first                                                      | —                      |
| **W4** | Monetization (AF5)                       | M    | Gating needs something to gate: premium pieces (W1) and metered AI (W2)                                                           | E2E `af5` row          |
| **W5** | AF4 retrieval-backed discovery / search  | M    | An upgrade of the existing M3/M6 `/discover` + `/search` surfaces rather than a new one                                           | —                      |
| **W6** | AF3 story-intelligence client            | L    | **Held.** No client exists on any platform and there is no product definition — it needs a shape before it is an engineering task | —                      |

### 4.1 W1 — Reader page (detail)

New `frontend/src/features/reading/`, route `/p/:slug`, public with `OptionalAuthGuard` semantics.
Ported from mobile's `lib/features/reading/`, which already solves every hard part:

- **Content rendering** — TipTap JSON → React, reusing the existing `.qalam-prose` class, which
  [already styles both the editing surface and the read-only preview](../frontend/src/styles/global.css)
  so what a writer sees is what a reader gets. Only the whitelisted node/mark set the server accepts.
- **Reader preferences** — font size / theme, mirroring mobile's `reader_preferences_controller`.
- **Engagement** — like / bookmark / share bar (mobile's `engagement_controller`).
- **Author card + related pieces** — mobile's `reader_author_card`.
- **RTL** — Urdu/Nastaliq flows from the element `dir`, with the `--q-leading-nastaliq` leading token.
  This is a day-one requirement, not a follow-up ([07 §Typography](./07_DesignSystem.md)).
- **SEO/meta** — the reason the slug URL exists at all; a piece page needs real title/description tags.

**E2E impact:** flips the reader row, adds `reader.spec.ts`, and upgrades the feed/search specs from
link-URL assertions to real render assertions — the deferral recorded in
[e2e/06 §4](./e2e/06_PhasePlan.md) is discharged here.

### 4.2 W2 — AI writing assistant UI (detail)

Only components and a route are missing. Wire the existing `use-ai-completion` / `ai-stream.store`
into the editor as a side panel: streaming output, suggestion accept/reject, and the Craft Coach
surface. Mobile's `features/ai` is the reference. Must be built with W4's metering in mind — every AI
request meters through the `AI_USAGE_METER` hook, so the UI needs a quota-exhausted state from day one.

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
