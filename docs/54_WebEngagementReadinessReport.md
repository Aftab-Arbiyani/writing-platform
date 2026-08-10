# 54 — Web Engagement Readiness Report (W7b)

**Status:** ✅ Shipped 2026-08-10 · **Row:** [45 §4.4](./45_WebClientRoadmap.md) W7, collections +
clap/report · **Reference:** mobile for collections and report; **web is the reference for claps** ·
**Register:** [48 §6.9](./48_PlatformParityRegister.md) (sweep),
[§4.1](./48_PlatformParityRegister.md) (arrangement), [§3.15](./48_PlatformParityRegister.md)
(defects)

---

## 1. What shipped

| Surface         | What a reader can now do                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Collections** | List their collections, create, rename, delete. Open one and see its pieces, paginated. Save a piece into one from the reader. Remove a piece from one. |
| **Claps**       | Clap repeatedly, watching the count climb, up to `MAX_CLAPS_PER_USER_PER_PIECE`. A burst is **one** request. Remove all their claps at once.            |
| **Report**      | Report a **piece**, a **comment**, a **response** or a **user** — one dialog, four mount points.                                                        |

Collections live at `/me/collections` and `/me/collections/:collectionId` — the **same paths mobile
uses**, so a link resolves on either client. No backend work: all ten endpoints were already shipped.

---

## 2. The pre-flight audit found the row's central premise false

[48 §6 step 2](./48_PlatformParityRegister.md) says to check the reference before porting. Collections
and report checked out — mobile ships both, fully, and the five reference files were read. **Claps did
not.**

The row said `mobile → web` for all three. It is wrong for claps: mobile's reader action bar is
**Like · Bookmark · Share · More**, `EngagementRepository` has no clap method, `ApiPaths` has no
`pieceClaps`, and **nothing in the app calls `POST /pieces/:id/claps`**. [48 §2 row 5](./48_PlatformParityRegister.md)
credited it with "clap (1..50 accumulating)" and was simply incorrect — the second §2 cell to
over-credit mobile after **W8-1**.

**This was escalated before any code was written**, because building a web surface mobile lacks is the
one failure mode [48 §1](./48_PlatformParityRegister.md) names. The decision: build it, web becomes the
reference, mobile takes the follow-up (**M7-3**). Full analysis in
[48 §3.15](./48_PlatformParityRegister.md).

So the clap design below comes from the **contract** — `ClapDto.count`,
`MAX_CLAPS_PER_USER_PER_PIECE`, the all-or-nothing `DELETE` — and not from a counterpart.

---

## 3. The clap interaction

Everything else in this row is CRUD. This is not, and web's own action bar had been saying so since
W1: _"claps are a 1..50 accumulating gesture with their own interaction model … [they] belong to the
engagement epic."_ That docblock is now rewritten, because a comment describing a deferral that has
happened is worse than no comment.

### 3.1 A burst is one request

`ClapDto` carries a `count` precisely so a client can batch. Clicks accumulate in a ref; **one** `POST`
flushes the total. Twenty requests would spend twenty rows of write-tier rate limit on one gesture and
race twenty `viewerClaps` answers back.

**The window is 600 ms of idle**, and both bounds are deliberate:

- **Above ~250 ms**, the slow end of a deliberate repeat-click cadence. A shorter window would split
  one gesture into several requests — the exact thing being avoided — and would split worst for the
  slowest clickers.
- **Below ~1 s**, past which an un-flushed count stops feeling saved. The reader has already seen the
  number move; the write should land while the gesture is still what they are thinking about.

It is an **idle** window, not a fixed interval: a continuing burst keeps deferring, so a long run is
still one request rather than one per window.

### 3.2 Losing a pending burst is a real failure, so it is handled

A debounce means there is always a window where the claps exist only in the hook. A reader who claps
and immediately navigates away would lose them. So the pending total also flushes on **unmount** and on
**`pagehide` / `visibilitychange`** — `pagehide` rather than `beforeunload` because the latter is
unreliable on mobile Safari and blocks the back/forward cache.

No durable outbox: web has no offline write story by design ([48 §4](./48_PlatformParityRegister.md)),
and mobile's `SyncEngine` queue is explicitly out of scope.

### 3.3 The cap stops the client, not just the server

`viewerClaps + pending` is clamped, and the check reads the **optimistic** count — so twenty clicks
from forty-nine produce one clap and nineteen no-ops, not a request for twenty that the server silently
clamps. At the cap the button is `disabled` with a name that says why. No error, no phantom increment,
**no request** (asserted by route interception).

The server clamps too and answers `CLAP_LIMIT_REACHED` to an already-maxed request — precisely the
error a reader hammering a full button must never be shown.

### 3.4 Removal is all-or-nothing, and says so

`DELETE` removes every clap this viewer has. There is no decrement endpoint, so there is no "−1" to
build: the control reads **"Remove my N claps"**. It appears only once the reader has some, and an
unflushed burst is abandoned when they press it — sending it afterwards would resurrect claps they just
removed. (That abandonment happens **synchronously**, not in the mutation's `onMutate`, which yields at
its first `await` and would let the debounce fire in the gap.)

### 3.5 Optimistic, reconciled

The count moves under the cursor; the settled `ClapResponseDto` is then adopted wholesale — the
viewer's number because the server clamped ours, the piece's because other readers moved it while the
page was open. A failed flush withdraws exactly what that flush carried and re-reads the truth, in
**silence**: a clap is a grace note, and a toast for a lost one costs more than the clap was worth.

