# 53 — Web Conversation Layer Readiness Report (W7a)

**Status:** ✅ Shipped 2026-08-10 · **Row:** [45 §4.4](./45_WebClientRoadmap.md) W7, rows 1–2 ·
**Reference:** mobile (`lib/features/social`, `lib/shared/widgets/social`) ·
**Register:** [48 §6.8](./48_PlatformParityRegister.md) (sweep), [§4.1](./48_PlatformParityRegister.md)
(arrangement), [§3.14](./48_PlatformParityRegister.md) (defects found)

---

## 1. What shipped

Readers on the web could not comment on a piece, reply to a comment, or respond to one at all —
`frontend/src/features/` had no `social` feature and the reading view had no comment UI. Mobile has
shipped the whole layer since M-era. W7a closes it.

| Surface                 | What a reader can now do                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Comments on a piece** | Read the thread (signed in or out), cursor-paginated. Post a comment. Reply. Edit their own, with `editedAt` shown. Delete their own → tombstone, replies preserved. |
| **Reply threads**       | Expanded lazily per comment, driven by `replyCount` → `GET /comments/:id/replies`, itself paginated                                                                  |
| **Responses**           | Read the public list. "Write a response" → `POST` → the returned draft, opened in the editor                                                                         |

Both are **inline sections at the end of the reading page**, under the author card and above "More
like this" — the arrangement decision, recorded in [48 §4.1](./48_PlatformParityRegister.md) and
discussed in §3.1 below.

**No backend work.** All eight endpoints were already shipped and were verified field-by-field against
the DTOs before a line was written (§2).

---

## 2. The pre-flight audit — and it came back clean

[48 §6 step 2](./48_PlatformParityRegister.md) exists because three consecutive AF6 surfaces were
audited and **all three were broken** (M-1, M-2, M-3). So the contract was checked first, and this time
it agreed with the reference on every point:

| Endpoint                     | Shape                                           | Verdict                                                              |
| ---------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| `POST /pieces/:id/comments`  | `CreateCommentDto` = `{ body }`, nothing else   | ✅ mobile sends exactly this                                         |
| `GET /pieces/:id/comments`   | `@Public()` + `OptionalAuthGuard`, cursor       | ✅                                                                   |
| `POST /comments/:id/replies` | the **same** `CreateCommentDto`; parent in URL  | ✅ — a `parentId` in the body would 400 under `forbidNonWhitelisted` |
| `GET /comments/:id/replies`  | `@Public()` + `OptionalAuthGuard`, cursor       | ✅                                                                   |
| `PATCH /comments/:id`        | owner only; server sets `editedAt`              | ✅                                                                   |
| `DELETE /comments/:id`       | soft delete → 204, tombstone                    | ✅                                                                   |
| `POST /pieces/:id/responses` | `CreatePieceDto` → `PieceResponseDto` (a draft) | ✅ mobile sends `{title?, languageCode}`                             |
| `GET /pieces/:id/responses`  | `@Public()` + `OptionalAuthGuard`, cursor       | ✅                                                                   |

**Two properties of `CommentResponseDto` shaped the whole design**, and both are the opposite of AF6's
collaboration comment:

1. **The author is embedded** (`author: CommentAuthorDto | null`). So W7a needs **no** by-id profile
   lookup. This is exactly the gap that forced B3 for the collaboration DTOs, which carry bare ids —
   wiring `useProfileById` in here would have been one request per commenter for a name already on
   the wire. `author: null` is handled as its own state, not as a missing field.
2. **Replies are not in the payload.** `replyCount` plus a separate resource. Assuming a `replies`
   array that the wire does not send is precisely what left mobile's collaboration threads unable to
   display a single reply (M-3).

---

## 3. Decisions

### 3.1 Inline sections, not two routes — and why that is not a parity gap

Mobile pushes `comments_screen` and `responses_screen` from a two-row footer on the reader. Web keeps
both **on the piece's own page**.

The reasoning: a phone has no room for a thread under an article, so mobile's footer rows are a
navigation affordance standing in for the surface. A browser page scrolls and has the room. More
decisively, the reading view's URL is the piece's **canonical** URL — the one Share copies, the one
`<Seo canonicalPath>` declares, the one sign-in returns to. Putting the conversation on it makes the
thread shareable and deep-linkable (`#conversation`); a separate `/p/:slug/comments` route would mint a
second URL for one piece and take the prose away from the reply being written.

**Order follows mobile's footer exactly** — comments, then responses, then "More like this" — so the
only difference is the arrangement, not the sequence.

**It is recorded in [48 §4.1](./48_PlatformParityRegister.md), and that sentence is the point.** W5's
parity sweep had to retroactively add four rows because each epic's _code comments_ claimed they were
"recorded in 48 §4.1" and none of them was. A claim in a comment is not a record.

