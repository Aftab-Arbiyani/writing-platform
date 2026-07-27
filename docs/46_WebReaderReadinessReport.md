# 46 — W1 Reader Readiness Report

**Epic:** W1 — the reading view `/p/:slug` ([45 §4.1](./45_WebClientRoadmap.md)) ·
**Status:** ✅ complete, verified against a running stack · **Date:** 2026-07-27

> **The hole this closes.** The web app could publish a piece but could not read one. Every feed
> card, search result and notification deep link pointed at `/p/:slug`, and nothing was routed
> there — clicking a card landed on NotFound. The reading view is now live, public, and the
> destination those links promised.

---

## 1. What shipped

| Area               | Delivered                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Route**          | `/p/:slug`, lazy, public. Registered ahead of the bare `:handle` route so a static segment wins.                                                                                                                                |
| **Cold load**      | Loads through the additive `GET /pieces/by-slug/:slug` (B1). A UUID in the URL is sniffed and dispatched to `GET /pieces/:id` instead — the one case that produces one is an unpublished draft, which only its author can open. |
| **Content**        | TipTap JSON → React elements, **never** HTML. The node/mark set mirrors the server's sanitizer whitelist exactly; unknown nodes are dropped, not guessed at.                                                                    |
| **Typography**     | Shared `.qalam-prose` (identical to the editor's), plus reader-adjustable text size / line spacing / column width, persisted per device.                                                                                        |
| **RTL + Nastaliq** | `dir` and leading flow from the piece's own language. Nastaliq leading is floored at 2.1 regardless of the reader's spacing choice, and the Nastaliq face is lazy-loaded on demand.                                             |
| **Engagement**     | Like, bookmark and copy-link share — optimistic, with rollback and server reconciliation. Claps/responses render as read-only counts (see §4).                                                                                  |
| **Author card**    | Avatar, bio, follower count and an optimistic Follow, sharing the profile page's cache key so following on either surface updates both. Degrades to the piece's own byline on failure.                                          |
| **More like this** | Up to four pieces sharing the piece's first tag. Renders nothing when there is nothing to suggest.                                                                                                                              |
| **SEO**            | Real title/description/canonical/og per piece — the reason the slug URL exists. Drafts, unlisted and private pieces are `noindex`.                                                                                              |
| **States**         | Skeleton while loading; a distinct not-found state with a way back to the feed; a retryable error state carrying the request id.                                                                                                |

### 1.1 Backend

**None.** W1 consumes the frozen `v1` contract plus B1, which landed separately (`71624cd`). The
roadmap's "no backend expansion" rule ([45 §7](./45_WebClientRoadmap.md)) held.

### 1.2 Shared code moved down (not duplicated)

The author card needs the profile query, the follow mutation and the Follow button — all of which
lived in `features/profile`, and **a feature may never import another feature** ([26 §4](./26_FrontendArchitecture.md)).
Rather than duplicate ~150 lines of optimistic-follow logic, they moved _down_ to app level, which
is what that rule prescribes and what `hooks/use-me` already precedents:

| Was                                             | Now                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| `features/profile/hooks/use-profile.ts`         | `hooks/use-profile.ts`                                                  |
| `features/profile/hooks/use-follow.ts`          | `hooks/use-follow.ts`                                                   |
| `features/profile/components/follow-button.tsx` | `components/follow-button.tsx`                                          |
| `features/profile/api/profiles.api.ts`          | (deleted — the hook calls the fetch wrapper directly, as `use-me` does) |

`follows.api.ts` keeps the endpoints with a single consumer (requests inbox, follower lists).

---

## 2. Verification

Everything below was **executed**, not reasoned about, against the running stack: Postgres, Redis,
the backend on `:4000`, the **built** frontend on `:5173`, and admin on `:5174`.

| Gate                       | Result                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Unit (`vitest`)            | **287 passed / 71 files**, of which 29 in `features/reading` (13 new specs across 3 new files)                           |
| Types (`tsc -b`)           | clean                                                                                                                    |
| Lint (`eslint src`)        | clean                                                                                                                    |
| Build (`vite build`)       | clean                                                                                                                    |
| E2E functional (chromium)  | **46 passed** — whole frontend suite                                                                                     |
| E2E functional (3 engines) | **91 passed** — chromium + firefox + webkit                                                                              |
| E2E a11y (axe, light+dark) | **17 passed**, including the new `/p/:slug` scan in **both** themes                                                      |
| E2E responsive             | **7 passed** — the reader holds the strict **0px** horizontal-scroll gate at mobile and tablet                           |
| E2E visual (4 projects)    | **29 passed** — 4 new reader baselines, generated **in the pinned image**, and every pre-existing baseline still matches |

### 2.1 Reader E2E coverage (8 specs)

Cold load by slug (anonymous) · feed → rendered piece · author + engagement bar present · unknown
slug → not-found (not a crash) · typography adjustable **and persisted across reload** · anonymous
like → routed to sign-in carrying `returnTo` · signed-in like → `aria-pressed` flips **and survives
a reload** (proving a real write, not just optimistic paint).

### 2.2 Visual baselines

`frontend-reader-{chromium,firefox,webkit,dark}-linux.png`, produced inside
`mcr.microsoft.com/playwright:v1.61.1-noble` per [e2e/10 §8.3](./e2e/10_UIQuality.md) — never on a
dev machine's native browsers. The title (per-run unique) and the engagement bar (counts move as
other specs publish) are masked; everything else is compared.