---

## 4. Report: one component, four mount points

`ReportEntityType` is polymorphic and `POST /reports` takes the same body whatever the target, so four
bespoke dialogs would be four places for the reason catalogue and the 1000-char rule to drift apart.
Mobile reached the same conclusion in M7 (`report_sheet.dart` is one sheet). Web mounts one dialog on:

| Entity     | Where                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `piece`    | the reader's engagement bar, behind "More"                                                        |
| `comment`  | each comment in the thread W7a shipped — **the affordance W7a explicitly held back for this row** |
| `response` | each response row                                                                                 |
| `user`     | the profile header, beside Follow                                                                 |

Reasons come from `ReportReason` in mobile's order (`other` last); `description` is bounded by the
DTO's 1000 and **encouraged, not required**, for `other` — the DTO marks it optional whatever the
reason, so gating submit would refuse a report the server would take.

**The confirmation is honest**: `status` comes back `pending`, so the toast says the report was _sent
for review_, never that anything was done.

---

## 5. Verification

| Gate                                           | Result                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm typecheck` / `lint` / `build` (frontend) | ✅ clean                                                                            |
| `pnpm test` (frontend)                         | ✅ **842 passed / 131 files** — 46 new across 5 spec files                          |
| `pnpm typecheck` / `lint` (e2e)                | ✅ clean                                                                            |
| E2E functional                                 | ✅ **15/15** against the real stack — chromium **2/2 runs**, firefox **3/3 runs**   |
| E2E regression sweep                           | ✅ **73/73** (reader · conversation · engagement · writing · profile · feed · a11y) |
| E2E a11y (axe, WCAG A+AA)                      | ✅ green in **light and dark**, zero critical/serious                               |
| E2E visual                                     | ⏳ **8 baselines pending a CI mint** — below                                        |
| WebKit                                         | ⚠️ not runnable locally (missing host libs) — CI-only, as documented                |

### The required test cases

| Case                                                       | Where                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| A burst of N taps → ONE request with the accumulated count | unit (`clap-button`) + E2E (route interception counts the requests)    |
| Clapping stops at the cap — no error, no phantom increment | unit + E2E (asserts **zero** requests, and the server count unchanged) |
| Remove-claps clears all, not presented as a decrement      | unit + E2E (accessible name asserted exactly)                          |
| Signed-out reader sees counts, is routed to sign-in        | unit + E2E                                                             |
| Save from the reader → piece appears in that collection    | E2E (server-side **and** on the detail page)                           |
| Removing a piece leaves the piece untouched                | E2E (re-reads the piece in the reader afterwards)                      |
| Report submits for piece, comment, response **and** user   | E2E, one test each                                                     |
| `description` > 1000 refused client-side                   | unit + E2E (asserts **zero** requests sent)                            |

### Visual baselines — CI must mint these eight

`frontend-report-dialog.png` and `frontend-collections.png`, in the four projects that run visual specs
(`frontend-chromium`, `frontend-firefox`, `frontend-webkit`, `frontend-dark`).

**Nothing was minted locally, and that was verified rather than assumed**: the local run reached the
screenshot and failed with "A snapshot doesn't exist", the config's `updateSnapshots: 'none'` refusing
exactly as [48 T-8](./48_PlatformParityRegister.md) requires. Only the `web-e2e` workflow's visual job
may mint, in the pinned image.

---

## 6. Defects and harness findings

### M7-3 — mobile has no clap interaction (**open, mobile's to take**)

The row's premise, corrected. Mobile shows clap _totals_ on its analytics screens and gives a reader no
way to add one. Web's `use-claps` is the reference. [48 §3.15](./48_PlatformParityRegister.md).

### W7b-1 — `POST /reports` refuses a self-report and nothing documented it (**open, backend docs**)

`422 REPORT_SELF`. Correct behaviour, absent from the DTO, the `@ApiOperation` and the W7 row. Found by
this spec's own first run, where two report cases filed against the seeded writer's own piece. The
client now surfaces the refusal with the reader's text intact, and a dedicated spec asserts it. What
remains is one `@ApiOperation` line, which is not W7b's to write.

### Two harness findings, both fixed here

- **A Playwright `click()` loop is not a burst.** Per-call actionability checks exceeded the 600 ms
  debounce on a loaded Firefox worker, so seven clicks arrived as `[{1},{1},{5}]` — the harness under
  test, not the code. Looping `element.click()` inside one `evaluate()` was worse: each clap re-renders
  the button, so the captured handle goes stale and the rest land on a detached node (`{count:1}`).
  `dispatchEvent('click')` re-resolves per call and skips the wait, which is both fast enough and
  correct.
- **New lazy routes are slow on a contended dev server.** `/me/collections` timed out at 30 s with a
  blank page under four parallel Firefox workers, and passed in 4–7 s serially. Budgeted with
  `test.slow()` and a stated reason. CI serves `vite preview`, so it never pays this.

---

## 7. What W7 still owns

**W7c** — reader analytics, privacy prefs.
**P-2** — composing @mentions, on both clients.
**Onboarding** — still blocked on a product shape for web.
**M7-1 / M7-3** — the two open mobile follow-ups from W7a's and W7b's sweeps.