### 3.2 App level, so no feature imports another feature

The conversation straddles the boundary: the thread is read on the **reader** and writing a response
ends in the **editor**. Features may never import features (docs/26 §4), so everything shared moved
down, following the W1 (reader ↔ profile) and W2 (editor ↔ AI) precedent:

| Placement                       | What                                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| `lib/query-keys.ts`             | `qk.conversation.*` — its own namespace (§3.3)                   |
| `types/conversation.ts`         | the wire shapes                                                  |
| `lib/conversation-api.ts`       | the only place the eight endpoints are named (docs/32 §10)       |
| `hooks/use-piece-comments.ts`   | list + lazy replies + the four writes                            |
| `hooks/use-piece-responses.ts`  | list + the create-draft mutation                                 |
| `hooks/use-permission.ts`       | the `piece.create` affordance hint                               |
| `components/conversation/`      | composer, comment item, the two list sections, the section shell |
| `lib/routes.ts` → `draftPath()` | the route the response flow composes to reach the editor         |

`features/reading` imports `@/components/conversation` and nothing from `features/writing`;
`features/writing` is untouched apart from `piece-row.tsx` adopting `draftPath()`.

### 3.3 `qk.conversation`, deliberately not `qk.comments`

`qk.comments.thread` already exists and belongs to **AF6 collaboration** — a story's private review,
`modules/collaboration`. These are `modules/engagement` piece comments. A shared prefix would make a
co-author resolving an inline note on a draft invalidate a stranger's public thread, and vice versa.
Different module, different entity, different privacy model, different cache root.

### 3.4 Invalidate, don't splice

Every comment write refetches rather than patching the cache optimistically. The server owns `depth`,
`editedAt`, the tombstone **text**, and every `replyCount`; a client that guessed them would render a
comment that does not match what the next reader sees. Delete especially: the row must survive as a
tombstone, so removing it locally would take its replies with it.

**Mobile's offline write queue was deliberately not ported.** Mobile is offline-first via `SyncEngine`;
web has no offline write story by design ([48 §4](./48_PlatformParityRegister.md), "Partly inherent").

### 3.5 Read public, write gated — never the other way round

All three reads are `@Public()`. A signed-out reader sees the whole conversation and gets a sign-in
link where a composer would be. This is asserted, not assumed, in both unit and browser tests, because
**W5-6 shipped an authenticated read on a public page** and the 401 cleared the query cache and broke
the page for every signed-out visitor ([48 §3.9](./48_PlatformParityRegister.md)).

### 3.6 A response ends in the editor

`POST /pieces/:id/responses` creates a linked **draft piece** and returns it; the flow navigates to
`/write/:draftId`, pre-titled after the parent. No inline response composer, on either client — a
response is a piece and deserves the editor. This is the assertion the browser spec makes most
carefully, because "looked wired and was not" is this codebase's repeated defect class (R-1, M5-1,
W5-3, W8-1).

---

## 4. Scope held

Named because each of these was physically adjacent to the work and cheap to have added:

| Excluded                             | Why                                                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **@mentions**                        | **P-2**, and it touches both clients. `CreateCommentDto` has no `mentions` field; none was added                                    |
| **Clap + report**                    | **W7b** — including reporting a comment, even though mobile's `report_sheet.dart` sits in the same directory as the comment widgets |
| **Collections**                      | **W7b**                                                                                                                             |
| **Reader analytics / privacy prefs** | **W7c**                                                                                                                             |
| **Onboarding**                       | Blocked — needs a product shape for web before it is an engineering task                                                            |

Also **not** ported: mobile's newest/oldest sort toggle, which sorts only the loaded page under cursor
pagination and so does not do what it says. Reasoning in [48 §6.8](./48_PlatformParityRegister.md).

---

## 5. Verification