**Dark mode was rendered, not reasoned about** ([e2e/10 §8.4](./e2e/10_UIQuality.md)): the reader
is scanned by axe and screenshotted in the `frontend-dark` project. No new contrast findings.

### 2.3 The `.qalam-prose` change is provably inert at defaults

Reader preferences work by indirecting the prose size and leading through two CSS variables, and
by expressing heading sizes as ratios of the body size. The editor never sets those variables, so
it must render byte-identically — and the **pre-existing editor baseline still matches on all four
projects**, which is the evidence, not the arithmetic.

---

## 3. E2E debt discharged

Two things this epic closes rather than adds:

1. **The Phase-2 render deferral** ([e2e/06 §2.1, §4](./e2e/06_PhasePlan.md)). `feed.spec.ts` and
   `search.spec.ts` could only assert that a card _linked_ to `/p/:slug`. Both now assert the piece
   actually **renders** at the destination. The phase-plan rows and the deferral note are updated.
2. **A real flake in `feed.spec.ts`.** Its click target was published inside a 21-piece
   `Promise.all`, so its feed position depended on how those creates interleaved _and_ on how many
   pieces the rest of the suite published concurrently — under a full parallel run it could be
   pushed past both loaded pages. Observed once, then fixed: the target is now published last and
   awaited on its own, so it is the newest piece in a newest-first feed.

---

## 4. Deliberately not in W1

Each of these is a scope boundary, not an oversight:

| Not shipped                            | Why                                                                                                                                                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clap / respond actions**             | Claps are a 1..50 accumulating gesture with their own interaction model; responses need the comment surface. Neither is "act on what you just read"; both belong to the engagement epic. Counts render read-only meanwhile. |
| **A recommender for "more like this"** | `GET /ai/recommendations` (AF4) needs auth **and** the `ai.use` permission, which a signed-out reader has by definition not got. Tag search is the honest v1; W5 upgrades it.                                               |
| **Reading progress / history**         | Not part of the roadmap bullet for W1.                                                                                                                                                                                      |
| **A bookmarks surface**                | `GET /me/bookmarks` has no web page yet, so bookmarking has no list to invalidate. Noted at the call site for whoever ships it.                                                                                             |

---

## 5. What W1 unblocks

`W3` (collaboration/publishing/trust) and `W4` (monetization) both needed a reader to attach to —
gating needs something to gate, and a premium piece needs a page to be premium _on_. Both are now
unblocked. `W2` (AI writing assistant UI) was never blocked by this and remains the next item by
value-to-effort.
