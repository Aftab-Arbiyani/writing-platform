# 51 — W5 Discovery & Search Readiness Report

> ⚠️ **AMENDED BY D5, 2026-09-03** ([48 §5.2](./48_PlatformParityRegister.md#d5--the-ai-surface-is-removed-the-tools-stay-owner-2026-09-02)). The retrieval surface certified here survives; its framing
> does not. Search is now **public** (no account, no flag, no `ai.use`), there is no keyword-vs-AI
> mode toggle and no grounded "AI answer" — the engine never called a model except for that one
> branch, which is gone. Recommendations keep their engine and lose their flag. The scope tabs,
> filters and paging this report describes are **kept** as refinement over the retrieval results.

**Epic:** W5 — AF4 retrieval-backed discovery / search ([45 §4.6](./45_WebClientRoadmap.md)) ·
**Status:** ✅ complete, verified against a running stack · **Date:** 2026-08-04

> **What this closes.** AF4 shipped a reusable Retrieval Platform and a mobile client, and the web had
> neither. The roadmap row is explicit that this is **an upgrade of the existing `/search` and
> `/discover` surfaces, not a new one** — so every part of it had to be additive: a signed-out reader,
> and any deployment that has not raised the AF1 flags, must keep exactly the search they had. That
> constraint shaped the whole epic, and the E2E suite asserts it rather than assuming it.

---

## 1. What shipped

| Area                        | Delivered                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI search**               | `mode=ai` in the URL beside the existing keyword engine — ranked, grounded results with a reason, a relevance stated in the accessible name, related entities, and evidence.                      |
| **The engine switch**       | Two `aria-pressed` buttons, rendered **whatever** AI's availability, because hiding them would make a dark-launched deployment look like a build without the feature.                             |
| **Synthesised answer**      | Opt-in per session ("Explain these results") — the only part of search that spends the reader's allowance, so it is never spent for them.                                                         |
| **Query suggestions**       | A "Try instead" row beside the results rather than a dropdown while typing: this page debounces into the URL, so results are already on screen and a dropdown would flicker over its own answer.  |
| **Saved searches**          | The reader's named, server-side searches on the search landing, a save dialog on a result set, delete, and a re-run that restores the **engine** as well as the query.                            |
| **Discover shelves**        | Two AF4 recommendation shelves above the editorial ones, each item carrying the server's reason. Silent when the flag is down, for a signed-out reader, or when empty.                            |
| **Reader "More like this"** | Now prefers the recommender for a signed-in reader (the `pieceId` parameter W5 implemented), and keeps W1's tag search for everyone else — including when the recommender answers empty or fails. |
| **Availability gating**     | One app-level gate read shared by three features, with five blocked states — off, feature-off, quota, needs-a-plan, and **signed-out** (§3).                                                      |

### 1.1 Backend

Three changes, all made **before** the client was written, because a step-0 contract audit found the
wire did not contain what the row assumed ([48 §3.9](./48_PlatformParityRegister.md)):

- **`pieceId` was documented on both sides and read by nothing** (W5-2). A piece-seeded
  `related_stories` request fell through to community trending — "Popular right now" wearing a
  recommendation's clothes. Now implemented: the seed is read through `PiecesService.getById` **as the
  caller**, so the piece's own visibility rules decide; terms come from its tags with a title fallback;
  the seed is excluded from its own results; every item explains the relationship.
- **The recommender was writing machine-composed queries into the reader's search history** (W5-5) —
  and into the global keyword trends that feed discovery. Fixed at the source with an internal
  `recordHistory` option, default unchanged.
- **Synthesis was decided by a cached plan** (W5-8, found in Phase 3) — see §3.

`@qalam/api-types` also declared a search-filter shape the DTO rejects outright (W5-1, the third
instance of that class after W4-2 and W4-5). Corrected before the web API layer existed, and pinned by
a spec asserting the request body has no `filters` key.

### 1.2 One gate, three features

`features/ai`, `features/search` and `features/reading` all need to know whether an AI feature may be
used, and **a feature may never import another feature** ([26 §4](./26_FrontendArchitecture.md)). The
resolution is the same move-down W1 made for the author card: the pure resolver went to
`lib/ai-availability.ts`, the hook to `hooks/use-ai-availability.ts`, and the blocked-state notice to
`components/ai-availability-notice.tsx`. They share `qk.ai.*` with `features/ai`'s own hooks, so a
reader who opens the assistant and then three piece pages makes **one** flag request, not four.

That move-down is also what caused this epic's most serious defect — §3.

---

## 2. Verification

Executed against a running stack on an **existing, long-lived database** (no reset, no reseed):
Postgres, Redis, MinIO, Mailpit, the built backend on `:4000`, the **built** frontend on `:5173` and
admin on `:5174`.

| Gate                             | Result                                                                                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit — frontend (`vitest`)       | **554 passed / 103 files** (515 before W5; +39 across the retrieval layer, the four surfaces, and the gate)                                                                                                           |
| Unit — backend (`jest`)          | **1012 passed / 137 suites**; the retrieval subset is 57 across 14                                                                                                                                                    |
| Unit — admin (`vitest`)          | **156 passed / 53 files** — untouched by W5, run because the gate is workspace-wide                                                                                                                                   |
| Unit — packages                  | **31 passed** (`@qalam/utils`)                                                                                                                                                                                        |
| Build (`pnpm build`, turbo)      | **7 tasks clean** — `tsc -b` + `vite build` for both apps and `nest build` for the backend, not `--noEmit`                                                                                                            |
| Lint (`pnpm lint`, turbo)        | **9 tasks clean**, zero warnings                                                                                                                                                                                      |
| Bundle budget (`perf:budget`)    | **within budget** — entry 144.4 kB gz; the AF4 route chunk (`search-*.js`) is 8.1 kB gz                                                                                                                               |
| E2E — chromium (functional+a11y) | **99 passed**, and **4 consecutive green whole-project runs** after the flake work in §4                                                                                                                              |
| E2E — a11y, light **and** dark   | **47 passed** — zero critical/serious, and `KNOWN_A11Y_FINDINGS` is still empty                                                                                                                                       |
| E2E — firefox                    | **19 passed** on the W5 specs                                                                                                                                                                                         |
| E2E — webkit (pinned image)      | **96 passed, 0 failed, 3 flaky** — all three in specs W5 does not touch (§4)                                                                                                                                          |
| E2E — visual (pinned image)      | **13 of 16 frontend baselines match byte-for-byte in both themes**, including the two W5 touches (reader, AI panel). Three do not reproduce locally — see §4. The one new spec correctly fails for want of a baseline |

### 2.1 The `af4` E2E rows

Five new rows in [e2e/06 §2.1](./e2e/06_PhasePlan.md), and **nothing is mocked at the app boundary**:
the flags are real rows flipped through the admin API, the search is the real `POST /ai/search` through
the real planner → retrievers → ranker → context assembly, and the answer is the real AF1 orchestrator
with only the vendor replaced by the `stub` port.

The order the specs are written in is deliberate: the **flag-down refusal comes first**, because AF1
seeds every AI flag disabled and that is what every deployment shows on the day it ships, and
**keyword search proven unaffected comes second**, because that is the row's additive promise.

### 2.2 What the live database proved, quoted

`ai.use` and the `pieceId` enabler were verified over the wire rather than inferred:

```
POST /ai/search              (no token)          → 401 UNAUTHORIZED
POST /ai/search              (writer, flags down) → 403 AI_DISABLED
POST /ai/search              (writer, flags up)   → 200, sources ["keyword","metadata"], 3 results
POST /ai/search              (a freshly registered account, flags up) → 200
   ⇒ the default role's ai.use grant is real on this database, not just in the seed
GET  /ai/recommendations?kind=related_stories&pieceId=<seed>
   → 1 item: the sibling only, seed excluded, reason "Shares tags with “…”: <tag>",
     influencedBy [{type:"tag", relation:"shared tag"}]
GET  /ai/recommendations?kind=related_stories            (no pieceId — the pre-W5 behaviour)
   → "Popular right now" trending items
```

---

## 3. Three defects W5 introduced, all found by running it in a browser

Recorded in full in [48 §3.9](./48_PlatformParityRegister.md) (W5-6…W5-8). None was visible to a unit
test; each needed a real client against a real stack.

1. **A signed-out reader's piece page never rendered (high).** The shared gate hook (§1.2) is called
   unconditionally — hooks cannot be conditional — and both its endpoints need a session. So a public
   reading page began issuing two authenticated reads, and a 401 outside `/auth/*` is **terminal** to
   the api client: one silent refresh, then the unauthorized handler, which ends the session **and
   clears the whole query cache** — discarding the piece whose own read had already succeeded. Every
   anonymous reader spec went red; the log showed 35 anonymous 401s on `/ai/features`, 35 on
   `/ai/usage/me`, and 26 failed refreshes in a single run. Fixed at the gate: **no session, no
   request**, and a new `signed-out` state that offers the one action which resolves it.
2. **Re-running a saved search used the keyword engine.** Two URL patches in one handler both saw the
   same pre-navigation snapshot, so the second dropped `mode=ai` — the reader's saved question answered
   by a different engine and called the same search.
3. **"Explain these results" produced no answer.** Synthesis was gated on the **cached** retrieval
   plan, and the cache key rightly omits `synthesize`, so for 120 s whichever value arrived first won.
   Load results, then ask for an explanation: nothing, no error, and a toggle showing on.

### 3.1 And one the parity sweep found

**In AI mode the filter bar was either absent or wrong** (W5-11). It was gated on a scope tab that AI
mode deliberately does not have, so on a normal AI search it rendered **nothing** — the language/genre
mapping this epic built, and that W5-1 corrected `api-types` for, was unreachable — while a reader
arriving from the Pieces tab kept `type=pieces` and got reading-time, publish-date and sort controls
that `SemanticSearchDto` ignores. Both halves are now one gate: render for the AI engine on its own
terms, and offer only what it accepts. Two unit specs and one E2E assertion pin it.

---

## 4. Harness work this epic forced

- **The AI feature flags now have a cross-worker mutex** ([48 §3.9 W5-9](./48_PlatformParityRegister.md)).
  They are single global rows; four spec files disagree about them, and `describe.serial` cannot order
  across files. The restore runs on its own request context, because a test that exceeds its timeout has
  its context torn down first — and a leaked raised flag then fails every flag-down assertion in the run
  for a reason unrelated to the code under test. **A `globalSetup`/`globalTeardown` pair** resets the
  flags to dark at both ends of the run, for the case the mutex cannot cover: a worker killed outright
  runs no `finally` at all, which is exactly what cost the first WebKit run two spec failures.
- **Two flakes were fixed by asserting something truer, not by waiting longer**
  ([W5-10](./48_PlatformParityRegister.md)): a modal closed after an axe scan never disappears (the scan
  stops the animations rc-motion needs to remove the element), and demanding this test's own sibling in
  the recommender's top four was asserting the ranker over a corpus of thousands of E2E pieces.
- **Three visual baselines do not reproduce on this host, and none of them is a W5 surface.**
  `frontend-comments` (both themes, 3/3 runs), `frontend-suggestions` (dark 3/3, chromium 1/3) and
  `frontend-collaborators` (chromium 2/3) fail in the pinned image, and the diff says why: the **whole page
  sits ~21px lower** in one render than the other — every text row appears twice in the diff, offset — with
  the masked list bands differing top and bottom as a consequence. That is precisely the drift
  `visual.spec.ts` documents for pages sitting marginally past the 720px fold, and the reason those three
  were switched to viewport capture in the first place; viewport reduced it without eliminating it. The
  subset that fails **changes per run**, which is what separates a flake from drift: a code change would fail
  the same shot every time. Not fixed here — they are not W5's, and the fix is a capture-stability question
  for [10 §2.2](./e2e/10_UIQuality.md). **What this costs is honesty about coverage**: a local visual run can
  confirm 13 of the 16 frontend baselines, and CI's job is the authority for the other three.
- **Three pre-existing WebKit flakes**, in specs W5 does not touch, all recovering on retry: the
  unauthenticated login and register a11y scans measure a **mid-fade** colour (`#918b82` where the token
  is `#726c61`, i.e. the same colour part-way through an entrance animation — the class
  [10 §8.1](./e2e/10_UIQuality.md) fixed once already), and `publishing.spec.ts`'s safety-page unblock.
  Recorded, not fixed here: they are not this epic's, and the fix for the first two belongs in the a11y
  fixture's settling step.

---

## 5. Deliberately not in W5 — and what is NOT asserted

| Not shipped / not asserted                         | Why                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vector / embedding search**                      | **"AI search" is not vector search on this platform today.** `VectorRetriever.isAvailable()` returns `false` — there is no embedding store ([36](./36_AiRetrievalArchitecture.md)) — so results come from keyword + metadata (+ the graph when story-scoped). Live proof: `meta.sources: ["keyword","metadata"]`. The ranking, grounding and explanation are real; the _semantics_ arrive when embeddings do, with no consumer change. |
| **A real model behind the answer**                 | The synthesised answer runs through the real orchestrator but the `stub` provider, so its HTTP/SSE dialect, error and rate-limit behaviour, and prose quality are unasserted — the same trade W2 and W4 made and documented ([e2e/06 §6](./e2e/06_PhasePlan.md)).                                                                                                                                                                      |
| **Ask My Book / Story Explorer**                   | AF3-backed surfaces, and `GET /ai/explorer/:storyId/:view` is W6's row. W6 is **held** for want of a product shape. The audit also found both need an owned story _and_ a built graph (W5-4).                                                                                                                                                                                                                                          |
| **Graph-node navigation**                          | A result whose target is a `graph_node`, `chapter` or timeline cue renders as a plain card, because the web has nowhere to send it until W6. Mobile shows a detail sheet — an arrangement difference, recorded in [48 §4.1](./48_PlatformParityRegister.md).                                                                                                                                                                           |
| **A populated AI result set as a visual baseline** | The content and height of a live ranking differ every run; masking enough to stabilise it would leave only the chrome. The baseline is the **refusal** state instead ([e2e/10 §2.3](./e2e/10_UIQuality.md)).                                                                                                                                                                                                                           |
| **Responsive coverage of the new surfaces**        | The responsive subset is curated and still covers login + the admin users journey; AI search and the shelves are not in it. Stated plainly rather than implied — the filter bar's mobile sheet in AI mode is therefore unasserted at small widths.                                                                                                                                                                                     |
| **The three premium feature codes**                | `ai_discovery`, `premium_search` and `premium_recommendations` exist in the catalogue and **no server route enforces them** ([48 §5.2](./48_PlatformParityRegister.md)); B2 establishes the enforcement pattern and is held. W5 gates on flags + `ai.use` only.                                                                                                                                                                        |
| **A dropdown of suggestions while typing**         | Mobile's arrangement, and wrong for a live-results page (§1). Same endpoint, same purpose — [48 §4.1](./48_PlatformParityRegister.md) territory, not a gap.                                                                                                                                                                                                                                                                            |
| **Three of mobile's five shelves**                 | `Trending`, `Authors` and `Genres` run the same services the editorial sections on `/discover` already render, so they would print the same rows twice on one page. The two that add something are the ones shipped.                                                                                                                                                                                                                   |
| **An offline mirror of saved searches**            | Mobile keeps a device-local copy merged with the server list; a browser has no offline story to serve, so the server list is the only source. Recorded as an arrangement difference.                                                                                                                                                                                                                                                   |

---

## 6. What W5 unblocks, and what it leaves

**Unblocked:** nothing was waiting on W5 — it was the last of the sequenced client rows
([45 §4](./45_WebClientRoadmap.md)). What it _leaves_ is the state of the W-track: `W6` held for a
product shape, `W7` (engagement + parity backfill) and `W8` (the remaining AI surfaces) unclaimed,
`B2` held, and the admin A-rows — including the AF4 retrieval/ranking configuration console the
settings-backed `RetrievalConfigService` is already built for — untouched.

**One open gate, the standing one for any new visual spec:** `frontend-search-ai-off` has no committed
baseline, and only the `web-e2e` workflow's visual job may mint one
([e2e/10 §8.3](./e2e/10_UIQuality.md)). Of the baselines that CAN be checked locally, 13 of 16 match in both
themes and three do not reproduce (§4); Firefox, WebKit and the admin projects were not re-verified locally
at all, because CI's visual job covers all eight and W5 changed no admin surface. So the row hands over one
deliberate red — a baseline minted anywhere but that job is worse than no baseline — plus the three
pre-existing offset-sensitive pages, which are CI's to confirm.