| Gate                            | Result                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm typecheck` (frontend)     | ✅ clean — **and it was red before this work**, on a pre-existing B3 spec (§6)                     |
| `pnpm lint` (frontend)          | ✅ clean                                                                                           |
| `pnpm test` (frontend)          | ✅ **795 passed / 126 files** — 38 new across 5 spec files                                         |
| `pnpm build` (frontend)         | ✅ clean                                                                                           |
| `pnpm typecheck` / `lint` (e2e) | ✅ clean                                                                                           |
| E2E functional                  | ✅ **11/11**, run against the real stack — chromium **2/2 runs green**, firefox **2/2 runs green** |
| E2E a11y (axe, WCAG A+AA)       | ✅ green in **light and dark** (`frontend-chromium` + `frontend-dark`), zero critical/serious      |
| E2E visual                      | ⏳ **4 baselines pending a CI mint** — see below                                                   |
| WebKit                          | ⚠️ not runnable locally ("host system is missing dependencies") — CI-only engine, as documented    |

### The required test cases, and where each is asserted

| Case                                                  | Unit                                          | Browser                                     |
| ----------------------------------------------------- | --------------------------------------------- | ------------------------------------------- |
| Signed-out reader sees both surfaces, no composer     | `comment-list`, `response-list`, `piece-page` | `conversation.spec.ts`                      |
| Signed-out reader's piece page still renders (W5-6)   | `piece-page.spec.tsx`                         | `conversation.spec.ts`                      |
| A reply loads from `/comments/:id/replies` and nests  | `comment-item`, `comment-list`                | `conversation.spec.ts`                      |
| Deleted comment shows its tombstone AND keeps replies | `comment-item`, `comment-list`                | `conversation.spec.ts`                      |
| `author: null` renders honestly                       | `comment-item`                                | `conversation.spec.ts`                      |
| Editing shows `editedAt`                              | `comment-item`                                | `conversation.spec.ts` (survives a reload)  |
| Cannot edit/delete someone else's comment             | `comment-item`                                | `conversation.spec.ts` (as the other party) |
| Writing a response lands in the editor with the draft | `response-list`                               | `conversation.spec.ts`                      |

Every browser test arranges over REST, loads the real page, and reads the result off the screen — and
the persistence-sensitive ones **reload** before asserting, so an optimistic paint cannot pass for a
write.

### Visual baselines — CI must mint these four

`frontend-conversation.png`, in the four projects that run visual specs:

```
frontend-conversation-frontend-chromium-linux.png
frontend-conversation-frontend-firefox-linux.png
frontend-conversation-frontend-webkit-linux.png
frontend-conversation-frontend-dark-linux.png
```

**Nothing was minted locally, and that was verified rather than assumed.** The local run reached the
screenshot call and failed with "A snapshot doesn't exist" — the config's `updateSnapshots: 'none'`
refusing, exactly as [48 T-8](./48_PlatformParityRegister.md) requires. Only the `web-e2e` workflow's
`web-e2e-visual` job may mint, inside the pinned image ([e2e/10 §8.3](./e2e/10_UIQuality.md)). **A red
spec asking for a baseline is the correct state until then.**

---

## 6. Defects found

Two, and one of them was blocking far more than this row.

### B4-1 — the browser suite could not arrange content (**closed**)

B4's 25-piece free-plan cap is enforced on `POST /pieces`, which is how nearly every frontend spec
arranges content — as the **one shared seeded writer**. So arrange itself returned
`402 PIECE_LIMIT_REACHED`. `reader.spec.ts` was failing **8 of 10** on a clean checkout, and it is not
merely a stale-database problem: one suite pass creates far more than 25 pieces as that writer, so a
**fresh** database trips it too. The suite has had no green run since B4 landed.

Fixed in the harness, not the product: `seed:e2e` now lifts the E2E stack's free-plan `maxPieces` to
`0` (unlimited), the same category of stack configuration as the `RATE_LIMIT_ENABLED=false` beside it.
Verified: `reader.spec.ts` + `writing.spec.ts` back to **13/13**. Full analysis in
[48 §3.14](./48_PlatformParityRegister.md).

### B4-2 — a response is counted toward the piece cap but never gated by it (**open, documentation only**)

Correct and deliberate behaviour, recorded only in a service doc comment. W7a's first draft believed
the cap applied and shipped copy saying so — plausible and wrong, corrected from the service before
commit. It belongs in [45 §4.9](./45_WebClientRoadmap.md)'s description of the cap.

### Also fixed: a pre-existing typecheck failure

`collaborator-identity.spec.tsx` (B3) built a `StoryPresence` with `updatedAt` instead of `lastSeenAt`
behind an `as` cast, failing `tsc --noEmit` for the whole repo on a clean `develop` (confirmed by
stashing). Fixed rather than worked around: a gate that is already red cannot verify anything.

### Mobile follow-up opened

**M7-1** (low, unowned): `comment_composer.dart` hardcodes `maxLength: 2000` where
`COMMENT_MAX_LENGTH` is the shared constant the DTO validates against. Agrees today; a drift waiting to
happen, of the class [48 §3.11](./48_PlatformParityRegister.md) closed for `@qalam/api-types`. Web reads
the shared constant.

---

## 7. What W7 still owns

**W7b** — collections (list + detail), clap (1..50 accumulating), report.
**W7c** — reader analytics, privacy prefs.
**P-2** — composing @mentions, on both clients.
**Onboarding** — still blocked on a product shape for web.
