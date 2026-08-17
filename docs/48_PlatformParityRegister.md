# 48 — Platform Parity Register (web ↔ mobile)

**Status:** 🔒 Binding · **Owner:** every client epic · **Last swept:** 2026-08-17 (after **A1** — the admin monetization surface, three slices; sweep **§6.14**, and six backend gaps recorded as **A1-1 … A1-7** in §3. Earlier the same day, **D3** — AI writing is now an enforced paid capability on the server and gated on both clients; the free-tier regression is LIVE, and §5.2 item 4 is rewritten. Sweep **§6.13**. Earlier the same day, **M7-3** — mobile's clap, sweep **§6.12**. Before those, 2026-08-10 after **W7c** —
reader analytics + the privacy-prefs row, closing §2 rows **6 and 8** and leaving **onboarding as the
only unowned §2 row**. Its sweep is **§6.10**, and it is the slice that shrank on contact with the code
— twice, both reductions recorded in §4 rather than in a commit message. Row 4's premise was **wrong**:
all seven reader fields were ALREADY rendering on web, inside the WRITER dashboard, so a reader who had
never published had to open a page headed "Your writing's reach" to see what they had read. The fix was
a **move** (to `/me/reading`) as much as a build — the third §2 cell in this track to misdescribe what a
client already had (cf. **W8-1**, **M7-3**). Row 5 was **closed without code**: its one server-backed
control already shipped at `edit-profile-page.tsx:253` and its other two are local display gates with
nothing cross-user to enforce. Mobile's Continue Reading / Recently Read / Weekly Activity are now
recorded as **platform-inherent** (device Hive store; no reading-history endpoint exists), and the
bookmarks count went in as a **bounded** `50+` because `v1` has no `COUNT(*)` for it. Previously swept
after **W7b** —
collections, claps and report on web, closing §2 rows 4 and 5 and the last of §5's social orphans. Its
sweep is **§6.9**, three arrangement differences are in **§4.1**, and it found the thing this document
most needed to hear: **§2 row 5 was wrong**. It credited mobile with a "clap (1..50 accumulating)" on its
reader action bar; mobile has **no clap control at all** — no gesture, no accumulator, no
`POST /pieces/:id/claps` caller anywhere in the app (**M7-3**, §3.15). That is the SECOND time a §2 cell
has over-credited mobile (**W8-1** was the first), so the direction on claps reversed and web is now the
reference. Also **W7b-1**: `POST /reports` refuses a self-report with `422 REPORT_SELF`, which is correct
and is documented nowhere. Previously swept after **W7a** — the
**conversation layer** on web, the first slice of W7 and the row that finally owns piece comments +
responses, which §5 had listed as unowned since this document was written. Its sweep is **§6.8**, the
inline-vs-pushed arrangement is **§4.1**, and it found the harness defect that matters most here:
**B4-1** (§3.14) — B4's 25-piece plan cap is enforced on `POST /pieces`, which is how almost every
browser spec arranges its content as the ONE shared seeded writer, so the suite could not arrange
anything at all. `reader.spec.ts` was failing **8 of 10** for that reason and nobody had run it since
B4 landed; fixed in `seed:e2e` (free plan → unlimited pieces for the E2E stack only, the same category
of stack config as `RATE_LIMIT_ENABLED=false`) and verified back to 13/13. Also **B4-2**: a response is
counted toward the piece allowance but never gated by it — correct, deliberate, and recorded only in a
service doc comment, which W7a's first draft duly got wrong. Previously swept after **B3** — profile lookup
by **id**, the enabler three consecutive epics deferred, and the first row where **mobile** was the platform
missing the client half rather than web. `GET /users/by-id/:id` is the same view as the username route under a
different key, both delegating to one `buildPublicView` so the visibility rules cannot drift. Its sweep is
**§6.7**, and it found **four call sites the row's own list did not name** — a presence bar that announced the **full raw
uuid** to a screen reader, and a publication history that parsed an `actorName` the wire has never sent
and so named nobody at all. It also names the one genuinely bad lookup cost:
`me/blocks` is unpaginated, so its identity cost is the block count, unbounded. Previously swept after **B5** — the per-account
"turn AI off" switch, the odd one out of the four subscriber features: a USER PREFERENCE rather than a
`PlanLimits` key, and so the only one of them needing a schema change. One guard, in the AF1 orchestrator
ahead of the AF5 meter, so an opted-out user's refusal meters nothing. Its sweep is **§6.6**, and it found
**four AI entry points that never consulted the server at all** — three on mobile, one on web — plus the
fact that the `ai_personalization` consent §4.10 told it to sit "next to" **has no client surface on either
platform**. Previously swept after **B7** — version-history depth by plan, the third and last
`PlanLimits` row, and the first cap in this codebase enforced **only at read time**: versions past the
plan's depth are hidden and never deleted, so upgrading restores them retroactively and snapshot
CAPTURE is never refused. That last part is the row's whole risk — the accept-a-suggestion path
captures inside its settling transaction, so a gate on the write would have turned a paywall into a
correctness bug — and three tests hold it, one wiring the real service into the accept path. Its
sweep is **§6.5**: no new defect, no new arrangement difference, and `maxSnapshotHistory` deliberately
stays on the ORDINARY `0` = unlimited convention so B6's exception list stays at one entry.
Previously swept 2026-08-08 (after **B6** — the per-story collaborator seat cap, and the first row in
this codebase to deliberately **invert a shared sentinel**: `0` means unlimited for every plan limit
except `maxCollaborators`, where it means none. Its sweep is **§6.4**; no new defect, one accepted
arrangement difference in §4.1, and the reconciliation is pinned by a test rather than a convention.
Previously swept 2026-08-08 (after **B4** — the plan piece cap, the first row that is an enabler plus
both client halves rather than a port, and the first capability to land on both clients at once. Its
sweep is **§6.3**; two accepted arrangement differences went to §4.1 and one app-wide a11y finding to
**T-10**. Previously swept 2026-08-08 (after **W9's
close-out** — the two story-scoped AF4 consumers. **§2 row 3 is now CLOSED at 8 of 8**, and the §5
Ask-My-Book orphan closed with it. The pre-flight audit (**§3.13**) found the contract sound on both
routes and every wire type already mirrored AND pinned — the first audit in this register to find
nothing wrong with what it checked — but it found four projection behaviours a roadmap paraphrase does
not state, and one gap on the WEB side: the editor→AI seam had no story id at all. **Three defects, all
closed 2026-08-08** — **W9-1** on web (a stream that closed without a terminal frame span forever, fixed
in flight), plus **W9-2** (Ask My Book reachable with its feature flag down, through two of its three
entry points) and **W9-3** (every graph edge's evidence dropped at the parse boundary) on mobile, both
found by the sweep and fixed the same day at the user's direction. A **fourth**, **W9-4**, was found by
actually running the two new a11y scans rather than reasoning about them — they asserted a surface the
master AI flag had turned off. All four are the same shape: a correct rule applied in fewer places than
it holds.
[Detail](./45_WebClientRoadmap.md#412-w9--af4-story-consumers-detail-done-2026-08-08).) Previously swept
2026-08-05 (after **W8's close-out** — the remaining AI surfaces. **§2 row 3 is now fully closed**: conversations, the prompt
library and AI usage are all on web. The step-0 audit (**§3.12**, the first for the AF1/AF2 conversation
and usage shapes) found mobile's client field-for-field correct on all seven routes and found five
behaviour/a11y defects instead — **W8-1**, mobile's conversations list can never be populated, is the
significant one, and it inverts the row: web is now the reference for that surface. **W8-5** is a
pre-existing AA failure in the primary button's hover background, found by W8's own a11y scan. None of
the five is fixed here; each is scoped to its own row.
[Report](./52_WebAiSurfacesReadinessReport.md).) Previously swept 2026-08-04 (after **W5's
close-out** — the AF4 discovery/search row. **§2 row 3 halves**: web now has semantic search + AI
discovery, and the sweep found that **ask-book is owned by nobody** (§5). Three defects W5 introduced
and fixed are §3.9 W5-6…W5-8, one the sweep itself found is **W5-11**, and four arrangement
differences the epic's code claimed were "recorded" are now actually in §4.1 — they were not.
[Report](./51_WebDiscoverySearchReadinessReport.md).) Previously swept 2026-08-03 (after the **mobile
parity batch** — **M-4, M5-1, M5-2, M5-4, M5-5 and M5-6 all CLOSED**. The first three closed the last
AF5/AF6 surfaces where the two clients differed; the other three were opened and closed in the same
pass, and **§2 row 2 — Monetization — is now at full parity, prose included**. One row left open:
**M-5**, a pre-existing intermittent failure in mobile's suite, measured and recorded §3.7).
Previously swept 2026-07-29 after
**W4's register close-out** — **W4-1, W4-2, W4-4, W4-5 and T-8 all CLOSED**, T-7 widened to three tests,
and mobile's `formatMoney` fixed for parity (§3.7); earlier the same day W4 itself closed row 2 of §2,
and W3a closed **W3c-1 / W3c-4** — §3.4.

> **The rule.** **Web and mobile ship the same features.** Neither platform is allowed to drift
> ahead of the other with product surface that the other has no plan for. A divergence is only
> acceptable when it is (a) recorded in this register, and (b) either assigned to an epic that
> closes it or classified as platform-inherent in §4.
>
> **Nothing new gets built that is not in [45](./45_WebClientRoadmap.md).** An epic delivers the
> surface its roadmap row names — porting from the platform that already has it — and nothing more.
> "It would be nice to also add…" is how the two clients drift apart, and closing that drift later
> costs more than the feature was worth.

This register is the single source of truth for **where the two clients differ today**. It is swept
at the end of every client epic (step 7 of the per-epic flow, [45 §2](./45_WebClientRoadmap.md)).

---

## 1. Why this document exists

Mobile shipped **M1–M10 + AF1–AF6 + P7.1–P7.4** and is the most complete surface in the product.
Every AF epic shipped **backend + mobile** and deferred **frontend + admin**, which is the gap the
W-track closes. So the default direction is **mobile → web**: mobile is the reference
implementation, and a W epic ports from it rather than inventing.

That default has one failure mode, and it has already happened once (§3): building a surface on web
that mobile does not have. It is not "extra value" — it is an unplanned divergence that some future
epic now has to reconcile.

---

## 2. Current divergences (mobile → web: web is behind)

Measured from `lib/features/**/presentation/screens` and `frontend/src/features/**/pages` plus route
tables, not assumed.

| #   | Area                      | Mobile has                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Web has                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Closed by                                                                                                                                                                                                                                                                                        |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Collaboration**         | 6 screens: collaborators, comments, invitations inbox, publishing workflow, restricted state, suggestions                                                                                                                                                                                                                                                                                                                                                                     | nothing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **W3**                                                                                                                                                                                                                                                                                           |
| 2   | ~~**Monetization**~~      | 5 screens: plans, subscription, billing history, credit dashboard, usage dashboard                                                                                                                                                                                                                                                                                                                                                                                            | ✅ **all five** (W4) — **fully at parity since 2026-08-03**: the coupon field (M5-2) and the two missing history tabs (M5-6) are now on both                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | **W4 ✅ closed 2026-07-29** — [report](./50_WebMonetizationReadinessReport.md)                                                                                                                                                                                                                   |
| 3   | ~~**AI breadth**~~        | 8 screens: conversation, conversations list, discovery, usage, ask-book, prompt library, semantic search, story explorer                                                                                                                                                                                                                                                                                                                                                      | ✅ **8 of 8 — CLOSED 2026-08-08.** Assistant + Craft Coach (W2), semantic search + AI discovery (W5), conversations + prompt library + AI usage (W8), **story explorer + ask-book (W9 ✅ 2026-08-08)** — the last two as tabs on the in-editor AI drawer, not routes (§4.1)                                                                                                                                                                                                                                                                                                                                                                                                                           | **W5 closed discovery + search; W8 the next three; W9 the last two ✅.** Note the direction reversed on conversations: mobile ships the screen and cannot populate it (§3.12 **W8-1**), so **web is the reference** and mobile needs the follow-up                                               |
| 4   | **Social depth**          | collections, collection detail, comments, responses (+ followers, follow requests)                                                                                                                                                                                                                                                                                                                                                                                            | ✅ **comments + responses — CLOSED 2026-08-10 by W7a** (the conversation layer, inline on the reader — [§4.1](#41-accepted-layout-differences--same-feature-different-arrangement)). Still missing: **collections** + collection detail. Plus follow requests; followers via a dialog                                                                                                                                                                                                                                                                                                                                                                                                                 | **W7** — [45 §4.4](./45_WebClientRoadmap.md). **W7a ✅ closed** rows 1–2 (conversation); collections is W7b, together with clap/report                                                                                                                                                           |
| 5   | ~~**Reader actions**~~    | **CORRECTED 2026-08-10 — this row was wrong**, and **TRUE since 2026-08-17.** The correction stands as written: on 2026-08-10 mobile had **report** on its action bar (behind "More") and **no clap control at all** — no gesture, no accumulator, no `POST /pieces/:id/claps` caller anywhere. **M7-3 closed 2026-08-17** (`a5f27c8`, `85d34c9`, `0c4b1e8`): mobile now has the clap the cell originally claimed, ported from web. See **§3.15** and the sweep in **§6.12**. | ✅ **clap (1..50, accumulating, batched, capped) + report + save-to-collection — W7b, 2026-08-10.** Report is a port; **clap is web-first**, so the direction on it reversed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | **BOTH ✅.** Web W7b (2026-08-10); mobile **M7-3** (2026-08-17). The correction note above is kept deliberately — this was the second row in the track where the register credited mobile with a surface it did not have (cf. **W8-1**), and the audit trail is the point, not the current state |
| 6   | ~~**Reading analytics**~~ | `reading_analytics_screen` — the _reader's_ own stats. **HALF of it is local:** the backend aggregate (7 fields) PLUS Continue Reading / Recently Read / Weekly Activity, which come from a device Hive store, not the API                                                                                                                                                                                                                                                    | ✅ **the portable half — CLOSED 2026-08-10 by W7c.** `/me/reading` ships all seven `ReaderAnalyticsDto` fields (pieces read, reading time, completed reads, both streaks, favourite genres + languages) plus a **bounded** bookmarks count, reached from the account menu. **PARTIAL BY DESIGN:** the three local-history cards are **platform-inherent (§4)** — web has no reading-history store and the frozen `v1` has no endpoint for one. Note the figures were not absent before W7c so much as **misplaced**: they rendered inside the WRITER dashboard at `/me/stats`, so the only way to see what you had READ was a page headed "Your writing's reach"                                      | **W7c ✅ closed 2026-08-10** — [45 §4.4](./45_WebClientRoadmap.md) row 4; sweep **§6.10**                                                                                                                                                                                                        |
| 7   | **Onboarding**            | `onboarding_screen` — first-run flow                                                                                                                                                                                                                                                                                                                                                                                                                                          | nothing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **unassigned — see §5**                                                                                                                                                                                                                                                                          |
| 8   | ~~**Privacy prefs**~~     | dedicated privacy screen: private account, **show bookmarks count**, **show reading-history count**. Mobile's own docblock (`privacy_settings_screen.dart:1-9`) says only the FIRST is real: private account is "real, server-backed (`Profile.isPrivate` via `PATCH /me`)"; the other two are "LOCAL display gates"                                                                                                                                                          | ✅ **CLOSED-NOT-BUILT 2026-08-10 by W7c** — nothing was written, because there was nothing left to write. The one server-backed control **already shipped**: the private-notebook toggle at `frontend/src/features/settings/pages/edit-profile-page.tsx:253`, same `isPrivate` field, same `PATCH /me`. The two local gates have **no web counterpart to build** — the frozen `v1` never exposes another user's reading history or bookmarks, so there is nothing cross-user to enforce, and `profile-stats.tsx:6-11` already omits those counts because the profile fields are hardcoded `0` server-side. A toggle would hide a figure web does not display. Recorded as platform-inherent in **§4** | **W7c ✅ closed 2026-08-10** — [45 §4.4](./45_WebClientRoadmap.md) row 5; sweep **§6.10**. **Arrangement difference kept:** mobile has a dedicated privacy SCREEN, web has the toggle inside edit-profile — one real control does not earn its own route (§4.1)                                  |
| 9   | **Offline behaviour**     | engagement + follow taken offline are queued and reconciled by a unified `SyncEngine`                                                                                                                                                                                                                                                                                                                                                                                         | no offline write queue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **see §4** (partly platform-inherent)                                                                                                                                                                                                                                                            |

---

## 3. Divergences where mobile is behind

`M-1` (mobile's broken story invite) was **closed on 2026-07-28** — both clients now resolve a handle
to an id and send `{inviteeId, role}`. Mobile's fix and the three further defects found with it are in
`qalam-mobile/docs/50` ("Invite by handle"); the analysis in §3.1 stays because it is the clearest
example of why §6 step 2 exists.

**Two new rows opened the same day**, found by the pre-W3b reference audit that M-1 taught us to run
(§3.2). Both are mobile defects of the same kind — a client written against an imagined contract:

| #   | Area                                     | Contract reality                                                                                                        | Mobile does                                                                                                                                                                                     | Resolution                                                       |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| M-2 | **Create a suggestion (AF6)**            | `CreateSuggestionDto` = `{anchor:{from,to}, originalText, suggestedText}`; `anchor` **required**                        | Sends `{originalText, suggestedText, blockId?, rationale?}` — **no anchor**, plus two unknown properties                                                                                        | ⏳ **Open, unowned.** W3b must build from the contract, not port |
| M-3 | **Comment threads + suggestion display** | `CommentDto` has ids only, no `replies`; threads come from `GET /comments/:id/thread`. `SuggestionDto` carries `anchor` | Entities parse `authorName`, `authorAvatarKey`, `replies`, `blockId`, `rationale`, `resolvedBy` — **none of which the wire sends**; the thread endpoint is never called; `anchor` is not parsed | ⏳ **Open, unowned.** Same fix shape as M-1's entity cleanup     |

### 3.1 M-1 — mobile's story invite could not work against the frozen contract (fixed)

Found on 2026-07-28 while verifying the W3 reference (this register's own §6 step 2). It is a
**defect**, not a divergence of scope — worth recording here because it means **mobile is not a valid
reference for this one surface**, which is exactly the assumption a W-track epic starts from.

- Mobile sends `{role, email?, userId?}` — `lib/features/collaboration/data/datasources/collaboration_remote_data_source.dart`
  (`invite`), fed by an email text field in `collaborators_screen.dart`.
- The contract requires `{inviteeId: UUID, role}` (`CreateInvitationDto`), and the app runs
  `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` — so `email` / `userId` are
  rejected as unknown properties **and** the required `inviteeId` is missing. Every mobile invite
  400s. There is no email-invite path anywhere in the collaboration module.
- `qalam-mobile/docs/50` describes manual testing of "invite by role → the invitee sees it in
  Invitations Inbox → accept". That path cannot have succeeded; treat that line as unverified.

**Fixed 2026-07-28 on both clients.** Web (W3a) built the contract-correct flow first; mobile was then
brought to the same shape — `{inviteeId, role}` with a handle picker resolving through
`GET /users/:username`. Verified against a live backend on both sides and pinned by a regression test
on each (`invite-dialog.spec.tsx`, `invite_contract_test.dart`).

**Three further defects surfaced in the same mobile flow**, all from the same email-shaped assumption:
the sheet's only button was _Cancel_ yet the code invited after it popped; `accept` was decoded as an
invitation when the endpoint returns `MemberDto`; and `StoryInvitation` carried four fields the wire
never sends (`inviteeEmail`, `inviteeUserId`, `invitedByName`, `storyTitle`), so the screens showing
them displayed nothing. All fixed — details in `qalam-mobile/docs/50`.

**The lesson, sharpened:** §6 step 2 must compare the reference's **request and response shapes to the
DTOs**, not just confirm a screen exists. A screen-list check would have passed every one of these.

### 3.2 M-2 / M-3 — the pre-W3b reference audit (2026-07-28)

Run **before** starting W3b, precisely because M-1 showed a screen list proves nothing. Mobile's
comment and suggestion surfaces were compared field-by-field against `CreateCommentDto`,
`CreateReplyDto`, `CreateSuggestionDto`, `CommentDto`, `SuggestionDto` and `CommentThreadDto`.

**Broken (would 400 on every call) — `addSuggestion`:**

- Omits the **required** `anchor` (`{from, to}`), so nested validation fails.
- Sends `blockId` and `rationale`, neither of which exists in `CreateSuggestionDto` → rejected as
  unknown properties under `forbidNonWhitelisted`.
- It is currently **unreachable**: mobile's suggestions screen has no create affordance, only
  accept / reject / withdraw. So mobile can act on suggestions it has no way to produce.

**Phantom response fields (parse to null forever, and the UI displays some of them):**

| Entity                 | Reads keys the wire never sends                                    | Missing from the entity                     |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| `EditSuggestion`       | `blockId`, `rationale`/`note`, `authorName`/`author`, `resolvedBy` | **`anchor`** — so the text range is unknown |
| `CollaborationComment` | `authorName`/`author`, `authorAvatarKey`, `replies`                | `resolvedById`, `updatedAt`                 |

`SuggestionDto` names the field `resolvedById`, not `resolvedBy`; the suggestions screen renders
`suggestion.rationale`, which can never arrive.

**Threads are unreachable.** `CommentDto` carries no `replies` array — a thread is fetched from
`GET /comments/:id/thread` (`CommentThreadDto {comment, replies}`), and **mobile never calls it** (no
path, no method). The nested-reply parsing in `CollaborationComment` is dead code.

**Latent, not yet firing:** `addComment` sends `parentId`, which `CreateCommentDto` does not allow.
The only caller passes none, so the key is omitted — but any future reply-via-addComment wiring 400s.
Replies have their own endpoint (`POST /comments/:id/replies`, `CreateReplyDto {body, mentions?}`),
which mobile does call correctly.

**Also functional, not a validation error:** story comments and suggestions are **cursor-paginated**
(`CommentListQueryDto`, envelope `meta.pagination`), but mobile reads them with a plain list call and
no cursor — so only the first page is ever shown, silently.

**Consequence for W3b:** the comments half is a partial reference (correct create + reply, broken
entities, no threads); the suggestions half is **not a reference at all**. W3b builds both from the
DTOs, exactly as W3a did for invite.

---

## 3b. Divergence created by web (web → mobile)

**None open.** One item ever appeared here — `W-1`, the reader's "More like this" — and it was a
mistake of scope, recorded rather than quietly kept. It was **closed on 2026-07-28** by porting the
section to mobile (`lib/features/reading/presentation/widgets/related_pieces.dart`, report
`qalam-mobile/docs/55_MobileRelatedPiecesPort.md`). The record of how it happened stays below,
because the lesson is the reason this register exists.

**How it happened, so it does not happen again.** [45 §4.1](./45_WebClientRoadmap.md) lists
"Author card + related pieces — mobile's `reader_author_card`". Mobile's author card contains the
author card and **no related pieces** — the phrase was the roadmap's aspiration, not a description
of something to port. It was built on web without checking that the named reference actually
contained it.

**The lesson for every future epic:** when a roadmap bullet says "port mobile's X", **open X and
confirm it contains what the bullet claims** before building. If it does not, the bullet is a new
feature request, not a port — and it goes back to the roadmap for a decision instead of being built.

### 3.1 Resolution — ported to mobile (✅ landed 2026-07-28)

**Decided 2026-07-27, delivered 2026-07-28.** Parity was restored by adding the section to mobile
rather than removing it from web, ahead of W3 and every other W-track row.

Scope as delivered — a port, not a redesign:

- A "More like this" section under the reader, matching what web ships: up to **4** pieces sharing
  the piece's **first tag**, with the current piece filtered out, rendered under the author card.
- Same data path — `GET /search/pieces?q=<tag name>&tag=<tag slug>&sort=trending`. **No backend
  change**; the AF4 recommender still needs `ai.use` and stays out of reach for this surface.
- Non-critical, exactly as on web: **no tags → no section**, and a failed load renders nothing
  rather than an error. It must never cost the reader the piece they came for.
- Reference: `frontend/src/features/reading/{hooks/use-related-pieces.ts,components/related-pieces.tsx}`
  and `api/reading.api.ts#related`. Mobile landed it in `lib/features/reading/` following that
  feature's existing repository → controller → widget layering.

**Two deliberate platform differences inside the port**, both forced by mobile's own structure and
recorded so neither reads as drift:

- **Position.** Web renders the section below its author card, which sits at the **end** of its page;
  mobile's author card sits **above** the prose, so the faithful equivalent is the end of the reader
  (after the comments/responses footer), not directly under the card.
- **Data path ownership.** Web's reading feature calls `/search/pieces` from its own `api/` layer;
  mobile does the same from its own `PieceRemoteDataSource`, because
  `qalam-mobile/docs/folder-structure.md` forbids a feature importing `features/search`. Same
  endpoint, same query (`q=<tag name>&tag=<tag slug>&sort=trending`), no backend change.

Closed out per this document's own rule: §3 row deleted, sweep re-dated, port reported in
`qalam-mobile/docs/55_MobileRelatedPiecesPort.md`.

---

## 3.3 ~~M-4~~ — **CLOSED 2026-08-03** — mobile has a blocks/mutes data layer and no screen (opened 2026-07-29, after W3c)

**Mobile is behind, and it is a wiring gap rather than a contract defect.** Its trust layer is
complete and correct after the docs/56 repair — `TrustRemoteDataSource`, `TrustRepository`,
`BlockEntry` (including the T-1 fix), `trustSummary`/`myBlocks` providers — and **nothing renders any
of it**. There is no blocks/mutes surface on mobile at all; `myBlocksProvider` has zero consumers.

That is why W3c's blocks page was **built from the DTOs rather than ported** (docs/49 §5 says as
much): there was no reference screen to open. Web now ships `/settings/blocks` — the list with both
kinds, unblock/unmute through their own routes, and the viewer's account standing.

| What web ships (W3c)                                  | Mobile today                                              |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `/settings/blocks` — blocks + mutes, one list         | No screen. Data layer complete, zero consumers.           |
| Unblock / unmute via `DELETE /users/:id/{block,mute}` | Repository methods exist; no UI calls them.               |
| Account standing (`GET /me/trust`) beside the list    | `restricted_state_screen` + banner (a different surface). |

**Shape of the port:** a settings screen listing `myBlocksProvider`, with the kind tag and the
matching remove action. No backend change, no new contract — mobile's `trust_repository.dart` already
has every method. Mobile's existing `restricted_state_screen` covers standing, so only the block list
is genuinely new.

**Not built here.** This is a mobile row and W3c is a web row; recorded per this document's own rule
rather than absorbed.

### Resolution (2026-08-03) — ported, with the entry point treated as part of the port

`blocks_screen.dart` at **`/settings/blocks`** — the same path web uses, because the surface is
account-scoped rather than story-scoped and does not belong with the `/stories/:id/*` routes. It
renders the standing summary and both kinds of relationship in one list, and removal calls the
matching route.

Three things were carried across deliberately:

- **`entry.blockedId`, never `entry.id`.** T-1 is the trap this list exists to avoid, and it is
  pinned by a data-source test that also asserts the relationship id never appears in the path.
- **Standing is summarised here and detailed at `/restricted`.** §3.3 noted mobile already has
  `restricted_state_screen`; rather than duplicate it, the card states the status in one line and
  links through only when the account is actually restricted. Web shows the same information inline
  because it has no separate wall route.
- **`restrictionScopeLabel` was missing** from mobile's collaboration labels, so a listed restriction
  could only say _what kind_ it was and not _what it applied to_. Added, and asserted.

**The entry point is the row.** A "Safety" tile in the settings hub's Collaboration section, beside
the invitations inbox that R-1 taught the same lesson about. The test asserts both halves of the
chain — the tile pushes `Routes.settingsBlocks`, and the app's own router resolves that name — so a
screen that becomes unreachable fails the suite rather than shipping quietly.

---

## 3.4 Found by running the W3c suite (2026-07-29)

Recorded when found, **each outside the row that found it**. **W3c-1 and W3c-4 were fixed on
2026-07-29** (see the resolutions in their entries); W3c-2 and W3c-3 remain open with their owners.

### W3c-1 · ~~**high**~~ · **CLOSED 2026-07-29** · the capability map offered an owner `review.approve`; the endpoint 403'd it

**Both gates disagree, and the client is caught in the middle.** The Policy Engine's `review.approve`
decision allows the story **owner** through its ownership rule, so `GET /stories/:id/capabilities`
answers `allowed: true` — and both clients are built to reflect that map and never re-derive
authorization (docs/49 §3). The endpoint is then coarse-gated on
`@Permissions(PERMISSIONS.PublishingApprove)`, a **platform** permission only `moderator` and `admin`
hold, so the click returns `403 AUTH_PERMISSION_DENIED`.

Verified live against the local stack:

```
writer capability review.approve : true (allow)
writer POST …/review/approve     : 403 AUTH_PERMISSION_DENIED
admin  POST …/review/approve     : 200 approved
```

`POST …/review/changes` carries the identical gate and the identical problem.

**Consequence:** every story owner is shown Approve and Request-changes buttons that cannot work.
Mobile has the same two buttons gated the same way (`publishing_workflow_screen`), so this hits both
clients equally — it simply has never been exercised there, because AF6 had no entry point until
recently.

**Not fixable in the client.** The only client-side "fix" would be a role check, which is the one
thing docs/49 §3 forbids. It needs the backend to reconcile the two gates — either add the story-role
path to the coarse guard, or stop having the Policy Engine allow an owner an action the route refuses.
The W3c E2E documents the live behaviour (`publishing.spec.ts`, "DEFECT W3c-1") and will **fail** when
the gates are reconciled, which is the prompt to delete it.

#### Resolution (2026-07-29) — the route's gate was wrong, not the rule tables

`review/approve` and `review/changes` now carry `@Permissions(PERMISSIONS.CollaborationUse)`, the same
coarse gate as `POST stories/:id/review` and `GET stories/:id/review`. All four review routes agree.

**This is not a loosening.** `review.service.ts` already asserted `POLICY_ACTIONS.ReviewApprove` /
`ReviewRequestChanges` through the Policy Engine with the story resource, so `publishing.approve` on
the route was a _second_ authorization path in front of the SSOT that AF6 made authoritative. The
rule tables were left untouched — deliberately: `policy.constants.ts` documents the two paths as
coexisting ("a platform editor approves via `publishing.approve`, a story editor approves via their
story role"), so the Policy Engine allowing an owner was the intended design, and the route
contradicting it was the defect. Deciding the other way — that a story owner may _not_ approve their
own story's review — would have been a product decision about story roles, not a repair.

**Staff did not lose their path.** `moderator`/`admin` do not grant `collaboration.use` directly; they
inherit it from `user` through `PermissionResolver`'s rank inheritance. Verified live (below) and
pinned by a unit test, because without that inheritance narrowing the gate would have locked staff out
of approving — the failure mode this change could plausibly have introduced.

Verified live against the local stack, one story per actor:

```
owner (writer@qalam.local, platform role `user`)  capability review.approve : allowed=true
owner    POST …/review/approve                    : 200 approved
owner    POST …/review/changes                    : 200 changes_requested
member below Editor (story role `reviewer`)       : 403 POLICY_DENIED  rule=story-role
non-member                                        : 403 POLICY_DENIED  rule=default-deny
admin (staff path, publishing.approve)            : 200 approved
story Editor (member path)                        : 200 approved
owner    POST …/publish (after approving)         : 200
```

The two 403s come from the Policy Engine's own rules — `rule=story-role` / `rule=default-deny`, not
the permission guard — which is the whole point: the gate that refuses is now the one that decides.

**Tests.** `review.service.spec.ts` covers the three actors through a REAL `PolicyEngineService`
(a mocked `assert` could not have seen this bug, since the service was never wrong);
`publishing.controller.spec.ts` pins the route metadata and the rank-inheritance assumption.
**E2E updated:** the test that documented the 403 is gone, replaced by
`publishing.spec.ts` → "W3c-1: the owner approves their own review — no dead button", and
"review → approve → publish, end to end" is now ONE actor through the UI instead of two.
The admin-driven "sends the story back with notes" test was kept deliberately, as staff-path coverage.

### W3c-2 · ~~**medium**~~ · **CLOSED 2026-07-29** · `QTag color="success"` failed AA contrast

`packages/ui/src/components/q-tag.tsx` renders `success` as `bg-success/12 text-success` — measured
`#3e7c4f` on `#e3e8de` = **4.01:1**, under the 4.5 AA floor for 12px text. The W3c a11y scan is the
first to reach it (the suggestion card's "Accepted" tag has the same colour, but that page's scan
never accepts one).

Not registered as known a11y debt — `e2e/fixtures/a11y.ts` says an entry there "downgrades a real,
user-facing defect: prefer fixing the app", and the register is deliberately empty. Instead the W3c
page uses `neutral` for good standing (`danger` measures fine) and the token is left to its owner:
fixing it re-tints every success tag on both apps and would re-mint every visual baseline, which only
CI may do.

#### Resolution (2026-07-29) — `--q-success` darkened, light mode only

`#3e7c4f` → **`#356b44`** in `packages/ui/styles/tokens.css`, mirrored in `src/theme/antd-theme.ts`.
Hue preserved (a straight RGB scale). Measured on all three page backgrounds, since QTag paints the
label in the same token as its 12% fill and so the colour is measured _against itself_:

| Background        | Rendered tint | Before | After      |
| ----------------- | ------------- | ------ | ---------- |
| surface `#ffffff` | `#e7ede9`     | 4.28:1 | **5.30:1** |
| canvas `#faf7f1`  | `#e2e6dc`     | 4.02:1 | **4.98:1** |
| raised `#f3eee5`  | `#dcded2`     | 3.74:1 | **4.63:1** |

The register's original 4.01:1 was the canvas case (an independent calculation reproduces it as
4.02). **Dark mode is unchanged** — `#6baa7c` already measures 5.32 / 5.82 / 4.76.

`accentHover` was rejected as the value for a related reason worth recording: the obvious candidate is
not always the safe one. See W3c-3's resolution.

Because the token is shared, this also re-tints `notification-item`'s success glyph (same `/12` + text
recipe), every `text-success` indicator, and AntD's `colorSuccess`. That breadth is why it was bundled
with the baseline mint rather than fixed in isolation.

### W3c-3 · **low** · AntD's derived hover colour on a default button fails AA

A `QButton variant="secondary"` under the pointer renders its label in AntD's derived
`defaultHoverColor` — `#ab6846` on white = **4.37:1**. Any a11y scan that leaves the cursor resting on
a secondary button sees it; the W3c publishing scan did, because it clicks "Capture version" while
arranging. Worked around by parking the pointer before scanning (with a comment saying why), which
matches how every other a11y spec scans a resting page. The real fix is pinning the button hover
colour in `packages/ui/src/theme/antd-theme.ts`, alongside the Menu colours already pinned there for
exactly this reason.

#### Resolution (2026-07-29) — pinned, and the workaround deleted

`Button.defaultHoverColor` is pinned to the **accent token itself** (`c.accent`), beside the Menu
colours: 6.02 / 5.63 / 5.21 light, 6.64 / 7.15 / 5.99 dark, on surface / canvas / raised.

**Not `accentHover`,** which is what "hover colour" invites you to reach for: it measures 4.72:1 on
surface but **4.41:1 on canvas**, so it would have replaced a caught AA failure with a subtler one that
the publishing scan (on canvas) would still have flagged. Pinning to `accent` makes hover darken toward
the ink rather than lightening away from it, which is also the right direction on paper.

**The workaround is gone** — `page.mouse.move(0, 0)` is deleted from the publishing a11y scan, which
now scans with the cursor resting wherever arranging left it. It was the only instance in the suite
(`grep mouse.move e2e/` returns nothing now).

Both halves were verified by _removing_ the fix and watching the scan fail, rather than by assuming:

```
without the pin → the publishing a11y scan fails, axe reporting
  [serious] color-contrast — 4.37 (foreground #ab6846, background #ffffff, 14px) expected 4.5:1
with the pin    → 31 a11y checks pass, frontend-chromium AND frontend-dark
```

axe's own number matches the register's original measurement exactly, which is the evidence that the
pinned token — not the parked pointer — is what carries this now.

### W3c-4 · ~~**medium**~~ · **CLOSED 2026-07-29** · the web suggestion card said the prose was not changed

Carried over from `qalam-mobile/docs/56` §2.6 (C-14) and repeated here because it is web's to fix:
`frontend/src/features/collaboration/components/suggestion-card.tsx:75` renders "Accepted — apply the
replacement in the editor", and `api/collaboration.api.ts#acceptSuggestion` documents the same. Both
were true until `f6827e0`.

**Worse than a stale string:** `e2e/tests/frontend/inline-review.spec.ts` asserts that wording via
`expectApplyReminder()`, so the suite is **green while the UI is wrong**. Fixing the copy requires
updating that assertion in the same change.

#### Resolution (2026-07-29)

The accepted card now reads **"Accepted — the replacement was applied to the piece. The version before
the edit was saved, so it can be reverted."** The second sentence is not decoration: `accept` captures
a `pre_edit` snapshot before rewriting (`suggestion.service.ts:178`), so the revert really is there,
and a writer whose prose changed under them needs to know it is recoverable.

**Three assertions moved with the copy**, which is the actual lesson of this entry — the stale wording
was pinned in more places than the register knew:

| Where                                               | Was                                   | Now                              |
| --------------------------------------------------- | ------------------------------------- | -------------------------------- |
| `e2e/pages/frontend/story-suggestions-page.ts`      | `expectApplyReminder()`               | `expectAppliedNote()`            |
| `frontend/…/components/suggestion-card.spec.tsx`    | "accepting does NOT change the piece" | "accepting DID change the piece" |
| `frontend/…/api/collaboration.api.ts` (doc comment) | "does **not** rewrite the prose"      | "**does** rewrite the prose"     |

The unit spec was the one the register missed: `docs/48` named only the E2E, so a fix that trusted this
document would have failed the frontend suite. Both new assertions also check the OLD sentence is
**absent**, not merely that the new one is present — a stale-copy defect is only really closed when the
test would fail if the old string came back.

**The copy lived on five surfaces, not one — and only a loose search finds them all.** Beyond the card
and the three assertions above, the suggestions **page header** (`pages/suggestions-page.tsx`) said
"Accepting records the decision — the wording is applied in the editor", and the inline-review spec's
own file docstring asserted the same as its stated intent. Neither contains the card's sentence, so
grepping the exact string missed both; they were found by searching for the _claim_
("records the decision", "in the editor", "does not change"). A register entry that names one location
invites exactly that mistake — when copy states a contract, assume it is duplicated and search for the
meaning.

**Parity.** Mobile says the same thing at the same moment — its toast was reverted to
"Suggestion accepted." in mobile commit `dd12091`, and its card carries a status chip with no
persistent note. Web's card is persistent rather than a toast, so it states the outcome where the
writer will still see it later; neither client now claims the prose was left alone.

---

## 3.5 Found while fixing W3c-2 / W3c-3 (2026-07-29)

**Recorded when found, outside the pass that found them. T-2, T-2b and T-3 were then fixed on
2026-07-29** by the follow-up pass that closed the contrast class properly (see their resolutions).
**T-4, T-5, T-6, T-7 and T-8 remain open** with no owner.

Each is outside the two defects that pass was scoped to. **`success` was the colour the a11y scan
happened to reach first, not the only one that fails** — the recipe is what fails, and every tinted
QTag colour uses it.

### T-2 · ~~**medium**~~ · **CLOSED 2026-07-29** · every tinted `QTag` colour inherited the same flaw

**Measured by axe in a real browser, not by arithmetic.** §8.4 of [10](./e2e/10_UIQuality.md) is explicit
that per-token arithmetic against the documented background is not verification: every dark-mode defect
it lists passed that check and still failed in a browser, because something re-composited the colour.
That warning applies directly here — and no a11y scan in the suite paints a `success` tag at all (the
comments scan never resolves a comment; the blocks page uses W3c's `neutral` workaround). So QTag's
exact classes were rendered on all three backgrounds against the app's real stylesheet and scanned.
Two things came out of it: `text-<c>` is the **raw token with no alpha compositing** (unlike the
header's ink, which paints `rgba(40,34,27,0.882)`), so the arithmetic model is valid for this
component; and axe's ratios match it to within rounding.

| Colour              | surface `#ffffff` | canvas `#faf7f1` | raised `#f3eee5` |
| ------------------- | ----------------- | ---------------- | ---------------- |
| `warning` `#8d651a` | 4.48 ❌           | 4.18 ❌          | 3.92 ❌          |
| `info` `#3b6ea8`    | 4.50 ⚠️ (exactly) | 4.23 ❌          | 3.93 ❌          |
| `accent` `#9e4b28`  | 5.04 ✅           | 4.74 ✅          | 4.40 ❌          |
| `danger` `#b3382e`  | 4.96 ✅           | 4.66 ✅          | 4.33 ❌          |
| `success` (fixed)   | 5.29 ✅           | 4.96 ✅          | 4.62 ✅          |

The `success` row is the browser-verified confirmation that W3c-2 is actually closed, on all three
backgrounds — the number the commit quotes from arithmetic (5.30 / 4.98 / 4.63) lands within 0.02.
Rendering the other four raised a real axe `color-contrast` violation, so T-2 is detectable, not
theoretical: it simply has no scan pointed at it.

**`warning` and `info` are live defects today**, on the same surfaces where `success` failed — `info` is
in use (`restricted-wall`, `role-badge`). `accent` and `danger` are **latent**: they pass on surface and
canvas and fail only if a tinted tag is ever placed on `bg-raised`. No tinted tag sits on `raised` today
(only `neutral`, which is opaque and measures 5.00), so nothing renders them broken yet.

Fixing these is the same one-line-per-token change, but it re-tints two more colour families app-wide
and would re-mint the baselines again — so it belongs to one deliberate token pass, not to this one.
**Note `info` measures 4.50 exactly on surface: it passes only by rounding**, which is the kind of
margin that a future background tweak silently breaks.

#### Resolution (2026-07-29) — the recipe was fixed, not the swatches

**T-2 and T-3 are closed.** The paragraph above framed the remedy as "one line per token", which was
the wrong shape: darkening five fills would have muddied the palette and left a sixth colour free to
reintroduce the same flaw. The fault was structural — **label and fill were the same token**, so each
colour was measured against itself and the ratio was a property of one token plus whatever page sat
behind it. That is also why two colours passed on `surface` and failed on `raised`.

The label is now a **separate token per family**, `--q-<fam>-on-tint`, solved against the darkest page.
QTag pairs `bg-<fam>/12` with `text-<fam>-on-tint`. **The fills are untouched** — so hue, vividness and
the tint itself are exactly as before (the measurements below show an identical `tint=` on both sides).
This mirrors `textOnSolid`, which already existed for labels on a _solid_ accent fill.

Browser-measured, axe, light mode — before → after:

| Colour    | surface            | canvas             | raised             | label                                                           |
| --------- | ------------------ | ------------------ | ------------------ | --------------------------------------------------------------- |
| `accent`  | 5.04 → **5.31**    | 4.74 → **4.99**    | 4.40 ❌ → **4.64** | `#994827`                                                       |
| `success` | 5.29 → **5.29**    | 4.96 → **4.96**    | 4.62 → **4.62**    | `#356b44` (unchanged — W3c-2 already moved the fill far enough) |
| `warning` | 4.48 ❌ → **5.34** | 4.18 ❌ → **4.99** | 3.92 ❌ → **4.67** | `#7e5a17`                                                       |
| `danger`  | 4.96 → **5.33**    | 4.66 → **5.00**    | 4.33 ❌ → **4.65** | `#ab352c`                                                       |
| `info`    | 4.50 ⚠️ → **5.30** | 4.23 ❌ → **4.98** | 3.93 ❌ → **4.63** | `#356397`                                                       |

Dark mode, same method. Four families were already clear and are **byte-identical** after the change;
only `danger` moved, which is **T-3** and the one measured reason to touch a dark value:

| Colour    | surface         | canvas          | raised             | label     |
| --------- | --------------- | --------------- | ------------------ | --------- |
| `accent`  | 5.46 → 5.46     | 6.00 → 6.00     | 4.94 → 4.94        | unchanged |
| `success` | 5.34 → 5.34     | 5.83 → 5.83     | 4.77 → 4.77        | unchanged |
| `warning` | 5.65 → 5.65     | 6.20 → 6.20     | 5.04 → 5.04        | unchanged |
| `danger`  | 4.97 → **5.19** | 5.44 → **5.68** | 4.44 ❌ → **4.64** | `#dd8075` |
| `info`    | 5.66 → 5.66     | 6.21 → 6.21     | 5.07 → 5.07        | unchanged |

(axe measures dark `danger` before at 4.44 where T-3 recorded 4.47 — under AA on either reading.)

**Seven other consumers shared the recipe**, which is the part the register had not noticed. The same
`bg-<fam>/12 text-<fam>` pairing appears in `offline-banner` (a **live** `warning` text failure at
4.18 on canvas), `notification-filters`, `notification-item`'s five glyphs, `editor-toolbar`, and
admin's `login-form`. All now take the `-on-tint` label. The glyphs and toolbar icons are non-text and
answered to the 3:1 bar, so they were not failing — but leaving the wrong pairing in place is precisely
how the class spread from one component to eight.

**W3c's `neutral` workaround on the blocks page is removed**: good standing renders `success` again.

**What stops it recurring** is not the tokens, it is the scan — see the next entry.

### T-3 · ~~**low**~~ · **CLOSED 2026-07-29** · dark mode's `QTag danger` was 4.47:1 on raised

`#dc7b70` on its own tint over `#26221e`. Latent, same condition as `accent`/`danger` above — and note
the token already carries a comment about being lightened once for this exact reason, so the ramp was
tuned against `surface` and never re-checked against `raised`. **Fixed with T-2** via
`--q-danger-on-tint: #dd8075` (4.64 on raised), which settles it without re-tinting the fill a second
time.

### T-4 · **low** · AntD's derived _active_ colour on a default button is 3.46:1 in dark mode

The sibling of W3c-3 that pinning hover does not cover: `colorPrimaryActive` derives to `#996145`,
which measures **3.46 / 3.72 / 3.12** on dark surface / canvas / raised. Light mode is fine (`#783218`,
9.26:1). It is low severity because it only renders while the pointer is held down, which is why no axe
scan catches it — the same blind spot that let the hover defect live until a scan happened to leave the
cursor parked. The fix is one more line beside the hover pin (`defaultActiveColor: c.accent`), left
undone deliberately under this pass's scope lock.

### T-5 · **low** · two token mirrors nobody is tracking

`tokens.css` names its mirrors — "styles/tailwind.css and src/theme/antd-theme.ts" — and both were
updated. But `frontend/src/features/analytics/lib/chart-options.ts` carries the palette hexes **twice
more** (`FALLBACKS.light.palette[2]` and an inline `?? '#3e7c4f'`), and they are now stale. Harmless
today: they are chart-series colours for non-text graphics (3:1 bar, not 4.5) and only used when the CSS
variable cannot be read. But they are two undeclared copies of a "single source of truth", which is the
condition that produced W3c-4 one section above. Either delete them in favour of the CSS variable or add
them to the mirror list in `tokens.css`.

### T-6 · ~~**medium**~~ · **CLOSED 2026-08-05** · `resolveFirst()` asserts on the wrong element, so resolving a comment is untested

Found while trying to render a `success` tag. `e2e/pages/frontend/story-comments-page.ts`:

```ts
await this.page.getByRole('button', { name: 'Resolve' }).first().click();
await expect(this.page.getByText('Resolved', { exact: true }).first()).toBeVisible();
```

The comments page has a **status filter whose chip is labelled exactly "Resolved"**, and it is always
visible — so this assertion passes whether or not anything resolved. Confirmed directly: the same
locator, evaluated, returns an element painting ink on white (the chip), not a success tag.

**And the flow underneath appears not to work.** Clicking Resolve and then filtering to Resolved shows
"No comments yet". Whether the resolve write never lands or the `status=resolved` query does not return
it is **not root-caused here** — recording the observation, not a diagnosis. Either way `inline-review.spec.ts`'s
"a writer comments on their story, replies, and resolves the thread" is green without proving the third
verb, which is the same defect class as W3c-4: an assertion that pins the wrong thing keeps the suite
green over a broken surface. Fix the assertion first (scope it to the comment item), then see what fails.

**Still open.** The 2026-07-29 recipe pass did not touch it: the tag it was blocking is now rendered by
a dedicated spec instead (below), so nothing depended on getting this flow working. The weak assertion
and whatever sits under it are unchanged.

#### Resolution (2026-08-05) — (a) scope the assertion, then (b) the answer was "neither"

**(a) The assertion.** `resolveFirst(body)` now scopes to the comment's own `<li>`
(`getByRole('listitem').filter({ hasText: body })`) and asserts two things inside it: the `Resolved`
tag is visible, and the `Resolve` button is **gone** — `comment-thread.tsx` drops Reply and Resolve
once `status === Resolved`, so its absence is independent evidence the component re-rendered off a
genuinely resolved DTO rather than painting a tag optimistically. The filter chip is a `<button>`
outside every list item and can no longer be mistaken for the outcome.

**(b) And then it did not fail — because the diagnosis on offer was the wrong pair.** The register
posed "the resolve write may not land, or the `status=resolved` query may not return it". It is
neither. **The Resolve button was never clicked.**

```ts
await this.page.getByRole('button', { name: 'Resolve' }).first().click();
```

Playwright's `getByRole` `name` option matches a **substring**, case-insensitively, unless
`exact: true`. `"Resolved"` contains `"Resolve"`, so that locator matched **two** buttons — the
thread's Resolve _and_ the status filter's Resolved chip — and the chip wins `.first()` because
`QSectionHeader` renders before the `<ul>`. Confirmed by evaluating both locators against the page's
real button structure:

```
OLD locator matches:    [ 'filter-resolved', 'thread-resolve' ]
OLD .first() id:        filter-resolved
OLD assertion target:   filter-resolved        ← the same chip it had just clicked
OLD assertion visible with nothing resolved: true
NEW locator matches:    [ 'thread-resolve' ]
```

So the helper clicked the **filter**, switching the list to resolved-only, and then asserted that the
chip it had clicked was visible. Both halves pointed at the same wrong element, which is why it was
self-consistently green. And it explains the observation exactly: "clicking Resolve and then filtering
to Resolved shows _No comments yet_" is a resolved-only list on a story where nothing was ever
resolved. There was never a backend defect here — the write path and the `status` query were both
fine the whole time, and the note that they might not be was an artefact of the same broken locator.

**Proven end to end against the live stack**, because "it passes now" is not evidence on its own:

| check                                                        | result                                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| the scoped assertion, resolve clicked                        | passes — tag present, Resolve button gone                                                                |
| **resolve, then filter to Resolved** (the exact observation) | the comment **is listed** — rules out both original hypotheses at once                                   |
| the scoped assertion with the click removed                  | **fails** (`waiting for … .getByText('Resolved', { exact: true })`) — where the old page-wide one passed |
| `inline-review.spec.ts`, whole file                          | 4/4 green                                                                                                |

The spec now carries the round-trip itself (`filterResolved()` then assert the comment is listed), so
the third verb is proven at the server rather than at a tag.

**The transferable lesson, since this is the third of its class after W3c-4 and W5-10:** `getByRole`
with a bare `name` is a **prefix/substring** match. Any label that is another label's prefix —
Resolve/Resolved, Publish/Published, Follow/Following, Archive/Archived — silently matches both, and
`.first()` then picks by DOM order, which is usually the page chrome rather than the item under test.
Scope to the item first; reach for `exact: true` on names that are prefixes of one another.

**Swept the rest of the suite for the same pair-shape; one latent case, no second live defect.**
`editor-page.ts`'s `publishButton` is `getByRole('button', { name: 'Publish' })` and the publish
drawer contains **"Publish now"**, which contains it. It is safe _today_ only because the click
happens while the drawer is closed, so exactly one button matches — and if that ever stops being true
Playwright's strict mode throws on two matches rather than silently picking one, which is the loud
failure T-6 did not get. Left alone (scope-locked); noted so the next person does not have to
re-derive it. No other button label in `pages/` is a prefix of a sibling.

### T-9 · **medium** (harness) · `npm run build` silently disarms a running local E2E stack

Opened 2026-08-05 while verifying T-6; **not fixed** (out of that pass's scope), and recorded because it
cost an hour of chasing a defect that did not exist.

Locally `REUSE_SERVER` is true, so Playwright **attaches** to whatever is already on :5173 rather than
starting it — and the way the local stack is run, that is `vite preview`, which serves
`frontend/dist` **from disk**. The E2E bundle is only correct because it was built with
`VITE_ENABLE_COLLABORATION=true` + `VITE_ENABLE_MONETIZATION=true` (the `webServer.env` block here, and
`web-e2e.yml:153/322` in CI). A plain root `npm run build` — which the release checklist asks for, and
which builds with default flags — **overwrites that dist in place**. The long-lived `preview` process
keeps serving, now returning the dark build.

The symptom is maximally misleading: every collaboration and billing spec fails inside its page
object's `goto()` on `expect(heading).toBeVisible()`, because the page really did render — as
**"Collaboration is off"**. It reads as a broken selector or a broken route, and it reproduces on a
clean tree, so a `git stash` bisect "confirms" the failure is pre-existing when in fact the build is
the cause and the tree is irrelevant.

**Turbo makes it worse, not better.** A second `npm run build` reports `>>> FULL TURBO` and finishes in
177 ms — and still breaks the stack, because restoring `frontend/dist` from the cache writes the
default-flag artefact back over the flagged one. So "I didn't actually rebuild anything" is not a
defence, and the damage recurs on every cached build until the flagged one is re-run.

Recovery is a rebuild with the flags:

```bash
VITE_API_URL=http://localhost:4000/api/v1 VITE_ENABLE_COLLABORATION=true \
  VITE_ENABLE_MONETIZATION=true pnpm --filter frontend build
```

Worth a real fix rather than a note — candidates: have `stack-up.sh` own the flagged build, have the
local stack run `dev` (which reads `webServer.env`) instead of `preview`, or have the page objects fail
with "the app was built with collaboration off" when they see that empty state. Same family as the
`tsc --noEmit`-instead-of-`build` trap: the verification step itself changed the thing being verified.

### T-2b · **CLOSED 2026-07-29** · the scan hole — why a token could fail with a green suite

Recorded as the root cause of T-2 rather than a defect in its own right, because it is the reason four
colours could sit under AA with every a11y scan passing: **a token is only scanned if some page happens
to paint it.** `QTag color="success"` was painted by no scan at all — the comments scan never resolves a
comment (T-6), and the blocks page had been switched to `neutral` precisely to dodge the failure. §3.5
originally measured the matrix by hand, in a throwaway spec that was deleted; a hand measurement that
gets deleted is not a guard.

It is now a permanent spec: **"every QTag colour clears AA on every page background"**
(`e2e/tests/frontend/a11y.spec.ts`), running in `frontend-chromium` and `frontend-dark`. Two properties
make it a guard rather than a snapshot of today's palette:

1. **It reads the recipe out of `q-tag.tsx`** — parses the `COLOR` map, asserts every tinted fill is
   paired with a `text-<fam>-on-tint` label, then renders each entry on all three page backgrounds.
   A copy of the class strings would have drifted the first time the component moved; a sixth colour is
   covered the moment it is added to the component, not when a page gets round to using it.
2. **It renders into a live page**, so the real stylesheet, cascade and alpha compositing apply — the
   [10 §8.4](./e2e/10_UIQuality.md) rule, honoured rather than restated.

Both halves were verified by breaking them, not by assuming:

```
revert the labels to `text-<fam>`  → fails statically, listing all 5 mispaired colours,
                                     before a single pixel is measured
set --q-info-on-tint too light     → axe fails it on all three backgrounds
                                     (2.36 / 2.22 / 2.06)
```

The static half matters more than the pixel half: it fails on the _rule_, so a wrong pairing cannot
reach a browser at all. The pixel half catches a plausible-but-insufficient value, which no static rule
could.

### T-7 · **medium** · `assistant.spec.ts` "writes and autosaves" is flaky under parallel load

**Already recorded by W3c** ([49 §6g](./49_WebCollaborationEpicDesign.md), "One pre-existing E2E failure"),
which established it by stashing every W3c change. Repeated here only because this pass re-measured it
independently and the numbers pin the mechanism — it is not a new defect.

`tests/frontend/assistant.spec.ts:60` fails on the title assertion after `editor.reload()`
(`expect(getByLabel('Title')).toHaveValue(...)`), but **only when the full suite runs**. Measured:

| Condition                                       | Result               |
| ----------------------------------------------- | -------------------- |
| spec alone, 1 worker, current tokens            | 3/3 **pass**         |
| full frontend suite, 8 workers, current tokens  | **fail** (2 runs)    |
| full frontend suite, 8 workers, tokens reverted | **fail** — same test |

**Widened by the W4 measurement (2026-07-29).** W4 re-measured this the same way — stash every change,
rebuild, run the suite — and found the flake set is **larger than one test**. Ten runs in total:

| Condition                 | Runs | Fully green | Runs with one failure | Which test flaked                                                        |
| ------------------------- | ---- | ----------- | --------------------- | ------------------------------------------------------------------------ |
| pre-W4 baseline (stashed) | 3    | 1           | 2                     | `assistant.spec.ts:60` ×1, `a11y.spec.ts` register page (dark) ×1        |
| with W4 (137 tests)       | 7    | 1           | 6                     | `assistant.spec.ts:60` ×4, register a11y ×1, `publishing.spec.ts:116` ×1 |

So **three** distinct tests flake under contention, not one:

| Test                                                       | Nature                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| `assistant.spec.ts:60` "writes and autosaves"              | autosave-persist vs reload-rehydrate race (the original) |
| `a11y.spec.ts` "register page …" (`frontend-dark` only)    | axe scan on a page still settling                        |
| `publishing.spec.ts:116` "sends the story back with notes" | review-state write vs re-read                            |

All three pass in isolation (verified individually) and each fails only in a loaded 8-worker run. **No
W4 test failed in any of the ten runs**, and one W4 run was fully green at 137/137 — so adding 25 tests
did not create the problem, it made an existing one more likely to be observed. CI's `retries: 2` absorbs
all three, which is why this has never been seen there; locally retries are 0 by design.

**Still recorded rather than chased** — the shared shape is "a write is not yet readable when the next
step asserts on it", which is a waiting strategy to fix in three page objects, not a product defect.

The last row is the one that matters: it fails identically with the token change reverted, so it is
**pre-existing and unrelated** — the same loaded run showed 2 failures before the fix (this plus the
publishing a11y scan) and 1 after. It is a race between autosave persisting and the reload rehydrating,
which only loses under contention. Not triaged further here.

### T-8 · ~~**high (process)**~~ · **CLOSED 2026-07-29** · running a visual spec locally silently mints host-rendered baselines

`frontend-collaborators` has no baseline for `frontend-chromium` or `frontend-dark`, so running
`visual.spec.ts` locally makes Playwright **write one** ("A snapshot doesn't exist …, writing actual")
from the host's own browser. It looks like a pass on the next run. [10 §8.3](./e2e/10_UIQuality.md) forbids
exactly this — baselines are only valid from `mcr.microsoft.com/playwright:v1.61.1-noble` — and both W3a
and W3c already caught and deleted one. **This pass generated two more and deleted them.**

Three occurrences is a process gap, not bad luck. Worth one of: `--ignore-snapshots` in the local run
script, `ci: true` in the Playwright config so missing snapshots fail instead of being written, or a
pre-commit hook rejecting untracked files under `*-snapshots/`.

#### Resolution (2026-07-29) — the config now refuses, and the refusal is the default

W4 made it a **fourth** occurrence, which settled it. `playwright.config.ts` sets **`updateSnapshots:
'none'`**: a missing baseline now fails with "A snapshot doesn't exist at …" and writes nothing.

`ci: true` was considered and is not a Playwright option; `--ignore-snapshots` in a run script is worse
than useless here, because it _skips the comparison_ — a visual spec would go green without ever
rendering, which is a quieter version of the same lie. `'none'` is the only setting that keeps the
comparison and removes the write.

**The one path that may still mint is unaffected**, because a CLI flag overrides config: `web-e2e`'s
`web-e2e-visual` job already passes an explicit `--update-snapshots` inside the pinned image ([10 §8.3]).
Both directions were verified — a local run of a baseline-less spec failed and left the 44-file snapshot
inventory byte-identical (checksummed before and after), and the same spec with `--update-snapshots` still
wrote its PNG, which was then removed.

**Intended consequence:** a newly added visual spec **fails until the workflow mints its baseline**. The
three W4 billing specs are in exactly that state. A red spec asking for a baseline is correct; a green one
that invented its own is not.

---

## 3.6 Found while building W4 — AF5 contract findings (2026-07-29)

Five findings from porting mobile's `features/monetization` to web. **None is a client defect and none
was worked around beyond what is noted** — recorded per the scope lock, not fixed.

Context first, because it is the good news: `qalam-mobile/docs/56` audited all twenty AF5 endpoints and
found mobile's field mapping clean, and re-verifying each shape live against the running backend while
writing the web layer **confirmed that**. Every finding below is in the contract or its published types,
not in either client's reading of them.

**The W3c-1 check the row asked for comes back clean.** All twenty routes are coarse-gated on
`@Permissions(PERMISSIONS.BillingUse)`, which `Role.User` holds, and **none of them asserts an
entitlement** — the entitlement decisions these routes return are data, not gates. So there is no AF5
route where the guard and the Entitlement Service can disagree. Verified live on a **pre-existing**
database (4h-old container, per the row's instruction): every read answers 200 for the seeded writer, so
the `billing.use` seed-grant defect fixed in `de61316` is confirmed closed in practice, not just in code.

### W4-1 · ~~**medium**~~ · **CLOSED 2026-07-29** · `subscription/history` 404s where its three sibling ledgers answer an empty page

`GET /monetization/subscription/history` is one of four cursor-paginated owner-scoped ledgers on this
controller. The other three (`/invoices`, `/payments`, `/purchases`) answer `data: []` for a viewer with
nothing to show. This one answers **404 `SUBSCRIPTION_NOT_FOUND`**, because `SubscriptionService.listHistory`
loads the subscription first and throws if there is none.

```
GET /monetization/invoices              → 200 {"data":[],"meta":{"pagination":…}}
GET /monetization/subscription/history  → 404 SUBSCRIPTION_NOT_FOUND      ← same viewer
```

Every free reader hits it, since having no subscription is the majority state. Mobile never saw this: it
has no subscription-history UI at all (its repository exposes `history()` and no screen calls it).

**Mitigated client-side, deliberately narrowly.** `useSubscriptionHistory` mapped that one code to an
empty page so the "Plan changes" tab read "No plan changes yet" instead of showing an error panel.

#### Resolution (2026-07-29) — fixed at the endpoint, and the workaround deleted

`SubscriptionService.listHistory` resolved the caller's subscription with `getByUser` (which throws) and
filtered events by `subscription_id`. It now filters by **`user_id`** — the same owner scoping the three
siblings use — so the lookup that threw is gone entirely rather than guarded.

That needed one more thing to be honest: `subscription_events` was the only one of the four ledger tables
**without** a `(user_id, created_at)` index, which is presumably why it went via `subscription_id` in the
first place. Trading a 404 for a sequential scan of an append-only table is not a fix, so
`idx_subscription_event_user_created` was added to match `idx_invoice_user_created` and its two siblings
(migration `1784620000000`, `CREATE INDEX CONCURRENTLY`, up/down round-trip verified).

The client-side mapping is **removed**, and its spec now asserts the opposite — a 404 must surface as an
error. If the endpoint regresses, that fails loudly instead of a client quietly absorbing it again.

### W4-2 · ~~**medium**~~ · **CLOSED 2026-07-29** · `@qalam/api-types` declares the wrong shape for `purchases/restore`

| Source                                          | Shape                                        |
| ----------------------------------------------- | -------------------------------------------- |
| `packages/api-types` `RestorePurchasesResponse` | `{ restored, subscription, creditsGranted }` |
| `monetization.controller.ts#restore` (actual)   | `{ restored, providerRef, expiresAt }`       |

Two of three fields are wrong in each direction. A client typed against the package would compile against
a response that never arrives — `subscription` and `creditsGranted` are always `undefined`, and the real
`expiresAt` is invisible to the type system. Mobile happens to read the _correct_ fields (`restored`,
`expiresAt`), so it was written from the controller rather than the package.

W4 declared its own `RestorePurchasesResult` from the controller and said why in a comment.

#### Resolution (2026-07-29) — and there was a **third** wrong copy

Fixing the package turned up one more: `monetization-response.dto.ts` also declared
`{ restored, subscription, creditsGranted }`, and because the route carried **no `@ApiOkResponse`**, that
class was orphaned — so Swagger documented nothing and the DTO was never compared to anything. The drift
existed in three places and was checkable in none.

All three now agree with the controller: the package type is corrected, the Swagger DTO is corrected and
**renamed `RestoreResultDto`** (the request DTO already owned `RestorePurchasesDto` — two same-named classes
in one module is how the orphan stayed invisible), and the route declares it. A missing `region` on
`CreateSubscriptionRequest` was found in the same sweep and added: the DTO accepts it and the controller
uses it, so regional pricing was reachable from the API and invisible to every typed client.

The frontend's local override is now a plain alias of the package type.

> **Class closed 2026-08-05** — this instance plus W4-5 and W5-1 are now held by a package-wide guard:
> [§3.11](#311-w4-2--w4-5--w5-1--class-closed-2026-08-05--qalamapi-types-drifting-from-the-dtos).

### W4-3 · see [§5.2](#52-the-monetization-catalogue-sells-eight-features-and-the-backend-enforces-one-opened-2026-07-29-during-w4)

The "eight sold, one enforced" hole was already opened during W4 scoping and is documented there. Two notes
from the implementation, confirming its predictions held:

- **Gating followed §5.2 exactly**: `PremiumGate` is used only for `ai_budget`, and the other seven get a
  non-blocking `PremiumBadge`. Its consequence 2 (the two distinct `ai_budget` denials) is what
  `availabilityFromErrorCode`'s new `upgrade` state closes.
- **Independently re-confirmed live**: `PolicyEngineService.isEntitled()` still has zero callers, and
  granting an `ai_writing` override flips the snapshot to `allowed: true` while changing no route's
  behaviour — the decision is computed and then unused.

### W4-4 · ~~**high**~~ · **CLOSED 2026-07-29** · there is no inert payment port, so `subscribe` cannot succeed anywhere without third-party keys

[`docs/e2e/06 §6`](./e2e/06_PhasePlan.md) parked the `af5` row partly on the premise that "the third-party
allowance covers running against an inert **port**". **That premise does not hold.** Every adapter is
key-gated and refuses rather than no-ops:

| Provider          | `isConfigured()` tests            | Without keys                      |
| ----------------- | --------------------------------- | --------------------------------- |
| `stripe`          | `config.stripe.secretKey`         | `PAYMENT_PROVIDER_NOT_CONFIGURED` |
| `apple_app_store` | `config.apple.sharedSecret`       | `PAYMENT_PROVIDER_NOT_CONFIGURED` |
| `google_play`     | `config.google.serviceAccountKey` | `PAYMENT_PROVIDER_NOT_CONFIGURED` |
| `manual`          | — **no adapter exists**           | `PAYMENT_PROVIDER_NOT_CONFIGURED` |

`PaymentProvider.Manual` is in the shared vocabulary (and documented as covering "admin/comp grants") with
**no implementation**, so it is not the escape hatch its presence suggests. Verified live with the payments
flag raised: all four refuse.

**Consequence for the `af5` row.** "Subscribe → entitlement granted" could not be asserted through a
payment in any environment without real credentials, so W4's E2E asserted the honest refusal plus an
entitlement grant via admin override.

#### Resolution (2026-07-29) — `manual` is now implemented, and it was the right seam

`PaymentProvider.Manual` shipped in the vocabulary documented as covering "admin/comp grants" with **no
adapter** — that absence is the actual gap. `ManualAdapter` fills it: `createCheckout` reports
`activated: true`, so `BillingService` opens the subscription **and** calls `recordSuccessfulCharge`,
writing the paid invoice and the succeeded payment. One request produces the whole chain.

**Chosen over a Stripe test key**, for three reasons. `StripeAdapter.createCheckout` does a real `fetch` to
`api.stripe.com`, so every E2E run would take on a third party's availability and latency — a flake class
this suite has no defence against. It would need a payment credential in CI secrets. And it would not prove
more of what the row is about: Stripe's HTTP client and its webhook HMAC scheme are already covered offline
by `stripe.adapter.spec.ts`. What `manual` does **not** cover is Stripe's redirect flow, its webhook path,
and provider-side subscription state — still unasserted by the browser suite, recorded here rather than
implied away.

**Safety.** Off unless `PAYMENTS_MANUAL_ENABLED === 'true'` (a boolean, since there is no credential to gate
on); every money-moving call throws `PAYMENT_PROVIDER_NOT_CONFIGURED` otherwise; `verifyWebhookSignature`
returns false unconditionally, so nobody can post a "manual" event and have it trusted; `validateReceipt`
never approves. Enabled in `e2e/scripts/stack-up.sh` and both `web-e2e` job envs, nowhere else. **It books
revenue nobody collected**, so it is a test-stack provider and not a comp-grant mechanism — real comps keep
going through `/admin/monetization/overrides`, which does not touch the ledger.

The `af5` row now asserts **subscribe → payment → entitlement** for real: a throwaway subscriber, a 499
succeeded payment, a paid invoice, `ai_writing` flipping to allowed, and the client rendering both the tier
and the receipt. The platform-dark refusal is still asserted alongside it, because that is every
deployment's default state.

**One spec-design bug this exposed, worth keeping.** The two flag-flipping tests raced under
`fullyParallel` — `feature.payments.enabled` is a single global row, so the dark test switched it off
mid-checkout and the payment test failed with `MONETIZATION_DISABLED`. They are now in a
`test.describe.serial` block. The entitlement-override test needs no such treatment: its change is scoped
to one user.

### W4-5 · ~~**medium**~~ · **CLOSED 2026-07-29** · `@qalam/api-types` declares a `couponCode` on `ChangePlanRequest` that the DTO rejects

`ChangePlanRequest` in `packages/api-types` carries `couponCode?: string`. The backend's `ChangePlanDto` has
no such property, and the app runs `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`
(`main.ts:169`) — so sending it does not get politely dropped, it **400s the entire plan change**.

This is the same trap as **M-1** (§3.1), one package-level type away: a client trusts a published type,
sends a field the DTO forbids, and the whole write fails.

#### Resolution (2026-07-29) — removed from the type, and the class of defect is now pinned

`couponCode` is gone from `ChangePlanRequest`. Whether a coupon _should_ apply to a plan change stays a
product question; until the DTO grows the field, the honest contract is that it cannot.

**The pin matters more than the fix.** `monetization-contract.spec.ts` reads the request interfaces out of
the package's own source and asserts that every declared key is a _validated_ property of the DTO that
receives it — which is what `forbidNonWhitelisted` actually requires, and what `@ApiProperty()` alone does
not satisfy. Response shapes are pinned by compile-time mutual assignability against the controller's
declared return type.

Getting there took two attempts, and the first is worth recording because it is the failure mode these
tests are prone to. v1 hand-listed the interface keys behind a `satisfies Record<keyof T, true>` guard, and
**re-introducing the exact W4-5 drift left all nine tests green**: the literal knew nothing of the new
field, and Jest transpiles without type-checking so the compile-time guard never ran. `tsc` did not catch
it either — the backend had no `@qalam/api-types` dependency at all, so the import silently failed to
resolve and the whole response half was inert. Fixed by adding the devDependency and by **parsing the
package source** for keys, the same technique the QTag contrast scan uses on `q-tag.tsx` (T-2b) and for the
same reason: a test that restates what it checks drifts from it. The drift was re-injected afterwards, the
suite failed as it should, and it was reverted.

> **Class closed 2026-08-05.** The pin described above was module-scoped and hand-listed six pairs, so it
> could not see W5-1 coming. It is superseded by a package-wide guard that discovers its own pairs and
> refuses to let a new export arrive unpinned:
> [§3.11](#311-w4-2--w4-5--w5-1--class-closed-2026-08-05--qalamapi-types-drifting-from-the-dtos).

---

## 3.7 Mobile follow-ups opened by W4 (2026-07-29)

Under the parity rule these are rows mobile now needs. Both are **mobile is behind**, and neither is a
regression — they are gaps W4 surfaced by building the same surface properly.

### M5-1 · ~~**medium**~~ · **CLOSED 2026-08-03** · mobile's `PremiumGate` has zero call sites, and its own doc comment says otherwise

`lib/features/monetization/presentation/widgets/premium_gate.dart` opens with:

> "Every premium affordance elsewhere wraps its content in [PremiumGate] (or checks the entitlement
> snapshot); there is no scattered inline plan check."

**No file imports it.** `PremiumGate`, `FeatureLockCard` and `PremiumBadge` are all unreferenced outside
their own file, and no mobile screen checks the entitlement snapshot either. So mobile computes entitlements
correctly, caches them, and gates nothing — and the comment reads as a description of working code, which is
worse than no comment, because it is the thing a reader would check instead of grepping.

The web side is wired: `PremiumGate` guards the credit balance on `ai_budget` (the one enforced feature),
`PremiumBadge` marks the viewer's tier, and the AI assistant grew the `upgrade` state that
`ENTITLEMENT_DENIED` deserves. **Mobile needs the equivalent wiring as its own row** — the components exist,
so this is placement, not construction:

1. `credit_dashboard_screen` — gate the balance on `ai_budget`, as web does.
2. The AI surfaces — map `ENTITLEMENT_DENIED` / `INSUFFICIENT_CREDITS` to an upgrade state distinct from the
   quota state. Mobile currently surfaces both as a generic `Failure` message.
3. Fix or delete the doc comment's claim.

#### Resolution (2026-08-03) — placement derived from what the server asserts, and the two denials split

All three items, and the placement follows §5.2 rather than the widget's own ambition:

1. **The credit balance is gated on `ai_budget`**, `optimistic`, exactly as web's credits page does —
   the one premium feature any route actually asserts. Nothing else is gated. `PremiumBadge` marks the
   viewer's tier on `subscription_screen`, which is where web puts it, and it withholds nothing.
2. **The two `ai_budget` denials are now different states on mobile too.** `ENTITLEMENT_DENIED` and
   `INSUFFICIENT_CREDITS` were unmapped in `AiErrorCopy`, so they fell through to the generic
   `canRetry: true` failure — a blocked writer was invited to try again, and then (once
   `QUOTA_EXCEEDED` was mapped) to wait for a reset that would never help. Both now carry a
   `canUpgrade` remedy and a "See plans" action on all three AI surfaces (assistant panel, coach
   panel, Ask). `QUOTA_EXCEEDED` reads as a spent allowance and never offers a plan.
   `FeatureLockCard` makes the same split from the decision's own `reason`, so the lock says _reset on
   <date>_ or _needs a paid plan_ rather than one generic sentence. Mobile lacked an
   `EntitlementReason` vocabulary entirely — it was comparing against a bare `'plan_excludes'` string
   literal — so that was mirrored from `@qalam/shared` along with `entitlementReasonLabel`.
3. **The doc comment is rewritten, not deleted.** It now names its call sites, which is what makes it
   checkable; a comment claiming universal use was worse than none because it is the thing a reader
   checks instead of grepping.

**One consequence had to be handled, not just noted.** With the gate in place, a build with
`QALAM_ENABLE_MONETIZATION` down would have shown a paywall over an unreleased feature — the snapshot
answers the free-tier default in that mode, which denies everything. `entitlementSnapshot` now
short-circuits to that default without issuing a request when the flag is down (web's
`enabled: isMonetizationEnabled()`), and the credit dashboard opens with the flag-off empty state web's
credits page already had. **The other four monetization screens still lack that branch — see M5-4.**

### M5-2 · ~~**low**~~ · **CLOSED 2026-08-03** · mobile can never redeem a coupon

`MonetizationRepository.validateCoupon` exists, is implemented through to the data source, and **is called by
nothing**. `plans_screen` passes no `couponCode` to `subscribe()`, and there is no field to type one into. So
a mobile subscriber cannot use a promotion, and the whole `PromotionType` catalogue is unreachable from the
app.

Web built the field from the DTO (there was nothing to port) and validates through the real endpoint before
checkout. Mobile needs the same field on `plans_screen`. Small, and worth doing with M5-1.

#### Resolution (2026-08-03) — the field, and the `couponCode` that was never sent

`coupon_field.dart` + a `CouponController`, placed on `plans_screen` below the plan list, and
`subscribe()` now carries the accepted code. Three details taken from web's version rather than
re-derived:

- **Hidden from existing subscribers, not ignored for them.** `ChangePlanDto` has no `couponCode` and
  the API runs `ValidationPipe({whitelist: true, forbidNonWhitelisted: true})`, so sending one would
  400 the whole plan change (W4-5). The field only appears when there is no subscription.
- **The code is normalized before it leaves.** `normalizeCouponCode` was mirrored from `@qalam/shared`;
  the server looks a coupon up by its upper-cased, trimmed form, so an untrimmed lower-case code
  simply finds nothing and reads to the user as "invalid".
- **`valid: false` is an answer, not an error.** The endpoint catches both coupon exceptions and
  resolves with a false flag, so it renders as a plain "that code isn't valid" rather than a failure
  state — and the preview is explicitly not a promise: redemption still happens at checkout, and
  checkout's own result is what the reader is told.

No `tier` is sent with the preview: the reader has not chosen a plan when they type the code, so the
server confirms it without a figure rather than pricing it against a guess. Mobile also had no
`couponCodeMin`/`Max` mirror, so the field could accept a 60-character code that `@MaxLength(40)`
would have 400'd; it now caps input.

### M5-3 · ~~**low**~~ · **CLOSED 2026-07-29** · mobile's `formatMoney` mis-rendered every currency but five

Found by auditing whether W4's web-side money bug existed anywhere else. It did — in the one other place
money is formatted.

`monetization_format.dart` divided **every** amount by 100 and looked the symbol up in a five-entry table,
falling back to a bare code. Two consequences: a zero-decimal currency was wrong by 100× (¥1499 rendered as
"¥14.99" — a plausible-looking price two orders of magnitude out), and any currency beyond the five rendered
as `"AUD 14.99"`.

Fixed the same way as web: a minor-unit table for the currencies that are not hundredths, and `intl`'s
`NumberFormat.simpleCurrency` for the symbol, with the decimal count pinned to the real minor unit rather
than the locale's display convention (CLDR renders PKR with none, which would round 1499 paisa to "PKR 15").

**`NumberFormat.currency` was the wrong entry point and the existing test caught it** — it treats `name` as
the literal symbol, so USD came out as "USD14.99". `simpleCurrency` resolves the code to a symbol. Worth
noting because the two read almost identically at a glance.

### M5-4 · ~~**low**~~ · **CLOSED 2026-08-03** · four of mobile's five monetization screens ignore the dark-launch flag (opened 2026-08-03, during M5-1)

`QALAM_ENABLE_MONETIZATION` gated exactly one thing on mobile: whether the **Premium section appeared
in the settings hub**. The `/billing/*` routes are registered unconditionally, so every one of them
stayed deep-linkable in a dark build, and `plans_screen`, `subscription_screen`,
`usage_dashboard_screen` and `billing_history_screen` rendered normally when reached — issuing live
`/monetization/*` requests for a platform the build says is off.

Web does not have this shape: all five of its monetization pages open with `isMonetizationEnabled()`
and an empty state. `credit_dashboard_screen` gained one during M5-1, because that row's gate would
otherwise have put a paywall over an unreleased feature — which is how the gap was found.

**The collaboration side was already correct**, which is what made this a defect rather than a
convention: every AF6 screen (`collaborators`, `comments`, `suggestions`, `publishing_workflow`,
`invitations_inbox`, and the new `blocks`) checks `enableCollaboration` and says so. Monetization was
the odd one out.

#### Resolution (2026-08-03) — one widget, five screens, and the routes left alone

`MonetizationOffScreen` carries the state and all five screens open with it, using web's own copy per
surface. One widget rather than five inline copies because the five say nearly the same thing and the
failure mode is drift — one of them quietly implying the feature exists while its neighbours say it
does not.

**The routes stay registered, deliberately.** Web's are too. Gating the route table would mean a dark
build 404s a link that a flag flip makes valid, which is a worse answer than a screen saying plainly
that the feature has not shipped. The honest state belongs on the screen, so the regression test
asserts per-screen rather than per-route.

### M5-5 · ~~**low**~~ · **CLOSED 2026-08-03** · `premiumFeatureAllowedProvider` is exported and unused (opened 2026-08-03, during M5-1)

`monetization.dart` exported it from the feature barrel and nothing in `lib/` or `test/` read it — the
same shape as M5-1 one layer down. It survived M5-1's fix because the gate reads the whole snapshot:
it needs the `reason`, not just the verdict, to choose between "see plans" and "wait for the reset".

#### Resolution (2026-08-03) — deleted, not given a caller

A per-feature boolean is the wrong shape for the only consumer that would ever want it, so adding a
call site would have meant building a second, worse gate to justify the first. The provider and its
export are gone; a comment in its place points the next reader at `entitlementSnapshotProvider` and
says why. A public provider nobody calls is a claim about the feature's API that is not true.

### M5-6 · ~~**low**~~ · **CLOSED 2026-08-03** · two of mobile's four billing ledgers had no surface (opened 2026-08-03, while closing M5-4)

**§2 had been carrying this as prose** — row 2's "plus a coupon field and two history tabs mobile
lacks" — with no row of its own, which by this document's own rule (§6 step 5) is a bug in the
document. Writing it up turned out to be writing up a fourth instance of the M5-2 / M-4 defect class.

`MonetizationRepository.purchases()` and `.history()` are implemented through to the data source and
were **called by nothing**. `billing_history_screen` showed two tabs where web's page shows four, so a
mobile reader could not see a credit-pack purchase or a single plan change — including the ones the
app's own credit dashboard lets them make.

#### Resolution (2026-08-03) — the two tabs, and the raw wire strings they exposed

Both ledgers are wired to new providers and the screen now shows four tabs. The four share one
`_Ledger` frame, for the same reason web's `LedgerSection` exists: identical states with different row
shapes, and the failure mode is one tab quietly losing its retry or wording its empty state
differently.

**`GET subscription/history` needs no client compensation.** W4-1 fixed the 404 at the endpoint and
deleted web's mapping with it, so a 404 here is a real error and surfaces as one — the provider's doc
comment says so, since absorbing it into an empty list is exactly what would hide a regression.

**The missing labels came with it.** Mobile labelled five of the thirteen monetization enumerations
and let the rest fall through to the wire value — which is why its billing history read `succeeded`
and its credit ledger read `subscription grant` (an underscore-stripped `subscription_grant`). Web's
`monetization-labels.ts` called this out when it was ported _from_ mobile. `InvoiceStatus`,
`PaymentStatus`, `PurchaseKind`, `PurchaseStatus` and `CreditReason` are now mirrored with labels, and
the two existing tabs plus the credit ledger stopped printing raw values. Every label still falls
through to the wire string for an unknown value — these enumerations are open on the wire (varchar
columns, docs/37), so an unrecognised value is a forward-compatible server, not a bug.

`SubscriptionEvent.type` is deliberately **not** mapped: the wire types it as a plain `string`, so the
set the server emits is not something the contract pins down and a switch would be inventing one.

### M-5 · **medium** · mobile's suite fails ~2 runs in 10, with no assertion output (opened 2026-08-03, during the parity batch)

**Recorded, not fixed.** Found because the parity batch's own verification kept coming back red on a
test it had not touched, and the register's rule about calling something a flake without evidence
(§3.4, T-7; and the webkit case in `docs/e2e`) says that has to be measured rather than assumed.

`test/features/ai/retrieval_controllers_test.dart` — "RetrievalSessionController.submit commits a
valid query" — fails intermittently in a **full-suite** run only.

**Measured, both ways:**

| Condition                      | Full-suite runs | Failures |
| ------------------------------ | --------------- | -------- |
| With the parity batch applied  | 14              | 2        |
| **With the batch stashed**     | **10**          | **2**    |
| That file alone, batch applied | 12              | 0        |

So it is **pre-existing and unrelated to this batch** — the rate is the same with the changes removed,
and the file never fails on its own. Recorded rather than shrugged at, because a suite that is red one
run in five trains everyone to re-run instead of read.

**The diagnostic detail is the useful part: there is no assertion output at all.** No `TestFailure`,
no `EXCEPTION CAUGHT`, no expectation diff — the reporter goes straight from the test's start line to
`-1`. That is not a wrong value; it is the test's execution being abandoned. The test's own body is
three synchronous `read`s, but its `buildTestContainer` setup does real I/O — `createTemp`,
`Hive.openBox` ×4, connectivity init — and under a fully parallel suite on a loaded machine that is
the thing plausibly hitting the per-test timeout.

**That last paragraph is a hypothesis, not a finding.** It fits the evidence and has not been proven;
whoever picks this up should confirm before changing anything, and the obvious first step is running
the suite with `--reporter expanded` and a raised timeout to see whether the abort is a timeout at
all. **Not** by deleting or `skip`-ing the test.

Audited and clear elsewhere: the frontend has no other money formatter, and `admin/src/lib/format.ts`'s
`formatUsd` takes major units by contract and has **zero callers** (admin has no monetization surface yet).
So this bug was monetization-only, on both platforms.

---

## 3.8 Found while closing the E2E AI-provider gap (2026-08-03)

Opened while building `StubAdapter` — the AI counterpart of W4-4's `ManualAdapter` — so the `af2` row can
assert a generated suggestion ([e2e/06 §6](./e2e/06_PhasePlan.md)). All three are **recorded, not fixed**:
each is outside that row, and two of them are about keeping the AI and payments halves consistent, which
is a decision rather than a repair. Two E2E-harness traps found the same day are recorded where they will
be read — [e2e/06 §6 live-run notes 4 and 5](./e2e/06_PhasePlan.md).

### AI-1 · **low** · `PAYMENTS_MANUAL_ENABLED` is undeclared in `env.schema.ts`, so its typo mode is silent

`backend/src/config/env.schema.ts` declares every other provider knob — all three Stripe values, Apple's,
Google Play's, and each AI credential + base URL — but **not** `PAYMENTS_MANUAL_ENABLED`, which W4 added
only as a `process.env` read in `payments.config.ts`. Two consequences: `PAYMENTS_MANUAL_ENABLED=ture`
boots happily with payments quietly refusing (the schema is the project's fail-fast contract, and it never
sees the var), and a reader auditing what a deployment can turn on cannot find it in the one file that is
supposed to list exactly that.

`AI_STUB_ENABLED` **is** declared, because declaring one's own new var is part of writing it. That leaves
the two intentionally-inert providers described differently in the schema, which is the smaller wrong. Fix
is one line plus a note in `19_DeploymentGuide.md`'s env table; not taken here because the payments module
is not this row's scope.

### AI-2 · **low** · a stack running an inert AI provider reports its AI as `inert`, which understates it

`AiHealthIndicator` computes `configured` from `config.providers[defaultProvider].apiKey`, so with
`AI_DEFAULT_PROVIDER=stub` + `AI_STUB_ENABLED=true` — an AI subsystem that answers completions and streams
all day — `/health` reports `configured: false, mode: 'inert'`. Verified on the live local stack.

**`PaymentHealthIndicator` has exactly the same blind spot** (it reports stripe/apple/google and ignores
`manual` entirely), so the stub was left alone deliberately: a one-sided fix would make the two indicators
disagree about what "inert" means, and the useful change is teaching both that a flag-gated provider counts
as configured — with `mode` distinguishing a _test_ provider from a live one, since a readiness probe that
says "live" because a stub is on would be worse than the current understatement. That is a P7.1/P7.4
observability decision, not an E2E one.

### AI-3 · **low** · `IMPLEMENTED_AI_PROVIDERS` and `IMPLEMENTED_PAYMENT_PROVIDERS` are dead exports

Both are declared in `@qalam/shared` and have **zero consumers** anywhere — backend, frontend, admin, e2e
(grepped). They read like a gate ("which providers have a working implementation") and gate nothing; the
live answers are `ProviderRegistryService.implementedProviders()` / `configuredProviders()`, computed from
what is actually registered.

This mattered while deciding where `AiProvider.Stub` belongs. It was kept **out** of the list, mirroring
`PaymentProvider.Manual`'s absence from the payments one — a consistent choice, but consistency with a
constant nobody reads is a weak reason for anything. Either give both lists a consumer or delete them;
leaving two exported enumerations that look authoritative and are not is how a future adapter gets
registered in one place and forgotten in the other.

**And there is a live consumer that should be reading it.** `admin/src/features/ai/pages/ai-config-page.tsx`
builds its org-default provider dropdown from `Object.values(AiProvider)`, and its Zod schema accepts the
same raw enum — so the picker already offers the **five** extension-point providers that have no adapter
(`azure_openai`, `ollama`, `openrouter`, `lm_studio`, `self_hosted`), and now `stub` as a sixth. Choosing any
of them sets an org default whose every completion answers `AI_PROVIDER_NOT_CONFIGURED`.

**The bound worth stating: `stub` is no more dangerous there than the five that preceded it.** Selecting it
on a real deployment produces refusals, not canned prose, because the adapter's own gate (`AI_STUB_ENABLED`)
is what decides whether it serves — an admin cannot switch it on from the UI. Still, the picker should offer
what the registry reports as configured (`GET /admin/ai/providers`-shaped data) rather than the vocabulary,
and that is the fix that would make `IMPLEMENTED_AI_PROVIDERS` earn its existence. Not taken here: admin is
the deferred client in this epic ([45 §5](./45_WebClientRoadmap.md)), and the picker's behaviour predates
this row by five entries.

---

## 3.9 W5 pre-flight — the AF4 contract audit (2026-08-03)

Opened by W5's step-0 audit (**before** any web code): read all nine `/ai/*` retrieval routes against
their DTOs, then diff mobile's AF4 client against both. The register's rule is that the platform being
ported from must actually contain what the roadmap row claims ([§6](#6-parity-check--run-at-the-end-of-every-client-epic)),
and this time it half does. **Two of the four findings change what W5 can deliver**, so they are recorded
here before implementation rather than discovered mid-epic.

Contract as it actually stands (file:line):

| Route                             | Where                               | Gate                                    | Notes                                                    |
| --------------------------------- | ----------------------------------- | --------------------------------------- | -------------------------------------------------------- |
| `POST /ai/search`                 | `semantic-search.controller.ts:50`  | `ai.use` + `feature.ai.semanticSearch`  | Library scope (no `storyId`) needs no graph              |
| `GET /ai/search/suggestions`      | `semantic-search.controller.ts:67`  | same                                    | Top-8 result titles, no LLM                              |
| `GET /ai/search/saved`            | `semantic-search.controller.ts:79`  | `ai.use`                                | Owner-scoped list                                        |
| `POST /ai/search/saved`           | `semantic-search.controller.ts:88`  | `ai.use`                                | Idempotent by name; cap 50 (`SAVED_SEARCH_MAX_PER_USER`) |
| `DELETE /ai/search/saved/:id`     | `semantic-search.controller.ts:102` | `ai.use`                                | 204                                                      |
| `GET /ai/recommendations`         | `recommendation.controller.ts:26`   | `ai.use` + `feature.ai.recommendations` | 11 kinds; `collections` returns empty by design          |
| `POST /ai/ask`                    | `ask-book.controller.ts:29`         | `ai.use` + `feature.ai.askBook`         | **Owned story + built AF3 graph** (see W5-4)             |
| `POST /ai/ask/stream`             | `ask-book.controller.ts:45`         | same                                    | `sources` → `start` → `delta`* → `done` \| `error`       |
| `GET /ai/explorer/:storyId/:view` | `story-explorer.controller.ts:26`   | `ai.use`                                | Graph-only, no LLM — **AF3/W6 territory, not W5's row**  |

### W5-1 · **high** · `@qalam/api-types` declares a search filter shape the DTO rejects outright

`packages/api-types/src/retrieval.ts:114` declares:

```ts
filters?: { language?: string; genre?: string; tags?: string[] };
```

`SemanticSearchDto` has no `filters` property at all — it takes them **flat**, and `tags` as a
**comma-separated string** (`retrieval-request.dto.ts:59-75`). The global pipe runs
`forbidNonWhitelisted: true` (`backend/src/main.ts:170`), so a client that trusts the wire package does not
get its filters silently ignored — it gets **400 `VALIDATION_FAILED`** on the whole search.

**Mobile is the correct reference here, and api-types is the liar:**
`lib/features/ai/domain/value_objects/retrieval_requests.dart:31-40` sends `language`/`genre` flat and
`'tags': tags!.join(',')`. Third instance of the same class as W4-2 and W4-5 — a handwritten wire package
drifting from the DTO it mirrors. **This is FIX-THEN-PORT: api-types must be corrected before the web API
layer is written**, or W5 ships a search whose filter path 400s.

> **Closed 2026-08-03** (the flat shape, before the web API layer was written). The _class_ — W4-2 + W4-5 +
> this — is closed by a guard as of 2026-08-05: [§3.11](#311-w4-2--w4-5--w5-1--class-closed-2026-08-05--qalamapi-types-drifting-from-the-dtos).

### W5-2 · ~~**medium**~~ · ✅ **CLOSED (backend + web + mobile)** · backend/web 2026-08-04 during W5, mobile 2026-08-07 · `pieceId` was documented on both sides of the wire and read by nothing

`RecommendationQueryDto.pieceId` (`retrieval-request.dto.ts:125`) and `RecommendationRequest.pieceId`
(`api-types/src/retrieval.ts:206`) both document "seed piece for related-stories / related-chapters".
As found (2026-08-03), `grep -rn pieceId backend/src/modules/retrieval/` returned **exactly one hit —
the DTO declaration**. `RecommendationService.byKind` read `dto.kind` and `dto.storyId` only, so
`related_stories` with a `pieceId` and no `storyId` took the fallback: `trending.getFeed()` — literally
reasoned as "Popular right now".

**Fixed the next day, inside W5 itself, not as a separate decision.** `relatedToPiece`
(`recommendation.service.ts`, commit `acdd2e1`) now derives terms from the seed piece's tags + title
(read through `PiecesService.getById` **as the caller**, so visibility rules apply) and runs them
through `SearchService` with `recordHistory: false` (so machine-composed terms never pollute the
reader's own search history — a second defect, W5-5, closed the same way). Web's reader consumes it via
`useRelatedPieces` (`frontend/src/features/reading/hooks/use-related-pieces.ts`, commit `3919c7a`):
recommender first for a signed-in reader with `ai.recommendations` on, tag search as the fallback
otherwise or if the recommender comes back empty. **The register was never updated when this landed —
confirmed live in the code 2026-08-07, not from this text.**

**Mobile ported the same day it was found (2026-08-07), closing the row.** Mobile's reader "More like
this" (W-1's port, `lib/features/reading/presentation/widgets/related_pieces.dart` +
`related_pieces_controller.dart`) had called the plain tag search only, never adopting the recommender
web uses as its primary source. Mobile's _unrelated_ AI discovery screen (`ai_discovery_screen.dart:105`)
already called `RelatedStories`, but passed `pieceId: null` there, which is correct for that screen (it
has no piece context) and was not the fix — the fix was wiring the **reader's** related-pieces widget the
way web's `useRelatedPieces` does.

`relatedSuggestionsProvider` now tries the recommender first (`kind=related_stories&pieceId=<piece>`) for
a signed-in reader on a build with AI on and `feature.ai.recommendations` enabled, falling back to the
original tag search when the recommender is unusable, empty, or errors — the two sources are never
queried in parallel. A recommended item's `reason` renders under the title/author line; the tag-search
fallback has none, matching web exactly (`related_pieces.dart`). `qalam-mobile` commit `ef40cdf`.

Ported as a **synchronous** combinator over each upstream provider's `AsyncValue` rather than an async
function chaining `.future` awaits, after the port surfaced two real defects along the way (neither
specific to this feature — both are latent in any Riverpod provider here that watches another one
reactively across an error):

- A transient auth race: reading the session controller's raw `AsyncValue` synchronously treats "still
  loading" as "signed out," which could fire the tag search for a reader a heartbeat from resolving to
  authenticated — a real, if brief, parallel-query window.
- Riverpod 3's default retry policy re-attempts a thrown `Failure` (it isn't a Dart `Error`, the one type
  the policy exempts) for up to ~30s of exponential backoff, and represents each retry as `AsyncLoading`
  that still carries the last error. Naively treating "loading" as "wait" would leave the section empty
  for half a minute on a real failure instead of degrading immediately.

Covered by `test/features/reading/related_pieces_recommender_test.dart` (recommender success with reason,
empty/error fallback, no-tag-and-unusable renders nothing, signed-out uses tag search only) plus the
pre-existing `related_pieces_test.dart`, unchanged.

### W5-3 · ~~**medium**~~ · **CLOSED 2026-08-05** · mobile's Story Explorer has no entry point, and Ask My Book is reachable only through it

`app_router.dart:494` registers `/ai/explorer/:storyId`; **no `push`/`go` site for it exists anywhere in
`lib/`** (grepped). `AskBookScreen` is pushed from exactly one place —
`story_explorer_screen.dart:57` — i.e. from the screen nobody can reach. The reachable AF4 chain is
`editor_screen.dart:423` → AI conversations → `ai_discovery_screen.dart:50` → semantic search; explorer and
ask sit outside it.

This is the AF6 shape repeating (`qalam-mobile/docs/56_MobileAF5AF6ContractAudit.md`):
code that compiles, has tests, and cannot be opened by a user. Consequence for W5: **Ask My Book has never
been exercised by any client on any platform**, so the web cannot port it — it would be
BUILD-FROM-CONTRACT against an unverified reference, which is a different (larger) task than the row's "an
upgrade of the existing surfaces rather than a new one".

#### Resolution (2026-08-05) — two entries in the menu the class already taught us to use

Both surfaces now open from the **editor overflow menu**
(`editor_screen.dart`), which is where the IA already puts every story-scoped AI and
collaboration surface — no new navigation pattern, and the same menu R-1's fix used. Placement was
forced rather than chosen: both routes take the **server piece id** and are owner-scoped server-side, so
they need `st.draft.isRemote` exactly like the AF6 group, and the editor is the only place a user is
holding one of their own stories.

**The two gates differ, deliberately.** `GET /ai/explorer/:storyId/:view` is `ai.use` only
(`story-explorer.controller.ts`) and renders straight from the AF3 graph with no LLM; `POST /ai/ask`
additionally requires `feature.ai.askBook`. Gating the explorer behind `askBook` would have hidden a
surface the server would happily serve — the mirror image of the defect being fixed, so the entries
mirror the routes instead of sharing one flag.

`test/features/ai/af4_entry_points_test.dart` (7 tests) asserts **reachability, not registration** —
the distinction R-1 and M5-1 both missed. The router in the test serves the real `StoryExplorerScreen`
and `AskBookScreen` rather than stub targets, so a tap has to survive the whole push; it checks the id
handed over is the `remoteId` (a local route id would 404 the endpoint's `ParseUUIDPipe`), that the
Explorer → Ask hop still works, and that each gate hides the right entry. **Verified by disabling the
menu entries: the four reachability tests go red while the `namedLocation` test stays green** — which is
precisely why route registration was never evidence of anything.

**Parity consequence — does web now need the same two surfaces?**

- **Story Explorer: no, not on W5's row.** It stays **OUT OF ROW** per the verdict table above — it is an
  AF3 graph surface and **W6 owns it** (45 §4). Mobile having an entry point does not move the row; it
  removes the excuse that mobile's explorer was unreachable when W6 comes to port it.
- **Ask My Book: still BUILD-FROM-CONTRACT for web.** A reachable entry point is not an exercised
  feature. What now exists is a user-openable path to the screen, proven by widget tests against a fake
  repository — **no client has yet put a real question through `POST /ai/ask` against a real graph and
  read the answer**, because W5-4 still holds: no client builds graphs, AF3's analyses are the producer,
  and W6 is held. So the W5 decision stands unchanged (Ask deferred to W6), and when web does build it,
  it builds from the DTO contract, not from a mobile reference — mobile is a reference for the
  _navigation_, not for the _behaviour_.

### W5-4 · context, not a defect · story-scoped retrieval needs an owned story AND a built graph

`GraphRetriever.retrieve` returns `[]` unless `storyId` is present, then reads the SSOT through the
owner-scoped `getGraphSnapshot` (`graph.retriever.ts:46-50`) — a foreign or missing story propagates
`STORY_NOT_FOUND` by design, and an empty graph yields zero candidates. Ask then still calls the LLM with an
**empty context**, so the honest outcome on a graph-less stack is an answer with **zero citations** rather
than an error.

No client builds graphs: AF3's analyses are the producer and **W6 is held** (45 §4). So on the web today,
Ask can only ever answer about the reader's _own_ piece, ungrounded. That is a product-shaped limit, not a
bug — recorded so the W5 decision is made with it in view rather than discovered after the surface ships.

**Verdict table for the row (audit output):**

| Surface                                   | Verdict                   | Why                                                                 |
| ----------------------------------------- | ------------------------- | ------------------------------------------------------------------- |
| Semantic search (library) + suggestions   | **PORTABLE**              | Mobile's client matches the DTO field-for-field; no graph needed    |
| Saved searches                            | **PORTABLE**              | Plain owner-scoped CRUD, cap enforced server-side                   |
| Retrieval-backed discover (library kinds) | **PORTABLE**              | `trending`/`feed`/`authors`/`genres`/`related_topics` need no graph |
| Search filters (language/genre/tags)      | **FIX-THEN-PORT**         | W5-1 — correct api-types first                                      |
| Reader "more like this" → recommender     | ~~BLOCKED~~ ✅ **CLOSED** | W5-2 — enabler built 2026-08-04, both clients ported by 2026-08-07  |
| Ask My Book                               | **BUILD-FROM-CONTRACT**   | W5-3 (no verified reference) + W5-4 (no graph producer)             |
| Story Explorer                            | **OUT OF ROW**            | AF3 surface; W6 owns it                                             |

> **Superseded on the last two rows — kept as the record of what W5 decided, not as current fact.**
> "W6 owns it" was corrected on 2026-08-05 ([45 §4.8](./45_WebClientRoadmap.md)): both are AF4
> consumers of an existing graph, not the held analysis lifecycle. Both were then built by **W9**
> (2026-08-08) — audit in [§3.13](#313-w9-pre-flight--the-af4-story-consumer-contract-audit-2026-08-08),
> sweep in [§6.2](#62-w9s-sweep-2026-08-08). W5-3 (mobile's missing entry point) closed 2026-08-05, which
> is what made "no verified reference" stop being true.

**Decisions taken (2026-08-03), so the row is unambiguous:**

- **W5-2 → build the enabler.** `pieceId` is implemented for `related_stories`, which is what makes the
  reader upgrade honest. `related_chapters` stays graph-scoped (`storyId` only) and both sides of the wire
  now say so, instead of advertising a seed the service ignores.
- **Ask My Book → deferred to W6**, where AF3's graph client makes it demonstrable. W5 stays what its row
  says: an upgrade of the existing discover/search surfaces. The E2E ask-book streaming assertion travels
  with it (it is now buildable at any time — the inert AI adapter landed in §3.8 — so what is missing is a
  graph, not a provider).

### W5-5 · ~~**medium**~~ · **CLOSED 2026-08-03** · the recommender wrote machine-composed queries into the reader's search history

Found while implementing W5-2, and it is the reason the enabler is not simply "reuse `searchPieces` exactly
as the `storyId` branch does". `SearchService.searchPieces` records every query it runs
(`search.service.ts` → `record()` → `history.recordKeyword` + `history.upsertRecent`), and the AF4
recommender's query is **not a query the user typed** — it is terms derived from a story graph or, now, from
a seed piece.

So the graph branch was already putting strings like `Aria mentor castle` into the caller's **recent
searches** and into the **global keyword trends that feed discovery**. Shipping the piece-seeded branch on
top would have multiplied that by every reader page view of every signed-in reader — a small pollution
becoming a large one.

**Fixed at the source rather than worked around:** `searchPieces` takes an internal
`options.recordHistory` (default unchanged — a user-typed query still records), and the recommender passes
`false` on **both** related-stories paths. This is an internal service signature, not an HTTP contract, so
nothing on the wire moves. Asserted in `search.service.spec.ts` (records nothing when opted out, still
returns results) and in `recommendation.service.spec.ts` (the recommender opts out).

**Not fixed, and deliberately:** `KeywordRetriever` still records, because there the query IS the user's own
search text — recording it is the feature, not a bug.

### W5-6 · ~~**high**~~ · **CLOSED 2026-08-04** · a signed-out reader's piece page never rendered, because W5 put an authenticated read on it

**Found by the W5 Phase-3 browser run, on tests that predate W5** — every anonymous `reader.spec.ts` case
went red, and the screenshot showed the reading page stuck in its skeleton with the piece read having
already succeeded.

W5 moved the AI gate to an app-level hook (`frontend/src/hooks/use-ai-availability.ts`) so three features
could share one cached read, and `useRelatedPieces` calls it unconditionally — hooks cannot be conditional.
Both of its endpoints require a session. So a public reading page began issuing `GET /ai/features` and
`GET /ai/usage/me` for visitors who have none, and **a 401 outside `/auth/*` is terminal to the api
client**: one silent `/auth/refresh` (401 again — there is no cookie), then `onUnauthorized()`, which calls
`expireSession()` **and `queryClient.clear()`** (`app/providers.tsx:44`). The cleared cache took the piece
with it, and the reader sat in a skeleton indefinitely.

Measured in one run of the backend log: **35 anonymous 401s on `/ai/features`, 35 on `/ai/usage/me`, 26
failed refreshes.** The same defect was live on `/search?mode=ai`, which is also public.

**Fixed at the gate, not at the consumers:** the hook resolves `signed-out` and issues **no request** when
the session is not authenticated. `signed-out` is a new `AiAvailability` state (it could not be `unknown`,
which renders a skeleton, nor `off`, which claims the instance has AI disabled), with copy — "Sign in to use
AI search. Keyword search works without signing in." — and the only action that resolves it, a sign-in
button carrying the full search URL as `returnTo`. Every AF4 read is already gated on
`availability === 'available'`, so one change closes all of them.

Covered by `src/hooks/use-ai-availability.spec.tsx` (asserting `get` is **never called** without a session,
which is the property that matters) and by `ai-search.spec.ts`'s two signed-out E2E tests.

### W5-7 · ~~**medium**~~ · **CLOSED 2026-08-04** · re-running a saved search silently used the wrong engine

`SearchPage.runSavedQuery` called `params.setMode('ai')` then `params.setQuery(query)`. Both patch the URL
through a functional `setSearchParams`, and within one handler both receive the **same** pre-navigation
snapshot — React has not re-rendered in between — so the second write dropped `mode=ai`. A saved AF4 search
therefore re-ran in **keyword** mode: the reader's saved question answered by a different engine and called
the same search, which is precisely what the "saved searches switch engine" rule exists to prevent.

Fixed with a single `setSearch(q, mode)` on `useSearchQueryParams` (one `update`, both keys). Three specs in
`use-search-query-params.spec.tsx` cover it, including one that documents the two-setter shape as the hazard
it is. **Invisible to a unit test that stubs the router** — it took a browser.

### W5-8 · ~~**medium**~~ · **CLOSED 2026-08-04** · "Explain these results" produced no answer, because the cached retrieval plan outranked the request

Also from the Phase-3 run. `SemanticSearchService.search` gated synthesis on `result.plan.synthesize`, and
the plan travels **inside the cached `RetrievalResult`** whose key (`RetrievalCacheService.key`) does not
include `synthesize` — correctly, since the retrieval half is identical either way. So for 120 s
(`RETRIEVAL_CACHE_TTL_SECONDS`) whichever value arrived first won: a reader who loaded results and _then_
pressed "Explain these results" hit their own cached plan saying "no synthesis" and got **no answer, no
error, and a toggle showing on**.

Reproduced over the wire (same query, seconds apart, on the existing database):

```
1st call, synthesize omitted   → answer: null
2nd call, synthesize:true      → answer: null      ← the defect
1st call WITH synthesize:true  → answer: "This paragraph came from the stub AI provider…"
```

**Fixed by asking the config, not the cached plan:** `plan.synthesize` is
`config.synthesisEnabled && request.synthesize === true`, so the only thing it carried beyond the request is
the admin switch — read directly from `RetrievalConfigService` (Redis-cached, so it costs nothing the plan
was saving). Two specs added: synthesis on a request whose cached plan says no, and the admin switch still
refusing. No new cache entries, and a request-scoped decision no longer rides in a shared cached object.

### W5-11 · ~~**medium**~~ · **CLOSED 2026-08-04** · in AI mode the filter bar was either absent or offering controls the engine ignores

**Found by this register's own §6 sweep**, not by a test — step 1 asks whether the epic delivered what its
row named, and W5's row named filters that carry over between engines.

`SearchFilterBar` returned `null` unless `type` was `pieces` or `writers`. AI mode deliberately has **no
scope tabs** (AF4 answers mixed entity types), so `type` sat at its `all` default and the bar rendered
**nothing at all** — the `language` / `genre` mapping W5 built, and that W5-1 corrected `api-types` for, was
unreachable on a normal AI search. The mirror image was also live: a reader who filtered on the Pieces tab
and then switched engines kept `type=pieces` in the URL and got **reading time, publish date and sort**,
none of which `SemanticSearchDto` accepts — three controls that silently did nothing, which is the exact
objection the code uses to justify hiding the scope tabs in AI mode, applied inconsistently one component
over.

**Fixed as one gate:** the bar renders for the AI engine on its own terms (no tab required) and offers only
what that engine accepts. Two unit specs (`search-filter-bar.spec.tsx`) and one E2E assertion
(`expectAiFiltersOffered`) pin both halves.

### W5-12 · harness (pre-existing) · three visual baselines do not reproduce outside CI

Recorded because [§6](#6-parity-check--run-at-the-end-of-every-client-epic) step 5 admits no unrecorded
known difference, and because the next epic to run the visual suite locally will meet it.

`frontend-comments` (both themes, 3 of 3 runs), `frontend-suggestions` (dark 3 of 3, chromium 1 of 3) and
`frontend-collaborators` (chromium 2 of 3) fail in the pinned image on a developer host while the other 13
frontend baselines match byte-for-byte in both themes. The diff shows the **entire page offset by ~21px** —
every text row rendered twice in the diff, one above the other — with the masked list bands differing top
and bottom as a consequence. That is the drift `visual.spec.ts` already documents for pages sitting
marginally past the 720px fold, and the reason those three use viewport capture rather than `fullPage`;
viewport reduced it without eliminating it.

**Flaky, not drifted:** the failing subset changes between runs of the same commit, whereas a code change
would fail the same shot every time. **Not W5's**, and not fixed here — all three are W3 surfaces, and the
fix belongs to capture stability ([e2e/10 §2.2](./e2e/10_UIQuality.md)). The cost is coverage honesty: a
local visual run verifies 13 of 16, and CI's `web-e2e-visual` job is the authority for the rest.

### W5-9 · harness · the E2E suite could not hold two spec files to one opinion about a global flag

Not a product defect; recorded because the fix is now load-bearing for four spec files. The AI feature flags
are single global rows and the suite is `fullyParallel`; `assistant.spec.ts` asserted them DOWN while W5's
three surfaces raise them from other files, which no `describe.serial` can order.

`e2e/fixtures/feature-flags.ts` adds a cross-worker mutex (an atomic lock **directory** under
`e2e/.stack/`, stale-broken after 3 min) with two entry points — `withAiFeatures` (raise + restore) and
`withAiFlags` (assert the dark state, or screenshot a flag-dependent baseline). Three properties were forced
by what the live run did:

1. **The restore runs on its own `APIRequestContext`,** not the test's `api` fixture. The first run's
   AI-search test exceeded the 30 s default timeout, Playwright tore its context down, and the `finally`
   failed with "Target page, context or browser has been closed" — leaving the master flag raised, which
   then failed every flag-down assertion in the run for a reason unrelated to the code under test.
2. **Lock-taking tests carry `AI_FLAG_TEST_TIMEOUT_MS`,** because the queue wait is spent inside the test:
   a test parked on the lock burns its own budget and would fail as a timeout without running an assertion.
3. **The two flag-dependent visual baselines take the lock too** (`frontend-ai-panel`,
   `frontend-search-ai-off`). Both encode the flag-DOWN surface, which [e2e/06 §6] note (a) already flagged
   as a local hazard; W5 raised the number of flag-raising tests from one to four, so "rare race" became
   "likely".

### W5-10 · harness · two flakes the W5 specs introduced, both fixed by asserting something truer

Recorded because each is a pattern, not a one-off:

- **A modal closed after an axe scan never disappears.** `fixtures/a11y.ts` injects
  `animation-duration: 0s` and rc-motion removes an exiting element on `animationend`, which a
  zero-duration animation does not fire — the save dialog stayed in `ant-zoom-leave-active` for 30 s
  (62 polls). The a11y spec now scans the dialog **open** and dismisses it by navigating; the rule is
  documented on `expectNoSeriousA11yViolations` itself. The save flow also waits for the `POST` response
  before the dialog assertion, so a slow write no longer reads as "the dialog did not close".
- **Asserting the ranker's output is not asserting the feature.** The reader's recommender test demanded
  its own sibling piece among the top four, but the piece-seeded branch ranks by relevance over the whole
  corpus — thousands of E2E pieces sharing title tokens on a long-lived database — so it failed about one
  run in six while the feature worked perfectly (the reason line named the right seed and tag every time).
  It now asserts the **source**: at least one suggestion, and not one of them unexplained.

---

## 3.11 W4-2 / W4-5 / W5-1 — **CLASS CLOSED 2026-08-05** — `@qalam/api-types` drifting from the DTOs

Three separate findings, one defect. Each was closed on its own; nothing stopped a fourth, and a fourth
was already sitting there (see "what it found on its first run" below).

|                                                                                                                          | drift                                                                                                                                    | how it failed                                        | closed     |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------- |
| [W4-2](#w4-2--medium--closed-2026-07-29--qalamapi-types-declares-the-wrong-shape-for-purchasesrestore)                   | `RestorePurchasesResponse` declared `{restored, subscription, creditsGranted}`; the handler returns `{restored, providerRef, expiresAt}` | two fields read `undefined`, a third invisible       | 2026-07-29 |
| [W4-5](#w4-5--medium--closed-2026-07-29--qalamapi-types-declares-a-couponcode-on-changeplanrequest-that-the-dto-rejects) | `ChangePlanRequest` declared `couponCode`; `ChangePlanDto` has no such property                                                          | **400 `VALIDATION_FAILED` on every plan change**     | 2026-07-29 |
| [W5-1](#w5-1--high--qalamapi-types-declares-a-search-filter-shape-the-dto-rejects-outright)                              | `SemanticSearchRequest` declared a nested `filters` object; the DTO takes them flat with `tags` comma-separated                          | **400 `VALIDATION_FAILED` on every filtered search** | 2026-08-03 |

**Why it kept happening.** The package is handwritten — its own `generate` script still exits 1
(`"openapi.json not yet emitted by backend (Phase 1)"`) — while the DTOs are the SSOT. Nothing connected
the two, in either direction, at any point in CI. Two of the three are 400s rather than type errors
because `main.ts` runs `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`: an undeclared
key is not dropped, it rejects the whole request. And because this is a _package_, every consumer
inherits the break — the same mistake made inside one client ships one broken button (mobile's M-1);
made here it ships one to everyone who installs it.

### The guard

**`backend/src/common/contract/api-types.contract.spec.ts`** — 71 assertions, runs in the normal backend
unit suite, no fixtures and no running stack.

Survey that chose the shape: the package exports **85** types of its own; **67** mirror a backend DTO
(18 requests, 49 responses) and **18** do not. (The backend has 337 DTO classes in total — `api-types`
deliberately covers only the Phase-2 surfaces AF1/AF3/AF4/AF5, so most of them have no mirror and are not
this package's business.) 18 + 49 request/response pairs + 4 meta-assertions = the 71.

Two mechanisms, because the two directions fail differently:

1. **Requests → class-validator metadata.** A key survives `whitelist: true` only if the DTO property
   carries a validation decorator. `@ApiProperty()` alone does **not** count — precisely the trap, since
   a field can look documented and still 400.
2. **Responses → Swagger `@ApiProperty` metadata** (walking the prototype chain, so inherited DTO
   properties count). A wrong response type does not throw; it reads `undefined`.

Both compare **both directions**. A key the package has and the DTO does not is the breaking drift; a key
the DTO has and the package does not is a shipped capability no typed client can reach — which is how
`CreateSubscriptionRequest.region` went missing during W4-2's sweep.

**Why it cannot go stale.** The declared keys are parsed out of the package's own source, not restated
in the test — the technique `e2e/tests/frontend/a11y.spec.ts` already uses to read `QTag`'s colour map out
of `q-tag.tsx`. And `MIRRORS` ∪ `UNMIRRORED` must account for **every** export in the package, with each
unmirrored one carrying a written reason ("there is no DTO" being exactly the excuse that let
`RestorePurchasesResponse` stay orphaned through W4-2). A new interface fails the suite until it is
paired or exempted. That completeness check is the part that stops instance four; the pairs only close
the first three.

**Verified by reintroducing each historical shape, one at a time** — not by reasoning about it:

| reintroduced                                      | result                                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| W4-2's `{restored, subscription, creditsGranted}` | 1 failed / 70 passed — named `subscription`, `creditsGranted` as never-sent and `providerRef`, `expiresAt` as hidden |
| W4-5's `couponCode` on `ChangePlanRequest`        | 2 failed / 69 passed — named `couponCode` as rejected                                                                |
| W5-1's nested `filters`                           | 1 failed / 70 passed — named `filters` as rejected and `language`, `genre`, `tags` as hidden                         |

`monetization-contract.spec.ts` is reduced to the one assertion the package-wide guard cannot make: a
compile-time pin of `RestorePurchasesResponse` to `MonetizationController['restore']`'s **own return
type**. That closes W4-2's triangle — the Swagger DTO is only what the route _claims_ to return, and in
W4-2 the DTO was wrong too (orphaned, carried by no `@ApiOkResponse`, agreeing with the package while
both disagreed with the code). Its six hand-listed request pairs are gone; that list was itself a
staleness mechanism.

### What it found on its first run

**`AiCompletionRequest` was missing `jsonMode`.** `AiCompletionRequestDto.jsonMode` has been accepted
since AF1 and runs the whole way through — `ai.controller.ts:202` → `ai-completion.service.ts:292` → the
OpenAI-compatible, Gemini and stub adapters, which reject it with a clear error when the model lacks
`supportsJsonMode`. Only the wire package never mentioned it, so no typed client could reach a shipped
capability. Same direction as `region`: invisible rather than breaking, same root cause. Added to the
interface (a one-line type change against a backend that already accepts it — no product decision), which
is also what makes the guard green rather than red-on-arrival.

### Not covered, on purpose

- **The five AF4 grounding blocks** (`RetrievalEvidence`, `RelatedEntity`, `NavigationTarget`,
  `RankingExplanation`, `AskCitation`) and the **AF3 `*Data` payloads**. Response DTOs carry these as
  `@ApiProperty({ type: Object })` / `Record<string, unknown>`, so Swagger records the containing property
  and not their fields. The backend counterparts live in `retrieval.types.ts` — real mirrors, but of an
  interface rather than a DTO, which would need a third (source-to-source) mechanism. Each is exempted
  by name with this reason.
- **Types, formats and optionality.** The guard compares key sets, which is what all three instances
  drifted on. A field that exists on both sides with the wrong type still passes.
- **Generating the package from the backend.** That is the real fix and it is a bigger change than a
  guard — it needs its own row, not a smuggled-in rewrite. The guard is what holds the line until then.

---

## 3.12 W8 pre-flight — the AF1/AF2 conversation + usage contract audit (2026-08-05)

The audit [docs/45 §4.4](./45_WebClientRoadmap.md) requires before a client line is written. AF5 and AF6
were audited in §3.6 / §3.2, AF4 in §3.9; the **conversation and usage** shapes had never been. Every
finding below is read off the code cited, not from `docs/47` and not from memory.

**The contract, as the routes actually publish it** (all under `AiConversationsController`,
`backend/src/modules/ai/controllers/ai-conversations.controller.ts`, all `@Permissions(PERMISSIONS.AiUse)`,
all wrapped by `TransformInterceptor` → `{success, data}` unless the handler already returns an envelope):

| Route                              | Line                     | Wire shape                                                                                       |
| ---------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| `POST /ai/conversations`           | `:50-61`                 | body `CreateAiConversationDto{feature*, title?}` → `data: AiConversationSummaryDto`              |
| `GET /ai/conversations`            | `:63-75`                 | query `{cursor?, limit? 1..50}` → `data: Summary[]`, `meta.pagination{limit,hasMore,nextCursor}` |
| `GET /ai/conversations/:id`        | `:77-88`                 | → `data: AiConversationDetailDto` (= Summary + `messages: AiMessageDto[]`)                       |
| `PATCH /ai/conversations/:id`      | `:90-108`                | body `UpdateAiConversationDto{title?, status?}` → `data: AiConversationSummaryDto`               |
| `DELETE /ai/conversations/:id`     | `:110-121`               | **204, no body**                                                                                 |
| `GET /ai/conversations/:id/export` | `:123-133`               | → `data:` the ad-hoc object built at `conversation.service.ts:127-140`                           |
| `GET /ai/usage/me`                 | `ai.controller.ts:88-94` | → `data: AiUsageResponseDto` (`ai-response.dto.ts:158-163`)                                      |

`AiConversationSummaryDto` = `ai-response.dto.ts:113-121`; `AiMessageDto` = `:104-110`;
`AiUsageWindowSummaryDto` = `:140-148`. The list envelope is hand-built in the handler (`:70-74`), which is
why it passes `TransformInterceptor` untouched (`transform.interceptor.ts:38-40`).

**Mobile's client is a faithful mirror of all seven.** `ai_remote_data_source.dart:73-134` names the same
seven paths (`api_paths.dart:44,47,48,49`); `ai_conversation.dart:92-102` decodes exactly the seven summary
keys; `ai_usage.dart:39-47,70-74,91-106` decodes exactly the seven window keys, the three feature keys and
the four top-level keys. `api_client.dart:387` unwraps `data`, `:392-395` reads `meta.pagination`, and
`:386` returns `null` for 204 — each matching what the corresponding route sends. **No field-level
mismatch exists on either resource.** The defects below are of a different kind: the client is right about
the shapes and wrong about the _behaviour_.

### W8-1 · **medium** · mobile can never create an AI conversation, so all six routes are unreachable in the product

`createConversation` exists in all three mobile layers — `ai_remote_data_source.dart:92-101`,
`ai_repository.dart:44`, `ai_repository_impl.dart:51-56` — and `grep -rn createConversation lib/` returns
**those three lines and nothing else**. No screen, controller, or panel calls it.

Nor does anything else create one. `POST /ai/conversations` (`:50-61` → `conversation.repository.ts:35`) is
the **only** path in the backend that inserts a row: the completion orchestrator explicitly declines to,

```ts
// ai-completion.service.ts:331-341
/** Persist the user turn + assistant reply when this is a conversation. */
private async persist(input: CompletionInput, …) {
  if (input.conversationId === undefined) {
    return null;
  }
```

so a completion sent without a `conversationId` is answered and **not stored**. Mobile's assistant never
supplies one (`grep conversationId lib/features/ai/presentation lib/features/writing` finds it only on
`ai_stream_controller`/`ask_book_controller` as an accepted-and-never-populated parameter, and on
`conversation_detail_controller.dart:46`, which continues a conversation that must already exist).

**Wire-level failure:** none — every request is well-formed. `GET /ai/conversations` returns
`{success:true, data:[], meta:{pagination:{hasMore:false,nextCursor:null}}}` **forever**, so
`ai_conversations_screen` shows its empty state permanently and the detail / rename / archive / delete /
export paths behind it are dead code. Mobile ships the surface and cannot populate it.

Same class as R-1, M5-1 and W5-3 (a built surface with no way in) but one layer deeper: there the
_navigation_ was missing, here the _data_ cannot come into existence.

**Confirmed live** against the month-old local database (1,371 users, oldest `2026-07-07`), as the
seeded writer:

```
GET /api/v1/ai/conversations   → 200  {"success":true,"data":[],"meta":{"pagination":{…}}}
GET /api/v1/ai/usage/me        → 200  …"total":{"requests":68,"totalTokens":24692}…
```

**68 AI requests recorded, and zero conversations in existence.** That is this defect in one line:
the platform has been used, and nothing has ever created the row that would have kept any of it.

> **W8 impact:** the client code is still **PORTABLE** — it is correct, merely unreachable. Web must build
> the create path, which C1 already names, so W8's size does not change. Recorded here as a mobile
> follow-up; **not fixed by W8** (mobile is a separate row).

> **Web had the same disease one layer over, and W8 fixed that half.** Building the create path exposed
> the sharper version of this finding: creating a conversation is not sufficient, because nothing was
> sending `conversationId` on a completion either. Web's list would therefore have filled with rows that
> could never gain a message. W8 added the binding — `/write?conversation=<id>`, opt-in via "Keep history"
> in the assistant panel, and reachable as "Continue in the editor" from a conversation's detail view
> (`frontend/src/features/ai/hooks/use-assistant-conversation.ts`). **Mobile still has neither half**, so
> the mobile row now has two things to port, not one: the create entry point _and_ passing
> `conversationId` from `ai_stream_controller`, which already accepts the parameter and is never given it.

### W8-2 · **medium** · `PATCH status:"archived"` returns 200 and the row comes back on the next refresh

Three places state that archiving hides a conversation:

- `packages/shared/src/ai.ts:175` — `/** Conversation lifecycle (soft-delete tombstone = excluded, never returned). */`
- `ai-conversations.controller.ts:38-41` — the controller docblock
- `conversations_controller.dart:122-125` — `// Archived rows drop out of the default (active) list.`

The query does not:

```ts
// conversation.repository.ts:53-67 — the whole WHERE
.where('c.user_id = :userId', { userId })
.orderBy('c.updated_at', 'DESC')
```

No status predicate. And `ConversationListQueryDto` (`ai-request.dto.ts:236-249`) accepts only `cursor` and
`limit`, so a client **cannot** ask for active-only or archived-only either.

**Wire-level failure:** `PATCH` 200s, `status` really is persisted as `archived`, mobile removes the row
optimistically (`conversations_controller.dart:124`) — and the next `build()` refetches it and shows it
again, still with no visual difference, because the list renders no status. The conversation is neither
hidden nor findable-as-archived. Archiving is a no-op the user is told succeeded.

**Confirmed live**, not inferred from the query:

```
POST  /api/v1/ai/conversations        {"feature":"writing_assistant","title":"W8-2 archive probe"}
PATCH /api/v1/ai/conversations/:id    {"status":"archived"}   → 200, "status":"archived"
GET   /api/v1/ai/conversations        → 200, 1 row:  'W8-2 archive probe' status=archived
```

The archived row comes straight back out of the **default** list.

> **W8 impact:** **archive is not in W8's C1 scope** (list, detail, create, rename, delete, export), so web
> deliberately does not offer it — a client cannot implement it correctly against this query anyway.
> Fixing it needs a status filter on the list, which is a backend change and a different row.

### W8-3 · **low** · the same conversation publishes its messages in two different shapes

`GET /ai/conversations/:id` sends each message via `toMessageDto` (`ai.mappers.ts:11-24`) as
`{id, role, content, usage: {inputTokens, outputTokens, totalTokens} | null, createdAt}`. `GET
/ai/conversations/:id/export` builds its own (`conversation.service.ts:134-139`):

```ts
messages: messages.map((message) => ({
  role: message.role,
  content: message.content,
  totalTokens: message.totalTokens,   // flat, and nullable
  createdAt: message.createdAt.toISOString(),
})),
```

No `id`, and token usage flattened to one nullable number. Mobile never notices because it decodes the
export as opaque `Json` (`ai_remote_data_source.dart:131-135`). Recorded so no client reuses `AiMessageDto`
for the export payload — W8's web layer types the two separately.

### W8-4 · **low** · two conversation shapes sit outside the §3.11 guard

The guard added on 2026-08-05 pins `AiConversationSummary`, `AiConversationDetail`, `AiMessageDto`,
`CreateAiConversationRequest`, `AiUsageWindowSummary` and `AiUsageResponse` to their DTOs
(`api-types.contract.spec.ts:264-272`). It cannot see:

- **the `PATCH` body** — `@qalam/api-types` has no `UpdateAiConversationRequest` at all, so a typed client
  has no type for `{title?, status?}`. Same direction as `CreateSubscriptionRequest.region` and `jsonMode`:
  a shipped capability invisible to every typed consumer, rather than a break.
- **the export payload** — the handler returns `Promise<Record<string, unknown>>`
  (`ai-conversations.controller.ts:131`), so there is no DTO to pin and Swagger records nothing.

Not a drift today. Recorded because both are exactly where a fourth instance would appear.

### W8-5 · **medium** · a hovered `variant="primary"` button is 4.37:1 — W3c-3's colour, on the half nobody pinned

**Found by W8's own a11y scan**, which failed the first time it ran because arranging the page clicked
"New conversation" and left the cursor on it:

```
[serious] color-contrast — Elements must meet minimum color contrast ratio thresholds
  Element has insufficient color contrast of 4.37 (foreground #ffffff, background #ab6846,
  font size 10.5pt (14px), font weight normal). Expected contrast ratio of 4.5:1
```

`#ab6846` is AntD's derived `colorPrimaryHover`, and 4.37:1 is the **exact figure W3c-3 recorded**
(§3.4). That fix pinned `Button: { defaultHoverColor: c.accent }` (`antd-theme.ts:113`) — the _default_
variant's hover **label**. The _primary_ variant's hover **background** derives from the same lightened
seed and was never touched, so white-on-`#ab6846` still fails AA wherever a primary button is hovered.

Why it took until now to surface: a scan only sees it when the pointer happens to rest on a primary
button, and no earlier scan's arrangement ended on one. `subscription-page.tsx:292` renders a solid
danger button, but only for an _active_ subscription — the seeded writer is free, so it is never on
screen when that page is scanned.

**Not fixed here.** It is a shared design-system token, W8's scope lock is the three AI surfaces, and
changing `colorPrimaryHover` affects every primary button in both apps — that needs its own row and its
own baseline re-mint. What W8 did instead: the a11y and visual scans arrange their populated row over
the API (`api.createAiConversationAs`) rather than by clicking, so neither measures an incidental hover.
That is **not** pointer-parking — the suite deliberately removed that workaround (`a11y.spec.ts:176-179`)
and this does not reintroduce it; the button is simply not clicked while arranging. The create flow is
still driven through the real button in `ai-surfaces.spec.ts`.

The likely fix, when it gets a row: pin the primary hover to a _darkened_ accent rather than AntD's
lightened derivation — the same direction, and for the same reason, as W3c-3's note about hovering
toward the ink instead of away from it.

### The prompt library has no wire at all — verified, not assumed

Stated explicitly because "no finding" and "not checked" look identical in a register:

- `grep -in prompt lib/features/ai/data/datasources/ai_remote_data_source.dart` → **0 matches**.
- `grep -in prompt lib/core/network/api_paths.dart` → **0 matches**.
- The only prompt routes in the backend are `GET /admin/ai/prompts`, `GET /admin/ai/prompts/:key/versions`
  and `POST /admin/ai/prompts/:key/preview` (`admin-ai.controller.ts:101,110,119`), each
  `@Permissions(PERMISSIONS.AiManage)` under `@Controller('admin/ai')` (`:35`). They are the **admin
  template registry** — server-side model behaviour — and are not this surface.

Mobile's prompt library is entirely client-side: `prompt_preset.dart` (7 built-in presets at `:89-147`),
`prompt_library_controller.dart` (favourites, custom presets, history), `prompt_library_store.dart`
(on-device persistence, `historyCap = 30`). Its own docblock states the rule it exists to keep — presets
are _saved user messages_, never system prompts. **There is nothing to audit and nothing to build from a
contract; W8's C2 is a pure client-side port** with `localStorage` standing in for Hive.

**One place the port went further than mobile, deliberately.** Mobile's only output is a clipboard write
(`prompt_library_screen.dart:92,116`), and `navigator.clipboard` needs a secure context and can be refused
outright — so a blocked clipboard leaves mobile's prompt library with no way to reach the assistant at all.
Web keeps Copy and adds **Use in assistant**, which hands the instruction to the editor's Ask AI field
directly. Filed here rather than as a defect because it is a genuine platform difference in capability, but
it is a **candidate for the mobile row**: mobile could pass the instruction to `writing_assistant_panel`
the same way instead of via the clipboard.

### Verdicts

| Surface              | Verdict                                                                                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI conversations** | **PORTABLE.** Seven routes, no field mismatch, and web's AF1 data layer already covers five of them. Web must add `PATCH` + export to `ai.api.ts`, and must build the create entry mobile lacks (W8-1). Archive stays out (W8-2).                           |
| **Prompt library**   | **PORTABLE.** No wire, by design. A direct port of the preset shelf + favourites/custom/history.                                                                                                                                                            |
| **AI usage**         | **PORTABLE.** `GET /ai/usage/me` already has an api method and a hook (`use-ai-meta.ts:26-32`) from AF1; every field is traceable to `AiUsageResponseDto` and pinned by §3.11. One open question about _placement_ — see the note in W8's readiness report. |

None of the three verdicts changes W8's size.

---

## 3.13 W9 pre-flight — the AF4 story-consumer contract audit (2026-08-08)

Run before a line of client code, as [§6](#6-parity-check--run-at-the-end-of-every-client-epic) step 2
requires. Subject: `GET /ai/explorer/:storyId/:view` and `POST /ai/ask[/stream]`, checked against the
DTOs, the **service projections**, and the SSE writer — not against the screen list.

**This is the first audit in this register that found nothing wrong with what it checked.** M-1/M-2/M-3
found three broken AF6 surfaces, W4 found two wrong `api-types` shapes, W5 found one that 400'd every
filtered search, W8 found a surface that can never be populated. Here the wire matched the summary
exactly, and — checked rather than assumed, since the §3.11 guard's coverage is deliberately partial —
`ExplorerViewResponse`, `AskBookRequest` and `AskBookResponse` were **already mirrored in
`@qalam/api-types` and already pinned by the guard** (`api-types.contract.spec.ts:294-296`). That is
what the §3.11 guard was built to produce, and it is the first row where it paid out.

**What the audit did change: four projection behaviours no paraphrase states.** Each one would have
produced a plausible-looking wrong client.

| #   | Behaviour                                                                                                                                               | Where                             | What it changed in the port                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **An unknown view is not an error.** `normalizeView` silently returns the whole graph.                                                                  | `story-explorer.service.ts:53-57` | The eight-view set is closed on the **client**; a typo would have rendered a plausible wrong answer, not failed. The api method takes an `ExplorerView`, not a string, and the client's fallback spec is the **map** — the same one the server falls back to. |
| 2   | **`relationships` is not `characters`.** It drops every character with no relationship edge.                                                            | `story-explorer.service.ts:68-80` | Its empty state says "no relationships have been mapped", never "no characters" — a story with a full cast and no mapped relationships is legitimately empty there. Pinned by a test.                                                                         |
| 3   | **`timeline` is server-sorted by `data.order`**; `events` is not. That sort is the _only_ difference between two views that project the same node type. | `story-explorer.service.ts:84-86` | The client never re-sorts, and the view selector **re-reads** rather than filtering a cached graph. Pinned by a test that feeds deliberately non-alphabetical events.                                                                                         |
| 4   | **A typed view's edges are only those with both endpoints inside it.**                                                                                  | `story-explorer.service.ts:87-89` | The node-detail "walk the graph" is view-local. Mobile's sheet walks the same edge set (`story_node_sheet.dart:39-53`), so this is parity, not a limitation to fix.                                                                                           |

**And one gap on the WEB side, which is where the audit's real value landed.** The `AiEditorTarget`
seam carried `selectionText / documentText / title / language / wordCount` and **nothing identifying
the piece** — while both new surfaces are per-story and must stay hidden until the draft has synced
(mobile's `st.draft.isRemote`, `editor_screen.dart:245`). Closed by adding `storyId: string | null` to
the seam. Small, but it is the kind of thing that is discovered as a compile error mid-build and then
solved badly under pressure.

### W9-1 · **medium** · **CLOSED 2026-08-08 (in flight)** · an ask stream that closed without a terminal frame span forever

**What.** `useAskBook` mapped `done` and `error` frames onto terminal states, but a stream that simply
**ended** — a dropped connection mid-answer — left the tab in `streaming`: spinner on the Ask button,
no Try again offered, no way out but closing the drawer and losing the partial answer.

**Why it is worth recording rather than just fixing.** Mobile does not have it, and not by accident:
`AskBookController` settles the status in its subscription's `onDone`
(`ask_book_controller.dart:98-101`) precisely because a Dart stream closing is a first-class event.
The web's `for await` loop has the same closing event and the AF1 assistant never needed to handle it
(a completion with no `done` also produced no partial text worth keeping), so the port inherited a gap
the reference did not have. **The reference being right is not the same as the port being right**, and
this is the second row where a for-await translation of a Dart subscription lost a terminal case.

**Fixed** by settling to `done` on loop exit when the status is still `streaming`, keeping whatever
arrived. Pinned by `ask-book-tab.spec.tsx` — "settles a stream that closes without a terminal frame
instead of spinning forever".

### Verdicts

| Surface            | Verdict                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Story Explorer** | **PORTABLE, and cheaper than the row estimated.** One `GET`, eight views, no LLM, no feature flag, wire types already mirrored and pinned. The only real work was reading the four projections correctly.                      |
| **Ask My Book**    | **PORTABLE.** The SSE transport is reused wholesale; the only AF4-specific handling is one extra leading `sources` frame. Its wire event needed a type (`AskBookStreamEvent`, added to `api-types` and exempted in the guard). |

---

## 3.14 Found while running W7a's browser suite (2026-08-10)

### B4-1 · ~~**high (harness)**~~ · **CLOSED 2026-08-10** · B4's piece cap made the browser suite unable to arrange content

**What.** B4 ([45 §4.9](./45_WebClientRoadmap.md), commit `98e02b8`) caps the **free** plan at
`maxPieces: 25` and enforces it on `POST /pieces`. Nearly every frontend spec arranges its own content
through `api.createPublishedPiece` → `POST /pieces`, as the **one shared seeded writer**
(`writer@qalam.local`). So the 26th piece created in a suite run is a `402 PIECE_LIMIT_REACHED`, in
**arrange** — before the test asserts anything at all.

**Consequence, stated precisely.** This is not "the suite gets slower near the end". It is a hard
failure of every affected test with an error that names a _plan limit_, which reads like a monetization
bug and has nothing to do with the code under test. Measured on the local stack (4,262 writer pieces
accumulated): `reader.spec.ts` failed **8 of 10**, and all 11 of W7a's new conversation tests failed,
every one of them inside `createPublishedPiece`.

**And it is not only a long-lived-database problem, which is the part worth being precise about.** A
single full pass of the suite creates far more than 25 pieces as that writer — `reader.spec.ts` alone
creates ten. So a **fresh** database trips the cap partway through the run too; the accumulated local DB
only made it fail from the first test instead of the twenty-sixth. The suite has not had a green run
since B4 landed (B3–B7 all landed 2026-08-08–08-09, after the last full CI run).

**Why it was not caught by B4 itself.** B4's own tests are unit + module tests against a fresh author
with a controlled count, and `/me/pieces/limit` behaves exactly as designed. Nothing in B4's row said
"the E2E suite shares one author", and nothing in the E2E docs said "the product now caps how much a
single author may create". The gap is between the two, which is what makes it a §6-step-3 finding.

**Resolution — in the harness, not the product.** `seed:e2e` now writes
`monetization.plans → free.limits.maxPieces = 0` (the "0 = unlimited" convention B4 itself defines), so
the stack the browser suite runs against does not cap its own fixture author. Three properties of the
fix, each deliberate:

- **It is stack configuration, exactly like its neighbour.** `stack-up.sh` already sets
  `RATE_LIMIT_ENABLED=false` because a suite that mints a login per test would otherwise be judged by
  a real product behaviour it is structurally guaranteed to violate ([e2e/06 §6]). The piece cap is
  the same category of thing.
- **It merges, never replaces.** The `monetization.plans` blob also carries plus/pro/enterprise and
  every price. Only `free.limits.maxPieces` is touched.
- **It runs unconditionally**, outside the seed's insert-if-missing writer guard, so an
  already-seeded stack picks it up on the next `pnpm e2e:up` without a `--reset`.

**No coverage was lost:** no spec anywhere asserts the cap (grepped). If one is ever written it must
arrange its **own** author rather than the shared writer — which is the correct shape for a
per-author limit anyway, and is now the standing note for whoever writes it.

**Also verified as part of the fix:** `reader.spec.ts` + `writing.spec.ts` go from 8 failures to
**13/13 green**, and W7a's own 11 tests from 0 to 11.

### B4-2 · **low** (documentation, not behaviour) · a response is exempt from the piece cap, and only the service says so

**What.** `POST /pieces/:id/responses` reaches `PiecesService.createDraft` **beneath**
`assertPieceAllowance`, so writing a response is never refused for the plan piece cap. That is
deliberate and correct — `pieces.service.ts` says it outright ("capping those would block a reader from
replying, which B4 does not ask for") — but the exemption is recorded **only** in that method's doc
comment. `getPieceAllowance`'s comment says the opposite-sounding thing in the same breath ("Responses
ARE counted"), and both are true: a response **counts toward** `used` but is never **gated** by it.

**Why it is worth a row rather than nothing.** W7a's first draft of the client believed the cap applied
and shipped copy and a test comment saying so — plausible, self-consistent, and wrong. Corrected before
commit, from the service rather than from the roadmap. Counting-but-not-gating is a genuinely
surprising combination, and neither [45 §4.9](./45_WebClientRoadmap.md) nor B4's own row mentions
responses at all.

**Open**, deliberately: the behaviour is right, so there is nothing to fix in code. It belongs in
[45 §4.9](./45_WebClientRoadmap.md)'s description of the cap, which is a roadmap edit and not W7a's.

---

## 3.15 W7b pre-flight + run — the clap that does not exist, and a rule nobody wrote down (2026-08-10)

### M7-3 · **medium** · **CLOSED 2026-08-17** · mobile has NO clap interaction, and §2 said it did (opened 2026-08-10)

**What.** [§2 row 5](#2-current-divergences-mobile--web-web-is-behind) claimed mobile shipped "clap
(1..50 accumulating) and report, on the reader action bar". Report is true. **Clap is not.** W7b's
pre-flight audit went looking for the accumulation-and-batching model to port and found nothing:

| Looked for                                 | Found                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| a clap control on `reader_action_bar.dart` | **Like · Bookmark · Share · More** only (More = save-to-collection + report)                        |
| a clap method on `EngagementRepository`    | like/unlike, bookmark/unbookmark, share, follow/unfollow, report — **no clap**                      |
| `POST /pieces/:id/claps` anywhere          | **no caller**; `ApiPaths` has `pieceLikes`, `pieceBookmarks`, `pieceShares` and **no `pieceClaps`** |
| an accumulator / press-and-hold gesture    | none                                                                                                |

Every one of the 25 mobile files mentioning "clap" is read-only: analytics totals, DTO mappers, the
`Limits.maxClapsPerUserPerPiece` mirror, enum/error-code mirrors, a clap _notification_ type.
`ClapDto`'s own comment describes an intended client design ("accumulated client-side
(press-and-hold) then flushed") that **neither client had ever built**.

**Consequence for W7b.** The row said `mobile → web` for all three items; for claps there was no
reference to port and — more importantly — building it on web alone is precisely the failure mode
[§1](#1-why-this-document-exists) names as the W-track's one way to go wrong. So it was **escalated
before any code was written** rather than resolved unilaterally. The decision was to build it: web
becomes the reference for the clap interaction, the same reversal **W8-1** produced when mobile
shipped a conversations screen it could not populate. The design therefore came from the contract
(`ClapDto.count`, `MAX_CLAPS_PER_USER_PER_PIECE`, the all-or-nothing `DELETE`) rather than from a
counterpart — see [54 §3](./54_WebEngagementReadinessReport.md).

~~**Open, and it is mobile's to take:**~~ **CLOSED 2026-08-17.** Mobile had a clap COUNT on its
analytics screens and no way for a reader to give one. Web's `use-claps` was the reference
(accumulate → debounce → one batched `POST` with `count` → adopt the server's two numbers; cap
client-side; remove-all), and all four properties ported unchanged.

**What shipped**, in three commits, one per layer:

| Layer      | Commit    | Mobile file:line                                                                                                                                                                                                                                                             |
| ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data       | `a5f27c8` | `lib/core/network/api_paths.dart:170` (`pieceClaps`) · `lib/shared/social/domain/engagement_repository.dart:20` (`ClapOutcome`), `:29`/`:35` (`clap`/`unclap`) · `engagement_remote_data_source.dart:39` · `engagement_repository_impl.dart:35`                              |
| Controller | `85d34c9` | `lib/features/reading/presentation/controllers/engagement_controller.dart:186` (`clapFlushDelay`), `:192` (`clap`), `:216` (`flushClaps`), `:262` (`removeClaps`) · `lib/shared/social/data/sync/clap_sync_handler.dart` (new) · registered `lib/app/sync_bootstrap.dart:41` |
| UI         | `0c4b1e8` | `lib/features/reading/presentation/widgets/reader_action_bar.dart:81` (the control), `:186` (removal in More) · flush hooks `lib/features/reading/presentation/screens/reading_screen.dart:92`, `:104`                                                                       |

**22 tests**, four files: `clap_repository_test.dart` (3 — wire, 204, `CLAP_LIMIT_REACHED`),
`clap_controller_test.dart` (11 — one group per property), `clap_sync_handler_test.dart` (8 — merge +
reconcile), `clap_action_bar_test.dart` (7 — tap, cap, sign-out, semantics, removal). Full suite
772 → 801, `dart analyze` clean.

**The two decisions web never had to make**, because mobile has an offline outbox and web does not.
Both are engineering calls, recorded here because neither is visible in the diff:

1. **An offline burst QUEUES, and gets its own handler rather than a `SocialCategory`.**
   `SocialSyncHandler` carries `desired: bool` — a _terminal state_ — which buys it idempotent replay
   and a `latest wins` merge (`social_sync_handler.dart:78`). A clap is a **quantity** and has
   neither property. Merging two queued bursts with latest-wins **discards the earlier one entirely**,
   after the reader has already watched the count climb past it: ten queued, five more tapped, five
   land. `ClapSyncHandler.merge` **sums**, and `clap_sync_handler_test.dart` asserts `10 + 5 = 15`
   specifically so it fails against latest-wins — **verified by reverting the merge to `=> incoming`,
   which reddens four cases** (15→5, 12→5, 50→40, and the queue-identity case). Growing
   `buildSocialOperation` an optional `count` would have put both contracts behind one signature and
   made the wrong merge the default for whichever the next caller forgot.

2. **The payload is a DELTA, not a desired total — and that choice has a stated cost.** A desired
   total would restore idempotent replay and make latest-wins correct, but it would let claps from one
   device **cancel** claps from another (device A queues "total 13" while device B legitimately adds
   five; reconnecting A pulls the count back down). A clap is a contribution, not a setting. So a
   retry can double-count, and the bound is written into the handler's docblock: the server clamps
   every request to `min(count, MAX - current)`, so the worst case is the reader's own count reaching
   50 early — it cannot exceed the cap, cannot touch another reader, and self-heals on the next
   engagement read.

**A defect the port found and fixed:** `engagementControllerProvider` is `autoDispose`, so a reader
who clapped and immediately navigated away left a debounce `Timer` firing into a disposed `ref`.
`ref.onDispose` now cancels it (`engagement_controller.dart:33`). Cancelling only prevents the crash —
**saving** that burst is the screen's job, which is why `reading_screen` flushes through a notifier
captured while mounted.

**The class matters more than the row.** This is the second time the register has credited mobile
with a surface it does not have (W8-1 was the first). Both were caught by [§6 step 2](#6-parity-check--run-at-the-end-of-every-client-epic)
— "do not trust a roadmap paraphrase" — which is now also "do not trust §2's own cells". A cell in
this document is a claim like any other, and §6.4's re-sweep is what keeps it honest.

### W7b-1 · **low** (contract, undocumented) · `POST /reports` refuses a self-report, and nothing said so

**What.** Reporting your own content or account is `422 REPORT_SELF` ("You cannot report your own
content or account"). It is correct behaviour. It is also absent from `CreateReportDto`, from the
controller's `@ApiOperation`, and from the W7 row — so a client written from the contract alone does
not know it exists.

**How it surfaced.** W7b's first browser run: two of five report cases filed against the shared
seeded writer's own piece, got the 422, and failed. The tests were wrong, not the code — but the
dialog sat on a spinner because the assertion only looked for the success path, which is exactly how
a real user would meet it if the refusal were not surfaced.

**Resolved in the client and in the suite**, not in the contract: the dialog surfaces the refusal
with the reader's text intact, and a dedicated spec asserts that (`engagement.spec.ts`, "a
self-report is refused, and the refusal is shown"). **Open** only as documentation — the
`@ApiOperation` on `POST /reports` should name the 422, which is a backend edit and not W7b's.

---

### A1-1 · **low** · `PAYMENT_NOT_FOUND` is thrown for a payment that exists but is not refundable

`BillingService.refund` (`backend/src/modules/monetization/billing.service.ts:165`) throws
`PaymentNotFoundException` on `original === null` **and** on `original.providerPaymentId === null`. The
second case is a real payment row that was never captured at a provider, and it is not "no such
payment": the operator's id is correct and nothing they retype will help.

Found while building A1b, whose whole point was keeping the refund failures apart — so the endpoint
collapses a third state into the first inside the very surface that must distinguish them.
**Not fixed: the backend is frozen for this row.** The client compensates by saying "does not exist, or
was never captured at a provider and so cannot be refunded", which covers both without asserting either.
Splitting it properly needs a `PAYMENT_NOT_REFUNDABLE` code and is a backend row.

### A1-2 · **low** · `PATCH /admin/monetization/config` can write 4 of the config's 7 fields

`MonetizationConfigPatch` and `MonetizationConfigService.updateConfig` both handle `taxRates`,
`currencyRates` and `regionCurrency` — the service merges them per key. But
`UpdateMonetizationConfigDto` (`dto/monetization-request.dto.ts`) declares no properties for them, so
`ValidationPipe` strips them before the service is reached. The three tables are therefore readable and
unwritable over this route.

A1a renders them read-only with a sentence saying why and pointing at the `monetization.config` setting,
rather than showing disabled inputs that read as a bug. Closing it is four DTO properties.

### A1-3 · **medium** · no admin route reads another user's credit balance

`GET /monetization/credits` is `@CurrentUser` self-scoped, so an admin calling it gets their OWN wallet.
There is no `admin/monetization` equivalent. Consequences for A1b, both handled rather than hidden:

- The credit-adjust confirmation **cannot** state a projected balance, which is what the row's brief
  asked for. It states the delta and the zero floor instead, and reports the real post-adjustment figure
  from the response. Compounded by `CreditService.apply` clamping at zero
  (`credit.service.ts:111`) — a deduction beyond the balance succeeds and lands on 0 rather than raising
  `INSUFFICIENT_CREDITS` — so even _with_ the starting figure, client-side arithmetic could print a
  number the server will not honour.
- Nothing in the admin app can display a balance, so there is no second place for one to be wrong.

### A1-4 · **low** · the coupon response drops three fields the create DTO accepts

`CreateCouponDto` accepts `appliesToTier`, `perUserLimit` and `description`; `toCouponDto`
(`monetization.mappers.ts`) returns none of them. So a coupon's tier restriction and per-user limit are
write-only: an operator can set them and can never read them back to check. A1b's form says so at the
field rather than letting the value appear to vanish.

### A1-5 · **medium** · nothing admin-facing lists payments, so a refund needs an id from elsewhere

`POST payments/:id/refund` takes a payment UUID and `GET /monetization/payments` is self-scoped, so the
admin surface cannot offer a picker or a search. The operator must already hold the id — from a support
ticket, or from the database. A1b's refund form is therefore an id-entry field and says why.

### A1-6 · **low** · revenue analytics sums across currencies without grouping

`MonetizationAnalyticsService.sumPayments` sums `p.amount` filtered only by status, so on an install
that has taken payments in more than one currency `totalRevenue`, `last30dRevenue` and `refunded` add
unlike units. `paymentsCount` remains meaningful.

A1c's revenue dashboard prints no currency symbol, labels the figures as minor units, and states the
caveat on the page. A correct fix is a GROUP BY currency and a per-currency response shape.

### A1-7 · **medium** · no admin route returns an individual subscription

`analytics/subscriptions` is aggregate only (`byStatus`, `byTier`, counts), and
`GET /monetization/subscription` is self-scoped. So **A1 does not close its own premise** — "an operator
today cannot see a subscription" is still true after this row, for the one thing the phrase most
naturally means. The row's other twelve endpoints were reachable and are now built; this one does not
exist to build. The subscriptions dashboard names the limit on the page rather than leaving an operator
to hunt for a search box.

---

## 4. Divergences that are NOT gaps (platform-inherent)

These are accepted permanently and need no epic. They exist because the platforms genuinely differ.

| Mobile-only                                                                                                  | Why it is not a web gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `splash`, `shell`                                                                                            | App launch + native navigation shell. The web equivalent is the router + app layout.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `storage` screen                                                                                             | Device cache management (clear cached pieces/images). A browser owns its own cache.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `gallery` page                                                                                               | Native media picker/gallery. The web uses the file input + the existing cover uploader.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Offline **read** cache                                                                                       | Mobile caches pieces for offline reading via Hive boxes. Web has a service worker + the offline route, deliberately narrower.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Screenshot protection (P7.2)                                                                                 | A mobile OS capability with no browser equivalent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Haptics                                                                                                      | No web analog.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Continue Reading · Recently Read · Weekly Activity** (the local half of `reading_analytics_screen`)        | **Recorded by W7c, 2026-08-10.** All three are computed from **device reading history** — `readingHistoryStoreProvider.readAll()`, a local Hive store. There is no reading-history endpoint in the frozen `v1`: history is client-local by design, and the controller's own docblock says so ("LOCAL-FIRST by design… reading history is the user's own device data"). Web has no such store, and building one is NEW PRODUCT SCOPE the roadmap never named — it would also contradict the offline-read-cache row directly above. So W7c ported the **backend aggregate only** (the seven `ReaderAnalyticsDto` fields), and these three cards have no web counterpart. Reviving them means first deciding whether reading history becomes a server resource — a product decision, not a port. |
| **Local content-privacy toggles** ("show bookmarks count", "show reading-history count" on your own profile) | **Recorded by W7c, 2026-08-10.** These gate what THIS DEVICE shows on your own profile; they are not server-backed and never were. `privacy_settings_screen.dart:1-9` is explicit: "These are LOCAL display gates: the frozen `v1` never exposes another user's reading history or bookmarks, so there is nothing cross-user to enforce; the toggles honestly control only what this device shows." Web has nothing to gate for the same reason — `profile-stats.tsx:6-11` already omits those counts, because the `totalReads`/`bookmarksReceived` profile fields are hardcoded `0` server-side (`profile.service.ts:257-261`, docs/26 §11 gap #3). A web toggle would hide a figure web does not display. **Not to be built** unless the profile counts become real AND cross-user visible. |

**Partly inherent (item 9 above):** offline _reading_ is inherent, but the **offline write queue**
(like/bookmark/follow taken offline, reconciled on reconnect) is a real product behaviour that web
simply lacks. It is not required for parity of _features_, but it is a parity gap in _behaviour_ —
flagged here so a future epic decides explicitly rather than by omission.

### 4.1 Accepted layout differences — same feature, different arrangement

Not gaps, and not platform-inherent either: both clients ship the feature, they just order it
differently. Filed here because [§6](#6-parity-check--run-at-the-end-of-every-client-epic) requires
every known difference to live in §2, §3, or §4 — so a later epic comparing the two surfaces sees
"known and accepted" rather than a bug to fix.

| Surface    | Difference                                                                                                                                                                         | Why it is accepted                                                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reader** | Web: author card at the **end** of the page, "More like this" below it. Mobile: author card **above** the prose, "More like this" at the end, after the comments/responses footer. | Mobile's author card placement predates the W-1 port and is the reader's byline-in-context; moving it would be a redesign of a shipped surface, not a parity fix. Both clients render the same two components with the same behaviour. |

| **AI search** | Web: query suggestions are a "Try instead" **row beside the results**. Mobile: a **dropdown while typing**. | Same endpoint, same purpose. Mobile's search runs on submit, so a dropdown is the only place suggestions can go; the web field debounces straight into the URL, so results are already on screen and a dropdown would flicker on a 300 ms timer over the answer it duplicates. |
| **AI discovery** | Web: **two** recommendation shelves on `/discover` (for-you, pick-up-next). Mobile: **five** on a dedicated AI discovery screen (adds trending, authors, genres). | The other three run the same `TrendingService` / `getWriters` / `getTrendingGenres` the web's editorial sections on that page already render — the recommender's versions differ only by carrying a reason. Shipping them would print the same rows twice on one page. |
| **Collaborator seats (B6)** | Web: "2 of 3 collaborators" sits in the **page header**, beside the Invite button. Mobile: in the **"Members" section header**, above the roster. | Mobile's invite action is an app-bar `IconButton` with no room for a count beside it, so the count anchors to the thing it counts instead. Same string, same moment (before the wall, not after the refusal), same upsell card directly above the roster on both. Recorded by **§6.4**. |
| **AF4 results** | Web: a result whose navigation target is a `graph_node`, `chapter` or timeline cue renders as a **plain card**. Mobile: opens a **detail sheet**. | **Reason revised 2026-08-08 by W9's sweep.** The original read "until W6 (story explorer)"; W9 shipped the story explorer and the row still stands, for a better reason. The explorer is **editor-scoped and owner-scoped** — it opens on your own draft, and `GET /ai/explorer/:storyId/:view` answers `STORY_NOT_FOUND` for anyone else's story. A search result's graph node generally belongs to a story the searcher does not own, so there is still nowhere to send them. A card that does not claim to navigate remains better than a link to a 404. |
| **Saved searches** | Web: the **server list only**. Mobile: a device-local mirror merged with the server list. | Mobile is offline-first (`SyncEngine`, §2 row 9); a browser has no offline reading story to serve, so a local mirror would be cache with no consumer. Both clients read and write the same `/ai/search/saved` rows, which is the parity that matters. |
| **AI surfaces — entry point** | Web: a `/settings/ai` **hub**, one settings-nav section, four sub-pages. Mobile: all three hang off the **editor's AI menu** (`editor_screen.dart:442-446`). | Mobile's editor is the whole screen, so its AI menu is the natural home. Web's editor is one route of many, and web already has a home for account-scoped management surfaces — Billing set the one-entry-per-section + hub pattern. Copying mobile's shape would bury three routes in an editor menu and hide them from anyone not currently writing. Added by W8's sweep (2026-08-05). |
| **Conversation export** | Web: downloads a **`.json` file**. Mobile: copies the JSON to the **clipboard** (`ai_conversation_screen.dart:186-199`). | The route returns plain JSON with no `Content-Disposition`, so making it a file is the client's job either way. A phone has nowhere useful to put a file; a browser does. Same document, same endpoint. Added by W8's sweep (2026-08-05). |
| **Conversation detail** | Web: **read-only**. Mobile: can **continue** the conversation by sending a completion with its id. | Web's assistant lives in the editor (W2), where a completion has the selected prose to act on. A composer on a settings page would be an assistant with no manuscript in front of it — a second, weaker entry to a capability the editor already offers properly. Added by W8's sweep (2026-08-05). |
| **Story Explorer + Ask — entry point** | Web: two **tabs on the in-editor AI drawer**. Mobile: two **full screens** pushed from the editor's AI overflow menu. | Note this is the OPPOSITE call to the "AI surfaces — entry point" row above, and deliberately so: those three are ACCOUNT-scoped (conversations, prompts, usage) and belong in settings; these two are **per-story** and belong where the story is. The drawer is the web's editor AI menu. Both clients reach both surfaces from the editor, gated identically on a synced draft. Added by W9's sweep (2026-08-08). |
| **Graph node detail** | Web: the detail **replaces the list** inside the drawer, with a back control. Mobile: a **bottom sheet** over the list (`story_node_sheet.dart`). | A nested dialog inside an open drawer is the one arrangement neither AntD nor a screen reader handles well, and the drawer already provides the "layer over the editor" mobile's sheet is for. The interaction is identical either way — pick a neighbour, land on that node. Added by W9's sweep (2026-08-08). |
| **Explorer → Ask** | Web: **no cross-link**; the two are adjacent tabs. Mobile: an "Ask about this story" **app-bar action** on the explorer (`story_explorer_screen.dart:54-59`). | Mobile needs the action because the two are separate routes and the explorer is where a question occurs to you. On web they are one click apart in the same drawer, so a link would navigate to the tab beside the one you are on. (Mobile's version of this action is also the entry point that skips the feature-flag check — **W9-2**, §6.2.) Added by W9's sweep (2026-08-08). |
| **Piece limit — where the refusal lands** | Web: the editor creates the draft on **first autosave**, so a refused create surfaces as a distinct `limit-error` save status mid-typing. Mobile: "New piece" mints a **local** draft and the refusal arrives at **sync**, so it surfaces as an explanation on that draft's row. | Same server refusal, same copy. The two clients create a piece at different moments — web on the first keystroke that saves, mobile offline-first — so the honest place to say "this will not save" is different on each. Neither could adopt the other's placement without adopting its create model. |
| **Piece limit — which controls block** | Web: **two** disabled controls (the header "New draft" and the empty state's "Write your first draft"), each `aria-describedby` the notice. Mobile: **one** disabled FAB, with the reason in its semantics label. | Web's dashboard has two create affordances because a browser page shows list and empty state in the same layout; mobile has exactly one. Both are disabled-and-explained rather than hidden (C-1) or live-and-refused (W3c-1). |
| **Collections — entry point** | Web: reached from the **account menu** ("Your collections"), beside Your writing / Your stats / Follow requests. Mobile: a row on the **my-profile screen** (`my_profile_screen.dart:130`). | Same two routes on the same paths (`/me/collections`, `/me/collections/:id`), so a link works on either client. Web already keeps every account-scoped surface in that menu and mobile keeps them on its own-profile screen — this follows each platform's existing convention rather than inventing a third. Added by W7b's sweep (2026-08-10). |
| **Save-to-collection + Report — how they are reached on the reader** | Web: a **"More" dropdown** on the engagement bar. Mobile: a **"More" bottom sheet** on the action bar (`reader_action_bar.dart:_more`). | The same split for the same reason — both clients keep the reflexive actions (like, bookmark, share, clap) on the bar and put the deliberate, low-frequency ones one tap behind it. Dropdown vs. sheet is the platform's own idiom for the identical menu. Added by W7b's sweep (2026-08-10). |
| ~~**Clap — web only, for now**~~ **Clap — three arrangement differences, all mobile-inherent** | Both clients have an accumulating, batched, capped clap. They differ in three places. **(1) Removal.** Web: an inline "Undo" button beside the clap. Mobile: a **"Remove my N claps"** row in the existing More sheet (`reader_action_bar.dart:181`). **(2) Offline.** Web: a burst lost in the debounce window is gone. Mobile: an offline flush **queues** onto the durable outbox (`clap_sync_handler.dart`). **(3) Flush triggers.** Web: `pagehide` + `visibilitychange` + unmount. Mobile: `AppLifecycleState.paused`/`inactive` + `dispose`. | **Now an accepted difference** (was a tracked gap; **M7-3** closed 2026-08-17 — §3.15, sweep §6.12). Each has a platform reason. **(1)** Mobile's bar is five thumb targets; a sixth conditional one would crowd the row it appears in, and the sheet is where this app already keeps secondary actions and has room for the honest full label. **(2)** Mobile has an offline write story and web deliberately does not (§4, "Partly inherent") — a clap that alone did not survive airplane mode would be the one engagement write that silently drops. **(3)** The same event under two platforms' names. The **debounce window is deliberately the SAME 600 ms** on both, and that is recorded as a non-difference on purpose: touch repeat-taps faster than a mouse, so web's lower bound holds more strongly on mobile, and the upper bound is if anything tighter because a mobile app can be backgrounded at any moment. |
| **Conversation layer — where it lives** | Web: comments and responses are **two inline sections at the end of the reading page** (`/p/:slug`), under the author card and above "More like this". Mobile: a **footer of two rows** on the reader that PUSH two dedicated screens (`comments_screen.dart`, `responses_screen.dart`). | A phone has no room for a thread under an article, so mobile's footer is a navigation affordance standing in for the surface itself; a browser page scrolls and has the room. Keeping the conversation on the piece's **own canonical URL** is what makes it shareable and deep-linkable (`#conversation`) — a separate web route would mint a second URL for the same piece and take the prose away from the reply being written. **Same two surfaces, same order as mobile's footer** (comments first, responses second, "More like this" last), same states, same endpoints. Added by W7a's sweep (2026-08-10) — **§6.8**. |

| **Reader analytics — entry point + naming** | Web: `/me/reading`, reached from the **account menu** beside collections, and the writer dashboard's menu label changed to **"Your writing's stats"**. Mobile: `reading_analytics_screen` reached from its own-profile screen, and its writer stats are a separate screen already. | Same reason as the collections row: web keeps account-scoped surfaces in the account menu, mobile keeps them on its own-profile screen. The **relabelling** is the part worth recording — web previously called the writer dashboard "Your stats", which is what let the reader figures sit inside it unnoticed. Two adjacent entries naming their audiences ("Your writing's stats" / "Your reading") is what makes the pair legible; mobile never needed the change because its two surfaces were never merged. Added by W7c's sweep (2026-08-10) — **§6.10**. |
| **Privacy — where the one real toggle lives** | Web: `isPrivate` is a **section inside edit-profile** (`edit-profile-page.tsx:253`). Mobile: a **dedicated privacy screen** (`privacy_settings_screen.dart`). | Mobile's screen holds three controls, but **only one of them is server-backed** — the other two are local display gates (§4). Web has exactly one control to place, and one control does not earn a route; it sits with the other `PATCH /me` fields it is submitted alongside. Same field, same endpoint, same copy about follow requests. Added by W7c's sweep (2026-08-10) — **§6.10**. |

**The bottom four rows were added by W5's sweep (2026-08-04), and they had to be.** The epic's own code
comments said each of them was "recorded in 48 §4.1" — and none of them was. A claim in a comment is not
a record ([§6](#6-parity-check--run-at-the-end-of-every-client-epic) step 5), and the next epic comparing
those two surfaces would have found four unexplained differences.

**Status of the reader row: parked, not closed.** Raised with the product owner on 2026-07-28 and
deliberately deferred — judged low priority, and possibly worth aligning later. So it is accepted
_for now_, not accepted permanently: nothing is blocked on it, no epic owns it, and no client should
change its reader layout on the strength of this row alone.

If a future epic (or the owner) wants the two readers aligned, that is a **roadmap decision** (§5's
standard) — a row in [45](./45_WebClientRoadmap.md) naming which client moves — not something an epic
does in passing.

---

## 5. The unassigned gaps — a real hole in the plan

Item **7** is what remains unowned. (Items 3, 4, 5, 6 and 8 have all closed: 6 and 8 by **W7c** on
2026-08-10; **P-2** in §5.1 closed on both clients on 2026-08-17 — §6.11. Onboarding is now the only
§2 row with no owner, and it is blocked on a product shape rather than unassigned.) The W-track was written to
close the AF1–AF6 client gap, and these fall outside those AF epics. (**W-1 is no longer in this
list** — it was closed by the 2026-07-28 port, §3.1.)

- ~~**Conversation layer**~~ — **CLOSED 2026-08-10 by W7a** ([45 §4.4](./45_WebClientRoadmap.md), rows
  1–2; report [53](./53_WebConversationLayerReadinessReport.md)). The original entry, for the record:
  comments and responses had UI on mobile and none on web, and `W3` is collaboration/trust while `W4`
  is monetization — **neither owned comments/responses**. W7 is the row that finally did, and it was
  sliced (W7a = conversation) by the W3/W5 precedent. Web now ships both surfaces inline on the
  reader; the arrangement difference is recorded in §4.1 and the sweep is **§6.8**.
- ~~**Collections**~~ — **CLOSED 2026-08-10 by W7b** ([45 §4.4](./45_WebClientRoadmap.md); report
  [54](./54_WebEngagementReadinessReport.md)). The original entry: mobile had a collections list +
  detail, web had neither, and no row covered it. W7b ships both on the same paths mobile uses.
- ~~**Clap / report**~~ — **CLOSED 2026-08-10 by W7b**, with a correction the entry itself needed:
  "deliberately scoped out of W1, with no row that picks them up" was right about web, but §2 row 5
  also claimed **mobile** had the clap. It does not (**M7-3**, §3.15). Report was a straight port;
  clap is web-first and mobile now owns the follow-up.
- ~~**Reader analytics**~~ — **CLOSED 2026-08-10 by W7c** ([45 §4.4](./45_WebClientRoadmap.md) row 4).
  Ported as the **backend aggregate only**; the three device-history cards are platform-inherent (§4).
  The entry as written was also slightly wrong about web: the reader figures were not missing, they
  were rendering inside the WRITER dashboard, which is why the fix was a move as much as a build.
- ~~**Privacy prefs**~~ — **CLOSED-NOT-BUILT 2026-08-10 by W7c** ([45 §4.4](./45_WebClientRoadmap.md)
  row 5). Its one server-backed control already shipped (`edit-profile-page.tsx:253`) and its other two
  are local display gates with nothing cross-user to enforce (§4). Listing it as a gap was the error;
  the row is closed by evidence rather than by code.
- **Onboarding, AI conversations + prompt library + usage** — mobile-shipped, none in the W-track.
  (The last three are named by `W8`, which is unclaimed.) **Onboarding still needs a product shape for
  web before it is an engineering task** — W7c deliberately did not touch it.
- ~~**Ask My Book**~~ — **CLOSED 2026-08-08 by W9, together with the story explorer.** Found unowned by
  W5's sweep (2026-08-04); decided 2026-08-07 to be its own row rather than W6's. The reasoning below
  stands as the record of why, and both surfaces now ship on web ([45 §4.12](./45_WebClientRoadmap.md)).
- **The original entry, for the record:**
  `POST /ai/ask[/stream]` is grounded Q&A over a **story's knowledge graph**, so it needs an owned story
  AND a built AF3 graph (§3.9 W5-4) — the same prerequisite the story explorer has, and the reason W5's
  row could not absorb it. But `ask-book.controller.ts` sits in `retrieval/consumers/`, same as
  `story-explorer.controller.ts` — it is the same AF4-consumer-of-the-AF3-graph shape that [45]'s
  2026-08-05 correction (§4.8) already moved out of W6 for the explorer. Bundling it into W6 would
  reintroduce the mislabel that correction fixed. **[45](./45_WebClientRoadmap.md) W9** now owns both as
  one ordinary port against an exercised mobile reference; W6 stays scoped to the analysis lifecycle only.

### 5.1 Both-platform product gaps in inline review (opened 2026-07-28, after W3b)

Not divergences — **neither client does these**, so they need a roadmap decision rather than a port.
Recorded here because W3b drew them as boundaries, and a boundary that lives only in a commit message
is how the debt in this document accumulated in the first place.

| #   | Gap                                                                                           | Where both clients stand                                                                                                                                                                                                                                    | Shape of the work                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-1 | ~~**Applying an accepted suggestion**~~ **CLOSED — server 2026-07-29, both clients same day** | `POST /suggestions/:id/accept` now **rewrites the anchored range of the piece body**, in the same transaction that marks the suggestion accepted, and captures a `pre_edit` snapshot first. A stale anchor is `409 SUGGESTION_CONFLICT` and writes nothing. | Done on the backend (commit `f6827e0`, `qalam-mobile/docs/56` §3b); mobile's client half in `dd12091`; web's copy + assertions in W3c-4, §3.4. **Nothing outstanding.** |
| P-2 | ~~**Composing @mentions**~~ **CLOSED — both clients 2026-08-17, same day**                    | Both composers now resolve a typed `@handle` to an id and the mentioned person is notified. Web `7ff62d4`, mobile `738c8d9`. The stored form is `@<uuid>` **inside the body** (the server re-derives `mentions[]` from it), so the body is the mention.     | Done. The shape of the work changed on contact — the candidate set is the **story roster**, not the invite dialog's arbitrary-handle lookup. Sweep: **§6.11**.          |

**P-1 was correctness-shaped, not a nicety** — and it went the server's way.

**What changed (2026-07-29, commit `f6827e0`).** D1 was decided in favour of the server-side arm:
`SuggestionService.accept` now applies the edit. It rewrites the anchored range through
`PiecesService`, in the same transaction that settles the suggestion, so an accepted suggestion always
corresponds to a real change; it versions the pre-edit content first through publishing's existing
`pre_edit` snapshot mechanism; and it refuses a stale anchor with `409 SUGGESTION_CONFLICT` rather
than relocating the edit. Mobile's interim toast ("Marked accepted — apply the change in the editor.")
was reverted to "Suggestion accepted.", which is true again. Full record:
`qalam-mobile/docs/56` §3b.

**What is still open, and it is not what P-1 described.** Three client-side items, none of them a
product decision:

- **Mobile + web both re-read the piece after an accept** — done (C-13, `qalam-mobile/docs/56` §2.7).
- ~~**The web suggestion card still tells the writer the prose was NOT changed**~~ — **done
  2026-07-29** (C-14). The copy and all three assertions that pinned it moved together; see
  **W3c-4** in §3.4.
- **Applying an edit from inside the editor** is no longer needed for correctness. The editor
  integration is now an optional nicety (seeing the change land live rather than on the next read),
  not the fix for a silent no-op.

---

**Decided 2026-07-28 — option (a).** These are now owned by roadmap rows: **W7** (engagement & parity
backfill, including P-2), **W8** (the remaining AI surfaces), and **D1** (the product decision behind
P-1). See [45 §4.4](./45_WebClientRoadmap.md). They sit last in the order deliberately: each is a gap
on one client while the other already ships it, so nothing is blocked on them.

---

### 5.2 The monetization catalogue sells eight features and the backend enforces one (opened 2026-07-29, during W4)

Not a divergence — **both clients are equally affected**, and the hole is server-side. Found while
scoping W4's gating, which is what the row was supposed to be about.

`monetization.plans` ([`settings.catalog.ts`](../backend/src/modules/settings/settings.catalog.ts))
sells eight `PremiumFeature` codes across four tiers. **Exactly one is asserted anywhere:**

| Feature                                                                                                                                 | Enforced?                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `ai_budget`                                                                                                                             | ✅ `AiUsageMeterService.checkQuota` — and only while the monetization flag is on |
| `ai_writing`, `ai_discovery`, `premium_search`, `premium_recommendations`, `story_intelligence`, `advanced_analytics`, `publishing_pro` | ❌ computed and reported by the entitlement snapshot, **never asserted**         |

**The bridge exists and is dead code.** `EntitlementPolicyProvider` self-registers the AF5 Entitlement
Service into the Policy Engine as its entitlement port, and `PolicyEngineService.isEntitled()` is a
public method — with **zero callers** in the backend. No rule in the ordered pipeline consults it. So a
subscriber's plan is computed correctly and then ignored on every route but the AI meter's.

**Consequences, in the order they bite:**

1. **A client must not gate on the seven.** Gating `advanced_analytics` or `publishing_pro` in a UI
   would be a client-only wall in front of a route the server serves to anyone — the same class of
   defect as **W3c-1** (§3.4) inverted: dead UI rather than a dead button. W4 therefore gates only
   `ai_budget`, and upsells the rest non-blockingly.
2. **`ai_budget` has two distinct denials and the clients modelled one.** `assertAllowed(AiBudget)`
   failing is an entitlement denial whose remedy is _"see plans"_; `assertWithinQuota` failing is
   `QUOTA_EXCEEDED`, whose remedy is _"wait for reset"_ or buy credits. Conflating them tells a blocked
   user to wait for a reset that will never help. W4 adds the missing state.
3. **The meter no-ops when monetization is dark** (`checkQuota` returns early, AF1's own token caps
   apply). Since both clients default the flag off, a UI that asserts quota or entitlement states in
   that mode is asserting limits nothing enforces — correct under a flag-on E2E run and wrong in the
   default build. Worth pinning both ways.
4. **The free tier is internally contradictory.** `free` is granted `ai_budget` with a 20k/day,
   200k/month token allowance but **not** `ai_writing`. If the server ever enforced `ai_writing`, the
   free tier's budget would become unspendable. ~~That contradiction is a product question and it
   blocks scoping the fix~~ — **RESOLVED BY THE OWNER 2026-08-08 ([45](./45_WebClientRoadmap.md) D3):
   the free tier gets NO AI writing.** AI writing is a paid capability. The contradiction is settled
   in favour of removing the allowance, not the restriction.

   ~~**Nothing has been built yet, and until it is, the decision has no effect.**~~ — **BUILT
   2026-08-17** (`bda3f08`, `390c1ac`, `af8448f`, `a826103`; sweep in **§6.13**). ⚠️ **The behaviour
   REGRESSION for existing free users is LIVE from `bda3f08`.** They could use AI writing yesterday
   and cannot today; it was flagged before the decision and taken deliberately, and nothing was added
   to soften it — no grandfather clause, no grace period, no last free generation.

   Of the two things this item said were required, **one shipped and the other was answered instead of
   done, because its premise had gone stale:**

   - **`ai_writing` is now enforced.** `AiUsageMeterService.checkQuota` maps the request's `AiFeature`
     through a TOTAL `AI_FEATURE_PREMIUM_CODE` map in `@qalam/shared` and asserts the code when the
     feature has one, beside the existing `assertAllowed(AiBudget)`. Five features are sold behind it —
     `writing_assistant`, `craft_coach` (it generates model output and meters identically; its
     `analysis` prompt category is a template label, not a product tier) and the three vestigial AF1
     codes. Both clients gate their AF2 surfaces through their own existing `PremiumGate`, and a
     distinct FOURTH remedy was added on each, pinned apart from the other three by tests.
   - **Free KEEPS `ai_budget`.** This item's wording ("an allowance that cannot be spent") predates the
     AF4 surfaces going live and is **no longer true**: `ask_book` and semantic-search synthesis both
     run through `AiCompletionService.complete()` and therefore meter against `ai_budget`, and both are
     shipped on both clients. Free's allowance is spendable. Removing it would have denied free users
     every metered AI feature — far wider than D3 decided — and would have silently pre-empted **D4**,
     whose scope the owner deferred. Zeroing the token limits instead would have routed the refusal to
     `QUOTA_EXCEEDED` ("wait for reset"), which is the conflation defect **§3.6** already records. So
     the contradiction this item opened is closed the other way round: free has a budget it can spend
     on the AI it still has, and no AI writing. **Consequence 1 of this section still stands for the six
     codes beyond `ai_writing`** — nothing else was gated, and both clients carry a test proving a free
     user can still ask their book a question.

   **D4's scope is deferred** (owner, same day: "will decide this later what enforcement we will
   do"). D3 turned D4 from _blocked_ into _floored_: enforcing `ai_writing` is now mandatory, and the
   open question is only how far past it to go. **The "a client must not gate on the seven" rule in
   consequence 1 still stands** for the six codes beyond `ai_writing`.

**Ownership.** `premium_content` (a ninth code that does not exist yet) is owned by **B2**, held —
[45 §4.5](./45_WebClientRoadmap.md#45-b2--premium-content-held-detail). B2 will write the **first real
`isEntitled` caller** and establish the enforcement pattern. **The other seven are unowned**, and
closing them is a backend row plus the free-tier product decision above — not a client port. **W5**
inherits three of them (`ai_discovery`, `premium_search`, `premium_recommendations`), which is why B2
should precede it.

---

## 6. Parity check — run at the end of every client epic

Added to the per-epic flow as step 7 ([45 §2](./45_WebClientRoadmap.md)):

1. **Did this epic deliver only what its roadmap row named?** Anything extra is a divergence — take
   it out, or record it in §3 with a resolution.
2. **Does the platform that already had this feature actually have every part I built?** Open the
   reference screens and compare, surface by surface. Do not trust a roadmap paraphrase (§3).
3. **Does the other platform now need a follow-up?** If yes, add a row to §3.
4. **Re-sweep §2** for the area touched, and update the "Last swept" date at the top.
5. **Nothing is left unrecorded.** A known difference that is in neither §2, §3 nor §4 is a bug in
   this document.

### 6.1 W8's sweep (2026-08-05)

Recorded rather than merely performed, because step 5 admits no unrecorded difference and W5's sweep
found four claimed-but-absent records in the epic before it.

1. **Only what the row named?** Yes — the three surfaces, plus the hub that makes them reachable. Two
   things W8 touched that were _not_ in its row, both consequences rather than additions: a cross-link
   card on W4's `/settings/billing/usage` (the other half of the §3.12 usage decision — a one-way link
   would have been the confusing option), and `UpdateAiConversationRequest` in `@qalam/api-types`, which
   the PATCH route needed and which is now pinned by the §3.11 guard. **Archiving was deliberately left
   out** even though the DTO accepts it (**W8-2**).
2. **Does mobile actually have every part I built?** No, in one direction that matters: mobile has the
   conversations _screen_ and no way to create a conversation, so its list is permanently empty
   (**W8-1**, confirmed live). Web therefore has one control mobile lacks — "New conversation" — which is
   a divergence _toward_ the contract, not away from it. Everything else was compared surface by surface
   against the four mobile screens; three arrangement differences went to §4.1.
3. **Does mobile need a follow-up?** Yes — **W8-1** (cannot create) and, once the backend can support it,
   **W8-2** (archive is a no-op it reports as success). Both unowned; neither is W8's to fix.
4. **§2 re-swept.** Row 3 (AI breadth) closed to 7 of 8 — only the story explorer (W6, held) remains, and
   ask-book is still the §5 orphan.
5. **Nothing left unrecorded.** Five defects in §3.12, three accepted differences in §4.1, and the ten
   visual baselines needing a CI mint in [52 §4.2](./52_WebAiSurfacesReadinessReport.md).

### 6.2 W9's sweep (2026-08-08)

1. **Only what the row named?** Yes — Story Explorer and Ask My Book, plus the two things each was
   unbuildable without: `storyId` on the editor→AI seam (§3.13), and `AskBookStreamEvent` in
   `@qalam/api-types`, now pinned by the §3.11 guard's completeness check. `resolveAvailability` was
   widened to accept `feature: null` for the same reason — the explorer's route has no flag, and every
   existing caller passes a feature, so the change is additive. **Nothing else was touched.** The
   buffered `POST /ai/ask` got an api method it does not yet have a caller for; it is one line, it
   mirrors the DTO, and it is named as unused in its own doc comment rather than left to look like a
   live path.
2. **Does mobile actually have every part I built?** Compared surface by surface against
   `story_explorer_screen.dart`, `story_node_sheet.dart` and `ask_book_screen.dart`. Same parts, same
   order, same vocabulary — eight views, nine scopes, node list → detail → neighbour walk, scope chips
   → question → streamed answer → cited sources → stop/retry. **Three arrangement differences**, all
   §4.1 territory and all recorded in §4.1 below: the detail replaces the list rather than opening a
   sheet; the surfaces are drawer tabs rather than routes; and the explorer's "Ask about this story"
   app-bar action has no web counterpart because the two are adjacent tabs rather than two screens.
   **One capability web has and mobile does not**, and it is a consequence rather than an addition:
   web resolves the `AskBook` flag on the surface itself and shows the availability notice, while
   mobile resolved it only on the editor's menu entry. Recorded as **W9-2** and **fixed on mobile the
   same day** — see below.
3. **Does mobile need a follow-up?** Yes — two, and both were **taken and closed 2026-08-08**, which
   is a departure from step 1 worth naming: they were opened as unowned mobile rows, the user read
   them and said fix them, so they were done as a scoped follow-up rather than folded into W9's own
   commit. Both are recorded here in full because the sweep is where they were found.

   ### W9-2 · **low** · **CLOSED 2026-08-08 (mobile)** · Ask My Book was reachable with its feature flag down

   **What.** `POST /ai/ask` is gated on `feature.ai.askBook` as well as `ai.use`
   (`ask-book.service.ts:86` → `assertEnabled`, 403 `AI_FEATURE_DISABLED`), and AF1 seeds every AI flag
   **dark** — so flag-down is the state every deployment starts in. `editor_screen.dart:246-247` computed
   the right predicate for its menu entry. Nothing else did: `story_explorer_screen.dart:57` pushed
   `Routes.aiAskPath` unconditionally, and the screen itself tested only `appConfig.enableAi`
   (`ask_book_screen.dart:63`). So the surface the overflow correctly hid was one tap away from the
   surface it did open — and `/ai/ask/:storyId` is a registered route, so a deep link was a third door.

   **Consequence, stated precisely.** Not a crash and not a raw error: mobile already maps the code to
   "Not available yet" and sets `canRetry: false` (`ai_error_copy.dart`), and the typed question is not
   cleared. It is a wall met **after** the writer composes a question rather than before — the exact
   failure mode this platform's own gating doc comment names as the thing to avoid ("shown **before**
   the writer composes an instruction rather than after they lose it to a rejection").

   **Fixed** by putting the gate where all three doors lead: `AskBookScreen` now resolves the flag
   itself and renders the same `AiErrorCopy` a failed request would produce, so pre-flight and
   post-flight read identically. Ordered as the server checks — `AI_DISABLED` before
   `AI_FEATURE_DISABLED` — so a master switch that is down is not reported as this feature being
   unavailable. Unresolved flags resolve to **usable**, not blocked: `GET /ai/features` is a courtesy
   read, the ask itself is authoritative, and blocking on unknown would flash a wall on every open and
   lock the surface out entirely whenever that read fails. The explorer's action is additionally hidden
   when the flags say so — affordance, not enforcement.

   **Guarded** by four tests in `af4_entry_points_test.dart`, the file that already owns this defect
   class. Three of them were **confirmed to fail against the unfixed code** before the fix was restored.

   ### W9-3 · **low** · **CLOSED 2026-08-08 (mobile)** · every graph edge's evidence was dropped at the parse boundary

   **What.** `StoryGraphEdge.fromJson` read seven fields and skipped `evidence` — the quote grounding
   the **relationship**, as distinct from the evidence on either endpoint — while `StoryGraphNode.fromJson`
   parsed the identical field three classes above it. The backend populates it on every edge
   (`story.mappers.ts:53`, `toEdgeDto`), so it arrived on the wire and was discarded before any widget
   could ask.

   **Severity, stated honestly.** **Neither client renders edge evidence today** — both node sheets show
   node evidence only. So this was a latent model gap, not a live capability difference: on web the field
   already survived into the parsed object, while on mobile it was gone. It earned a row because the
   asymmetry is silent — anyone reading `story_graph.dart` sees `evidence` on the node class and would
   reasonably assume the edge class has it, which is how a future "why is this relationship here?" feature
   gets built against a field that arrives empty.

   **Fixed** by parsing **and** serialising it, with the parameter `required` rather than defaulted so the
   asymmetry cannot quietly return. Guarded by two tests in `retrieval_entities_test.dart`, asserted
   through the `toJson` round trip as well as the parse — the offline explorer cache re-reads `toJson`, so
   a field that parses but is not serialised comes back empty on the second open, which is the harder
   version of the same bug to notice.

4. **§2 re-swept.** Row 3 (AI breadth) **closes at 8 of 8** — the last row-3 gap. The §5 Ask My Book
   orphan closes with it. No other row is affected: nothing here touches collaboration, monetization,
   social depth, reader actions, analytics, onboarding, privacy or offline.
5. **Nothing left unrecorded.** The audit is §3.13, its one web defect is **W9-1** (found and fixed in
   flight), the two mobile defects are **W9-2** and **W9-3** above (both closed 2026-08-08, with the
   mobile gates green: `flutter analyze` clean, 653 tests passing, changed files formatted), and the
   three arrangement differences are in §4.1. **The one item this sweep first left unverified has since
   been executed** against a live local stack: both axe scans pass in `frontend-chromium` and
   `frontend-dark` (4/4, zero critical/serious), and the `frontend-ai-panel.png` baselines pass
   unchanged in both themes. That run found **W9-4** below — which is precisely why [e2e/10 §8.4]
   refuses reasoning as evidence for a rendered property.

### W9-4 · **medium (harness)** · **CLOSED 2026-08-08** · both new a11y scans asserted a surface the flags had turned off

**What.** The two scans failed 4/4 on their first execution. They were written on the belief that the
Story Explorer "has no flag to raise" — true of the **route** (`story-explorer.controller.ts` carries
`ai.use` alone, which is exactly what §3.13 established) and false of the **client**: the tab resolves
through `resolveAvailability({feature: null})`, which still reads `aiEnabled`, the **master** flag, which
AF1 seeds dark like every other. So both scans found "AI is turned off" and no chips at all.

**It was already written down.** `api.enableAiFeatures` carries the correction in its own comment — "a
per-feature flag alone resolves to `off`, not `feature-off`". The reasoning error was reading "no
per-feature flag" as "no flag", which is the same collapse of two adjacent facts that produced W9-1,
W9-2 and W9-3.

**Second half of the same defect:** flags must be raised **before** the panel opens. `/ai/features` is
read through TanStack Query with a 60 s `staleTime`, so a panel opened first and flag-raised second
serves the flag-down answer for the rest of the test and renders the availability notice under a
correctly-selected tab — a failure that looks like a broken selector and is not.

**Fixed** by having both scans take the AI-flag lock, the explorer's with an **empty** feature list, so
the asymmetry between the two surfaces is asserted rather than asserted-about. Both now pass in both
themes.

**One pre-existing failure was ruled out, not absorbed.** `assistant.spec.ts` "writes and autosaves"
failed in the same loaded run. It is **T-7** (§3.5) — verified 3/3 green in isolation at 1 worker, which
is that record's own established signature. Not W9's, and not fixed here.

**All three W9 defects share one shape, and it is worth naming.** W9-1 was a terminal case a `for await`
translation lost from a Dart subscription; W9-2 was a gate applied at one of three entry points; W9-3 was
a field parsed on one class and not its sibling. None was a misread of the contract — §3.13 found the
contract sound. Each was a **correct rule applied in fewer places than it holds**, which is the class of
defect a per-surface audit finds and a per-endpoint audit does not.

---

### 6.3 B4's sweep (2026-08-08)

The first sweep for a row that is **not** a client port. B4 is an enabler plus two client halves
built in the same pass, so step 2 has no reference platform to compare against — neither client had
this feature. The comparison is therefore **web against mobile, both new**, which makes step 1 the
load-bearing one.

1. **Only what the row named?** Almost. [45 §4.9](./45_WebClientRoadmap.md#49-b4--piece-limit-per-plan-detail--done-2026-08-08)
   named `POST /pieces`; **`POST /pieces/:id/duplicate` was capped as well**, decided explicitly
   before the code was written rather than discovered afterwards. Duplicate calls `pieces.create`
   and is a live button on the web dashboard, so an uncapped duplicate made the whole cap
   bypassable in one tap. It is creation — not publish, not update — so the "keep everything on
   downgrade" rule is untouched. Two additions were consequences rather than scope: the additive
   `GET /me/pieces/limit` (nothing already returned the count both clients were required to show),
   and a per-key merge of `limits` in `mergePlans` **without which the cap would have been inert on
   every existing deployment** (`syncDefinitions` inserts with `orIgnore()`, so a stored catalogue
   from before B4 replaced the compiled `limits` wholesale and `maxPieces` read as absent = unlimited).
2. **Does the other platform have every part I built?** They were built together and compared
   surface by surface: the count string, the blocked headline, the over-limit headline and the
   remedy sentence are **word-for-word identical**, and a mobile test asserts the shared wording
   precisely so a later edit to one client fails on the other. Two differences, both platform-inherent
   and recorded in §4.1 below: **where the refusal lands** (web creates the draft lazily on first
   autosave, so it needs a distinct `limit-error` save status; mobile mints locally and the refusal
   arrives at sync, so it needs a per-row explanation), and **which controls exist** (web disables
   two buttons — header and empty state; mobile disables one FAB).
3. **Does either platform need a follow-up?** One, and it is not B4's: mobile's `QButton` clamps
   every button in the app to a 44 px tap height, so `androidTapTargetGuideline` (48) fails app-wide.
   B4's blocked state passes contrast, labelling and the iOS 44 guideline rendered in **both** themes;
   the 48 gap is recorded as **T-10** below rather than patched with a one-off taller button.
4. **§2 re-swept.** No row moves: piece limits are a new capability on both clients simultaneously,
   which is the first time this register has recorded that.
5. **Nothing left unrecorded.** The response-counting asymmetry (responses count toward the cap and
   are not gated by it) is stated in 45 §4.9 and in the counting method's own comment; the api-types
   guard was checked and found not applicable, which is also written down there.

### T-10 · **low** · every `QButton` is 44 px tall, so the Android 48 px tap-target guideline fails app-wide

**What.** `q_button.dart` sets `tapHeight = max(visualHeight, 44)`. 44 is the iOS HIG minimum;
Android's is 48, and `meetsGuideline(androidTapTargetGuideline)` fails for any screen containing a
`QButton` — not for anything a particular surface did.

**Found by** B4's mobile a11y scan (2026-08-08), which asserts `textContrastGuideline`,
`labeledTapTargetGuideline` and `iOSTapTargetGuideline` in light and dark and states in the test why
the fourth is absent.

**Not fixed here.** Raising the clamp to 48 changes the height of every button in the app and is a
design decision with visual consequences on every screen — a token/UI row, not a piece-limit row.
Unowned.

### 6.4 B6's sweep (2026-08-08)

The per-story collaborator seat cap — `PlanLimits.maxCollaborators`, Free 0 · Plus 3 · Pro/Ent
unlimited, charged to the **story owner's** plan ([45 §4.11](./45_WebClientRoadmap.md)).

1. **Only what the row named?** Yes. The catalogue key, enforcement at the three doors that create a
   seat, one read endpoint, and the three client surfaces §4.11 lists. Three things were touched that
   the row does not name, each a consequence rather than an addition, and each stated here because
   step 5 admits no unrecorded difference:

   - **`EntitlementService.getLimits`' fallback** changed from `{aiDailyTokens: 0, aiMonthlyTokens: 0,
aiMonthlyCredits: 0}` to the compiled defaults **for the resolved tier**. That stub predates B4
     and answers "unlimited everything" for the token caps; once B6 existed it also left
     `maxCollaborators` _absent_, and absent is the single state with no honest reading. Closing it at
     the source beat having every caller guess.
   - **`resolvePlanLimit` + `NEGATIVE_UNLIMITED_LIMIT_KEYS`** in `@qalam/shared`. B6 could have been
     built with a bare `if (limit < 0)` at its two call sites; the registry exists so the _next_ cap
     with a meaningful zero has somewhere to declare itself instead of quietly copying whichever
     neighbour it was pasted from.
   - **The `monetization.plans` setting description**, extended to state the exception. This is the
     admin-facing string the Settings UI renders, and the deviation is only real to an administrator
     if it is written where they will read it.

   **B5 and B7 were not touched.**

2. **Does the other platform have every part I built?** This row has no reference platform — like B4,
   it is a new capability landing on both clients at once, so the comparison is web against mobile
   rather than either against a predecessor. Compared surface by surface:

   | Part                           | Web                                                                   | Mobile                                            |
   | ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------- |
   | Seat count before the wall     | `CollaboratorSeatCount` beside the Invite button                      | `CollaboratorSeatCount` in the Members header row |
   | Pending called out separately  | "3 of 3 collaborators · 1 invitation pending"                         | identical string                                  |
   | Free upsell                    | `CollaboratorSeatNotice`, accent tint, "See plans"                    | same copy, `infoBg`/`infoText` tint, same action  |
   | Invite affordance when blocked | visible, `disabled`, `aria-describedby` → the notice                  | visible, `onPressed: null`, reason in the tooltip |
   | Accept-side refusal            | per-row `role="alert"` on the inbox                                   | per-row persistent state, `liveRegion`            |
   | Gating                         | both hide the whole seat surface from a viewer without `story.invite` | same                                              |

   **One accepted arrangement difference** — recorded in §4.1: web puts the seat count in the page
   header beside the Invite button, mobile puts it in the "Members" section header, because mobile's
   invite action lives in the app bar where there is no room for a count. Same information, same
   moment, different anchor.

3. **Does either platform need a follow-up?** No. Neither client is missing a part the other has, and
   the row introduced no unowned gap. Admin is deferred for this row as it is for the rest of the
   B-series; an administrator can still set `maxCollaborators` through the existing
   `monetization.plans` JSON editor, and the description now tells them what `0` means there.

4. **§2 re-swept.** No row moves. Seat caps are a new capability on both clients simultaneously — the
   second time this register has recorded that, after B4.

5. **Nothing left unrecorded.**

   - The **accept gate counts members only** while the offer gates count members + pending. That
     asymmetry is deliberate (an invitation must not block its own acceptance), and it is stated in
     `CollaboratorSeatService`'s doc comment, in 45 §4.11, and in a test named for it.
   - The **`MAX_STORY_COLLABORATORS` ceiling (20, 409) still exists** alongside the plan cap. Two caps
     on one action is worth writing down: the flat one is anti-abuse and no plan raises it, the plan
     one is a paywall and upgrading clears it. The plan cap is checked first.
   - The **api-types guard (§3.11) was checked and is not applicable** — `@qalam/api-types` has no
     collaboration namespace, so there is nothing for `CollaboratorLimitDto` to drift from. Same
     position as B4's `PieceLimitDto`. If a collaboration namespace is ever added, these types are
     what it starts with.
   - **Dark mode.** Mobile asserts `textContrastGuideline` on both notice states in both brightnesses,
     plus `labeledTapTargetGuideline` and `iOSTapTargetGuideline` — the same scan B4 ran, and it hits
     the same **T-10** app-wide 44 px tap height, which stays unowned. Web's new markup is built from
     `QTokens` pairs that are defined in both themes and is covered by the **existing** e2e a11y specs
     for `/write/:storyId/collaborators` and the invitations inbox; no new baseline was minted, and no
     live e2e run was part of this row (the suite's deferred state is unchanged).

---

### 6.5 B7's sweep (2026-08-08)

Version-history depth — `PlanLimits.maxSnapshotHistory`, Free 5 · Plus 25 · Pro/Ent unlimited, read
from the **story owner's** plan and applied at READ time only ([45 §4.12](./45_WebClientRoadmap.md)).

1. **Only what the row named?** Yes. The catalogue key, the clamp on `GET /stories/:id/snapshots`,
   refusals on `GET /snapshots/:id` and revert, one error code, and a count line + offer on each
   client. Four things were touched that §4.12 does not spell out, each a consequence rather than an
   addition, and each stated here because step 5 admits no unrecorded difference:

   - **The list response shape** went from `SnapshotDto[]` to `SnapshotHistoryDto`. §4.12 asks for
     "the true total alongside the clamped list", and there is nowhere else for it to ride: an array
     cannot carry a count. Not a freeze amendment — `/stories/:id/snapshots` is AF6 (2026-07-20),
     after the `v1` baseline of 102 paths ([25 §1](./25_BackendFreeze.md)) — and its only consumers
     are the two clients this row also ships.
   - **Two repository reads** (`countSnapshots`, `snapshotVersionAtOffset`) and a `take` on
     `listSnapshots`. The clamp is applied in SQL because a snapshot row carries the whole story
     body; slicing in memory would read every hidden version on every list.
   - **The e2e a11y scan for the publishing page** now arranges six versions instead of one, so B7's
     clamped state is actually on screen when the scan runs. A scan that never renders the new
     markup is the "looked wired and was not" class this register exists to catch.
   - **`ApiClient.storySnapshots` in the e2e fixtures** was retyped to the new shape (it had no
     callers, but a fixture declaring a shape the server no longer sends is a trap), and
     `captureSnapshot` was added to arrange the clamped state.

   **B5 was not touched.**

2. **Does the other platform have every part I built?** No reference platform — like B4 and B6 this
   is a new capability landing on both clients at once, so the comparison is web against mobile.

   | Part                       | Web                                                                      | Mobile                                                    |
   | -------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
   | Count before the wall      | "5 of 32 versions" beside the "Versions" heading                         | same string, beside the "Snapshots" heading               |
   | Source of the count        | `total` from the wire, never `items.length`                              | same, asserted by a test                                  |
   | Offer                      | tinted row at the END of the list, `role="status"`, accent tint          | same position, `QTokens` `infoBg`/`infoText`, `Semantics` |
   | Copy                       | "27 older versions are saved but not shown." + "Nothing was deleted — …" | identical, word for word                                  |
   | Action                     | "See plans" → billing plans                                              | same                                                      |
   | Capture when clamped       | stays enabled                                                            | stays enabled                                             |
   | Silent when nothing hidden | no count, no offer                                                       | no count, no offer                                        |

   **No arrangement difference to record.** Unlike B6's seat count — which had to anchor differently
   because mobile's invite action is an app-bar icon — both platforms already had a "Versions" /
   "Snapshots" section heading with room beside it, so the count sits in the same place on both and
   §4.1 gains no new row.

3. **Does either platform need a follow-up?** No. Admin is deferred for this row as for the rest of
   the B-series; an administrator can still set `maxSnapshotHistory` through the existing
   `monetization.plans` JSON editor, where the description already states that `0` means unlimited
   for every key except `maxCollaborators`.

4. **§2 re-swept.** No row moves. Third time this register records a capability landing on both
   clients simultaneously, after B4 and B6.

5. **Nothing left unrecorded.**

   - **Capture is never plan-gated, and three tests hold that line.** This is the row's one way to
     become a correctness bug rather than a paywall: `SuggestionService.accept` captures a `pre_edit`
     version inside the transaction that settles a suggestion (`f6827e0`), so a refusal on the write
     path would make **accepting a suggestion fail** for a free author. `snapshot.service.spec.ts`
     and `publishing.service.spec.ts` build `SnapshotService` with a history service that throws on
     contact; `suggestion.service.spec.ts` wires a **real** `SnapshotService` into the accept path
     with the same stub, because every other accept test mocks `SnapshotService` and none of them
     would notice.
   - **The sentinel does NOT invert, and the exception list stays at one entry.**
     `maxSnapshotHistory` is `0` = unlimited, the ordinary convention. B6 inverts only because Free
     needs _zero_ seats; B7's Free is 5, so there is nothing for an inverted sentinel to express. The
     likeliest future mistake is "fixing" B7 toward B6 — both read the story owner's plan — which
     would turn Pro and Enterprise into zero-version tiers silently, so one spec asserts from a
     single stored catalogue that `{maxSnapshotHistory: 0, maxCollaborators: 0}` means **unlimited
     history and zero seats**, and another pins `NEGATIVE_UNLIMITED_LIMIT_KEYS` to exactly
     `['maxCollaborators']`.
   - **Revert and get-by-id are gated, not just the list.** Clamping only the list view would have
     left revert an open door for anyone holding an old id — §5.2's shape exactly, and revert is the
     door most worth trying since it is what a version history is FOR. Both refuse below the window's
     floor, and a test asserts the piece is never written on a refused revert.
   - **`MAX_SNAPSHOTS_PER_STORY` (100) still exists** alongside the plan depth, and the two are
     different things: that one is an anti-abuse ceiling enforced by `pruneSnapshots` at capture
     (and it really does delete, keeping `publish`/`review` rows forever), while B7 deletes nothing
     and only decides what is shown. B7 adds **no** pruning, retention, or scheduled work — "hidden,
     never deleted" is the decision, and the storage cost was accepted deliberately.
   - **The api-types guard (§3.11) was checked and is not applicable** — `@qalam/api-types` has no
     publishing namespace, so there is nothing for `SnapshotHistoryDto` to drift from. Same position
     as B4's `PieceLimitDto` and B6's `CollaboratorLimitDto`. The guard's 72 assertions pass
     untouched.
   - **Dark mode.** Mobile asserts `textContrastGuideline` on the offer and the count in both
     brightnesses, plus `labeledTapTargetGuideline` and `iOSTapTargetGuideline`; it hits the same
     app-wide **T-10** 44 px tap height, which stays unowned and is not this row's to fix. Web's new
     markup is `QTokens`-pair based (defined in both themes) and is covered by the existing e2e a11y
     spec for `/write/:storyId/publishing`, which this row extended so the clamped state renders
     during the scan. **No live e2e run was part of this row** — the local run needs Postgres on 5432
     and Redis on 6379, both occupied here by unrelated stacks — so that scan is CI-gated and the
     suite's deferred state is unchanged.

### 6.6 B5's sweep (2026-08-08)

**B5 is the odd one out of the four subscriber features.** B4, B6 and B7 are `PlanLimits` catalogue keys —
numbers, no schema change. B5 is a user preference: one column, one migration, one guard. It is also the
only one of the four whose enforcement point is the AI orchestrator rather than a business service.

1. **Only what the row named?** Yes — the column, the guard, `listFeatureStates`' `userId`, the error code,
   and the switch on both clients. Four things it touched that the row did not name, all consequences
   rather than additions, and all recorded below: `AiFeaturesResponse.userAiEnabled` (without it no client
   can tell the two causes of "off" apart, so the remedy would be wrong — the W4 defect); `resolveAvailability`
   / `useAiAvailability` widened to the `feature: null` question web already had (the editor's AI button
   fronts four surfaces, so gating it on any one flag would hide the other three); a minimal `/settings`
   client on mobile, which had **none** (B5-3 below); and the four unwired gates in step 3, which are the
   substance of this sweep. The privacy module was **not** touched, and no per-controller AI check was
   added anywhere.

2. **Does the other platform have every part I built?** Both were built together, so this is a
   surface-by-surface comparison rather than a port. Same switch, same copy, same distinction line, same
   error vocabulary. **Two arrangement differences**, both §4.1 territory:

   - **Web puts the switch on the existing W8 `/settings/ai` hub; mobile got a new `/settings/ai` screen
     plus a hub tile.** Web already had an account-scoped AI page and mobile did not.
   - **Web renders the AI-search engine toggle even when AI is off** (a documented W5 decision — the
     control renders and the notice behind it explains why), while mobile's AI Search screen now refuses
     outright. Both give the same remedy; only web offers the door first. Left as-is deliberately: web's
     posture is deliberate and documented, and reversing it here would be an unrelated change.

3. **Does the other platform need a follow-up?** No — but only because the sweep's real finding was fixed
   inside this row rather than deferred. **Four AI entry points were gated on something other than the
   server**, so a writer who turned AI off would have kept live affordances into surfaces the server had
   already begun refusing:

   | id       | platform | surface                                   | what it was gated on                                                                  |
   | -------- | -------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
   | **B5-1** | mobile   | AI Discovery hub                          | the COMPILE-TIME `AppConfig.enableAi` alone — never asked the server                  |
   | **B5-2** | mobile   | AI Search screen                          | **nothing** — it had no runtime gate at all                                           |
   | **B5-3** | mobile   | Story Explorer (screen + editor overflow) | `enableAi && isRemote`; the route carries no feature flag, so nothing read the server |
   | **B5-4** | web      | the editor's AI drawer button             | the presence of the panel SLOT — opening a drawer of four notices                     |

   All four are the same class as **R-1 / M5-1 / W5-3 / W8-1**: code that looked wired and was not. They
   were found by opening each entry point, not by reading the gate, which is what §4.10 asked for — and
   B5-2 in particular could not have been found any other way, since there was no gate to read. All four
   are fixed and covered: mobile's editor-overflow and Story-Explorer cases by two new tests in
   `af4_entry_points_test.dart` (affordance **and** deep-link destination), web's by
   `writing-assistant-panel.spec.tsx`.

   Everything else followed with no change, which was §4.10's bet and it held: mobile's
   `AiFeatures.isEnabled()` already ANDs the master value and web's `resolveAvailability` already reads it,
   so one server field turned off the assistant, the coach, Ask My Book, recommendations and "More like
   this" on both clients at once.

4. **§2 re-swept** for the AI area. No row moves: B5 adds a control to both platforms simultaneously, so it
   creates no asymmetry. Row 3 (AI breadth) is unchanged at 7 of 8.

5. **Nothing left unrecorded.** Four defects above, two arrangement differences in step 2, and **three
   unowned findings** this row surfaced but is not fixing:

   - **The `ai_personalization` consent has no client surface on either platform.** `GET/PUT /privacy/consent`
     ships and no screen reaches it — so §4.10's "put the switch next to it" was unachievable as written.
     The "not merged" half was met the only way available: both switches state the distinction in their own
     copy, asserted by a test on each client. Surfacing the consent belongs to **W7**'s privacy-prefs row,
     and when it lands it belongs on the same screen. This is §5.2's shape one layer up — a server capability
     no client can reach — and is recorded here so it is not rediscovered a fourth time.
   - **`migration:generate` emits ~110 statements of pre-existing drift** between entity metadata and the
     hand-tuned SQL of earlier migrations: every FK dropped, both `search_vector` generated columns dropped,
     the trigram and partial indexes dropped. B5's migration was reduced to its one intended statement, but
     the drift is real, it is destructive if applied, and it will meet whoever generates the next migration.
     Unowned; deserves its own row.
   - **Mobile's `/settings` client did not exist** before B5 and is now minimal by design — it reads and
     writes `aiEnabled` and ignores `theme` / `defaultPieceVisibility`, which mobile keeps on-device. Not a
     defect (the on-device choices are deliberate), but it means the preference bag is **not** synced
     cross-device on mobile the way it is on web. Worth knowing before someone assumes `GET /settings` is
     fully consumed there.

### 6.7 B3's sweep (2026-08-08)

1. **Only what the row named?** Yes — the by-id lookup and its adoption on both clients. Two things
   the row did not spell out but could not be delivered without: `shortActorId` moved to mobile's
   `shared/util/` (it lived in a collaboration _entity_ file, which the profile-side widget must not
   import), and web's resolution moved out of `collaborator-identity.tsx` into
   `hooks/use-collaborator-identity.ts` so the presence bar could share it without importing a
   component. No DTO was widened — the alternative fix the row explicitly did not choose.

2. **Does the other platform have every part I built?** Now, yes — and this row is the first where
   **mobile was the platform missing the part**. Web had `CollaboratorIdentity` (a workaround that
   upgraded to a real name only when a username happened to be in context); mobile had nothing and
   printed the id at every site. Comparing surface by surface found **four call sites the row's list
   did not name**: the collaborators member row, its remove/change-role snackbars, the presence bar,
   and publication history. Two were worse than a short id. `PresenceEntry.label` is
   `displayName ?? userId` and `PresenceDto` carries no `displayName`, so a screen reader announced
   the **full raw uuid**. And `PublicationEvent` parsed an **`actorName` the wire has never sent**
   (`PublicationEventDto` carries `actorId` only), so every history row rendered **no actor at all** —
   the C-4 / C-5 / M-1 defect class again, found only because a per-surface comparison was run against
   web, where `publication-history.tsx` already resolved `actorId`. All ten sites now route through
   one provider, and the phantom field is gone.

3. **Does the other platform need a follow-up?** No new client asymmetry. Two unowned findings below.

4. **§2 re-swept** for the collaboration/identity area. No row moves: B3 adds the same capability to
   both platforms at once, so it creates no asymmetry — it closes one that three consecutive epics had
   carried in their "improvements not done" lists.

5. **Nothing left unrecorded.** No new defect. Three things this row surfaced but is not fixing:

   - **`me/blocks` is unpaginated** (`TrustRepository.listBlocks` has no limit), and it is the one
     identity surface whose rows are arbitrary distinct users rather than a story's roster. So its
     lookup cost is the block count, unbounded — 200 blocks, 200 lookups on one screen. Pre-existing
     and not made worse in kind by B3, but B3 is what makes it visible. Deserves its own row, together
     with the batch lookup (`GET /users/by-ids`) the constraint on B3 correctly refused to build
     inside it. Measured numbers and the bounded cases are in
     [45 §4.13](./45_WebClientRoadmap.md#413-b3--profile-lookup-by-id-detail-done-2026-08-08).
   - **A private account's teaser still carries `penName`**, so a stranger resolving a collaborator's
     id learns their display name. That is the _existing_ username-route rule applied unchanged — B3
     deliberately did not touch visibility — but it is now reachable from an id, which is a wider
     surface than before. Not a leak (the same fact was always one `GET /users/:username` away), and
     recorded so it is a decision rather than an accident.
   - **The visual baselines needed a determinism fix before they could be minted.** Resolved names
     replaced fixed-length ids in five baselines; four show the seeded `e2e_writer`, but the blocked
     list showed throwaway users whose pen name defaults to a per-run variable-LENGTH username. Mask
     hides pixels, not boxes. Pinned via `api.setPenName`; the 20 baselines still need a CI mint.

### 6.8 W7a's sweep (2026-08-10)

The conversation layer on web — piece comments + responses ([45 §4.4](./45_WebClientRoadmap.md), W7
rows 1–2; report [53](./53_WebConversationLayerReadinessReport.md)).

1. **Only what the row named?** Yes — the two rows, and nothing from the other four W7 items. Named
   explicitly because each of them sits _physically adjacent_ to what was built and was tempting:
   **clap and report** are W7b even though `report_sheet.dart` lives in the same mobile directory as
   the comment widgets and a "Report" action on a comment row would have been three lines;
   **collections** are W7b; **reader analytics** and **privacy prefs** are W7c; and **@mentions are
   P-2** — `CreateCommentDto` has no `mentions` field, so no field was added and a typed `@handle`
   stays plain text rather than silently notifying nobody.

   Three things W7a touched that were **not** in its row, all consequences rather than additions:

   - **`draftPath()` in `lib/routes.ts`** — the response write flow ends in the editor, and the
     reader may not import `features/writing` (docs/26 §4), so route composition is the way across
     and a route must be named to be composed. Two existing inline `${ROUTES.write}/${id}` templates
     in `piece-row.tsx` now call it; identical output, no behaviour change.
   - **`usePermission()` at app level** — the response write is gated on `piece.create` and web had
     **no** permission helper of any kind: before this, the only occurrence of `PERMISSIONS.*` in
     `frontend/src` was inside a doc comment. It mirrors the server's _rank inheritance_
     (`permission.resolver.ts:50-54`), which is the part a naive `DEFAULT_ROLE_PERMISSIONS[role]`
     lookup gets wrong — that version would hide "Write a response" from every moderator and admin,
     all of whom hold `piece.create` by inheritance. It is a **hint**, never enforcement: a 403 is
     surfaced honestly, since a direct user grant or a customized `role_permissions` row is invisible
     to it (both fail toward under-offering, never toward wrongly granting).
   - **One pre-existing typecheck failure fixed.** `collaborator-identity.spec.tsx` (B3) built a
     `StoryPresence` with `updatedAt` instead of `lastSeenAt` behind an `as` cast, failing
     `tsc --noEmit` for the whole repo on a clean `develop`. Confirmed pre-existing by stashing.
     Fixed rather than worked around, because a gate that is already red cannot verify anything.

2. **Does mobile actually have every part I built?** Compared surface by surface against
   `comments_screen.dart`, `responses_screen.dart`, `comment_tile.dart`, `comment_composer.dart` and
   `response_tile.dart`. Same parts, same vocabulary: paginated top-level list, lazy reply expansion
   driven by `replyCount`, add / reply / edit / delete, tombstone rows, the response list, and
   "Write a response" → `POST` → the returned draft in the editor. **One arrangement difference**
   (inline sections vs two pushed screens) → recorded in §4.1, which is the whole reason that
   section exists.

   **Two things mobile has that web deliberately does not**, both scoped out rather than missed:

   - a **newest/oldest sort toggle** on the comments screen (`comments_screen.dart:35`, `_newestFirst`).
     It is a **client-side sort of the loaded page only** — with cursor pagination that means "oldest
     first" reorders the twenty comments in hand and then appends the next twenty newest below them,
     which is not the sort it claims to be. Porting it would port the bug. Not filed as a mobile
     defect either: it is honest enough on one page of a phone thread, and calling it wrong is a
     judgment W7a should not make unilaterally. Named here so the next epic sees a decision.
   - a **report action** on each comment row — W7b, as above.

   **One thing web has that mobile does not:** the composer enforces `COMMENT_MAX_LENGTH` from
   `@qalam/shared`; mobile hardcodes `maxLength: 2000` in `comment_composer.dart:77`. Same number
   today, two sources of truth. Filed below.

3. **Does mobile need a follow-up?** Yes, one, and it is small: **M7-1** — `comment_composer.dart`
   hardcodes `maxLength: 2000` where `COMMENT_MAX_LENGTH` is the shared constant the DTO validates
   against. It agrees today, so nothing is broken; it is a drift waiting to happen, of exactly the
   class §3.11 closed for `@qalam/api-types`. Unowned; not W7a's to fix (mobile is out of scope for
   this row).

   > **CLOSED 2026-08-17** (`d088d49`) — now `Limits.commentMaxLength`
   > (`lib/shared/widgets/social/comment_composer.dart:83`). **"It agrees today, so nothing is broken"
   > understated it**: P-2 subsequently found these exact two numbers conflated on both clients, an
   > AF6 story review counted against this 2,000 public-piece cap when its real limit is 5,000 (§6.11
   > item 5). An inlined literal is what made the wrong cap read as plausible — nothing at the call
   > site said which one it was. The docblock now names the endpoint, and records that AF6 composes
   > through `MentionField` rather than this widget (verified: `CommentComposer` and `CommentTile`
   > are reached only from `features/social/.../comments_screen.dart`, so the two surfaces share no
   > widget). Two siblings went with it — `collection_form_sheet.dart:93,104` → `Limits.collectionNameMax`
   > / `Limits.collectionDescriptionMax`. Deliberately **not** changed: `report_sheet.dart:127`'s
   > `1000` mirrors `@MaxLength(1000)` on `create-report.dto.ts:25` but has no constant on **either**
   > side to reference, and `semantic_search_screen.dart`'s `120` bounds a device-local saved-search
   > name with no server counterpart.

4. **§2 re-swept.** Row 4 (social depth) closed to **collections only** — comments and responses now
   ship on both clients. Row 4's owner line moved from "unassigned — see §5" to W7, and §5's
   conversation-layer bullet is struck through with the record kept.

5. **Nothing left unrecorded.** One accepted difference in §4.1, two defects in §3.14 (**B4-1**
   closed, **B4-2** open and documentation-only), one mobile follow-up (**M7-1**, above), and the
   **four visual baselines** `frontend-conversation-*` needing a CI mint —
   [53 §5](./53_WebConversationLayerReadinessReport.md). The local run confirmed the config still
   **refuses** to mint them (T-8 holds); a red spec asking for a baseline is the correct state.

### 6.9 W7b's sweep (2026-08-10)

Collections, claps and report on web ([45 §4.4](./45_WebClientRoadmap.md), W7 rows 2–3; report
[54](./54_WebEngagementReadinessReport.md)).

1. **Only what the row named?** Yes — the three items, and nothing from W7c or P-2. Named because
   each was adjacent: **reader analytics** and **privacy prefs** are W7c; **@mentions** are P-2 and
   touch both clients; and **report appeals** (`POST /reports/:id/appeal`) were left alone
   deliberately even though the endpoint sits two lines below the one this row uses — it is
   subject-only, the W7 row says "report", and `reportsApi` therefore has no `appeal` method at all
   rather than an unused one that reads like a live path (the W9 lesson).

   Three consequences rather than additions:

   - **`collectionPath()` + two routes** in `lib/routes.ts` and the router, on the same paths mobile
     uses (`/me/collections`, `/me/collections/:id`), inside `RequireAuth` because every collections
     endpoint is permission-gated and caller-scoped.
   - **An account-menu entry** ("Your collections"), because a route nobody can reach is the R-1 /
     M5-1 defect. Recorded in §4.1 alongside mobile's my-profile placement.
   - **Two W7a tests updated, and one W1 docblock.** `reader-action-bar.tsx`'s comment described
     claps and responses as deferred read-only counts; both deferrals are now discharged, so the
     comment says what is true instead. The two specs asserting "claps render as a read-only count"
     were inverted to assert the button, and the W7a spec asserting a reply carries no buttons now
     distinguishes _no reply affordance_ from _no Report_ (a reply is a comment, so it is reportable).

2. **Does mobile actually have every part I built?** Compared surface by surface against
   `collections_screen.dart`, `collection_detail_screen.dart`, `save_to_collection_sheet.dart`,
   `collection_form_sheet.dart`, `report_sheet.dart` and `reader_action_bar.dart`.

   - **Collections: same parts.** List with per-card rename/delete, the default collection's menu
     hidden, detail with per-piece remove, the save sheet with an inline "New collection" that chains
     create → save, and the create/rename form with name + description + a private toggle.
   - **Report: same parts, same reason catalogue in the same order** (`other` last), one generalized
     control over `ReportEntityType` — which is the whole point, and is why web mounts it in four
     places rather than writing four dialogs.
   - **Clap: mobile has nothing.** The big finding, escalated before any code was written and
     recorded as **M7-3** (§3.15).

   **Two things web has that mobile does not**, both consequences: the clap interaction (above), and
   a `usePermission`-free path — collections gate on the session rather than on a permission hint,
   because the whole controller is permission-gated and a 401 there would bounce a browsing visitor
   (the W5-6 shape, arrived at from the other side).

3. **Does mobile need a follow-up?** Yes — **M7-3** (no clap interaction at all). Unowned, and
   deliberately not taken here: the row's constraint was "do not touch mobile", and unlike W9's two
   follow-ups this one is a feature to build rather than a gate to move. **M7-1** (from W7a's sweep —
   the hardcoded 2000 in mobile's comment composer) is still open too.

4. **§2 re-swept, and one cell CORRECTED.** Row 4 (social depth) closed completely. Row 5 (reader
   actions) was **factually wrong** and now says so: mobile's bar has report and no clap. That is the
   second §2 cell to over-credit mobile (**W8-1** was the first), which makes "do not trust a roadmap
   paraphrase" also "do not trust this document's own cells".

5. **Nothing left unrecorded.** Three accepted differences in §4.1, two defects in §3.15 (**M7-3**
   open on mobile, **W7b-1** open as backend documentation), and **eight visual baselines** needing a
   CI mint — [54 §5](./54_WebEngagementReadinessReport.md). The local run confirmed the config still
   refuses to mint them (T-8 holds).

### 6.10 W7c's sweep (2026-08-10)

The slice that **shrank on contact with the code**, twice — and both reductions are recorded here
rather than in a commit message, which is the whole reason this section exists.

1. **Only what the row named?** Yes, and **less** than its two rows claimed — deliberately, with the
   reasons below. Nothing extra was added: no reading-history store in any form (which would have been
   new product scope contradicting §4's offline-read-cache row), no `@mentions` (**P-2**, both
   clients), no onboarding (still needs a product shape). Three consequences rather than additions:

   - **The reader aggregate was MOVED, not built.** This is the finding that re-scoped row 4. All seven
     `ReaderAnalyticsDto` fields were **already rendering on web** — `reader-insights.tsx`, fed by
     `useDashboard()` through `GET /analytics/dashboard` (which returns `{writer, reader}`). They were
     mounted inside the WRITER dashboard at `/me/stats`, a page headed "Your writing's reach on Qalam",
     including in its no-published-pieces branch. So the gap was **placement, not data**: a reader who
     had never published was sent to a dashboard about pieces they had not written in order to see what
     they had read. W7c gave them `/me/reading`, split the read (`GET /analytics/readers/me` — the
     reader half alone, so a non-writer never fetches writer aggregates), and removed the section from
     the writer page. The row's premise — "web has writer + per-piece analytics only" — was wrong, and
     §2 row 6 now says so.
   - **The writer export was split in two.** `buildExportRows` appended four reader rows to
     `qalam-analytics.csv`; those moved to `qalam-reading.csv` via `readerExportRows`. An export named
     for a writer that silently mixed in what the user had READ was the same audience confusion on
     disk. Both builders moved out of the page components into `lib/export-analytics.ts` — where they
     are directly unit-testable, and where a page component no longer exports a non-component.
   - **The account-menu label changed.** "Your stats" → "Your writing's stats", so the two adjacent
     entries name their audiences. Recorded in §4.1; it is the smallest part of this slice and the
     part that actually prevents the confusion recurring.

2. **Does mobile actually have every part I built?** Compared against
   `reading_analytics_screen.dart`, `reader_analytics.dart` and `reading_analytics_controller.dart`.
   **Mobile has MORE, and most of it is not portable** — this is the second reduction:

   - **Same parts, backend-fed:** pieces read, reading time, completed reads, current + longest streak,
     favourite genres, favourite languages. All seven ship on web, `label` rendered and `key` used as
     the key.
   - **Mobile also folds in a bookmarks count**, and this one WAS portable — see the verdict below.
   - **Three cards are device-local and will never ship on web:** Continue Reading, Recently Read,
     Weekly Activity. All three read `readingHistoryStoreProvider.readAll()`, a local Hive store; the
     frozen `v1` has **no reading-history endpoint**, because history is client-local by design (the
     controller's own docblock: "LOCAL-FIRST by design… reading history is the user's own device
     data"). **Recorded as platform-inherent in §4**, with the reason, not left as an unexplained
     absence for the next epic to rediscover.
   - **Mobile degrades to local data on a backend failure; web cannot.** With no local store there is
     nothing to degrade to, so `/me/reading` shows an **error with a retry** instead. It does not fall
     back to zeroes — a fabricated zero is indistinguishable from a real one, which is the rule
     `profile-stats.tsx` already documents. Asserted in both the unit spec and the browser spec.
   - **A new reader's zeroes are TRUE and therefore render.** Unlike the profile counts (hardcoded `0`
     server-side, correctly omitted), zero pieces read means the reader has read nothing. The page is
     never hidden for being empty — asserted with a throwaway verified account in
     `reading-stats.spec.ts`.

   **The bookmarks-count verdict (row 4's one open question): INCLUDED, as a bounded count.** The
   prompt was right to suspect two different endpoints, and there are:

   |                                      | Endpoint                      | Real for the viewer?                                                                                                                               |
   | ------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `ProfileCountsDto.bookmarksReceived` | part of `GET /me`             | **No** — `profile.service.ts:257-261` hardcodes it to `0` (docs/26 §11 gap #3). This is what `profile-stats.tsx:6-11` correctly refuses to render. |
   | `GET /me/bookmarks`                  | `reactions.controller.ts:130` | **Yes** — viewer-scoped, cursor-paginated, real rows. Web had no consumer before W7c (`use-engagement.ts:80` said so).                             |

   So the count is included — but `v1` exposes no `COUNT(*)`, so like mobile it is derived from ONE
   `limit=50` page and is therefore **bounded**: rendered `50+` when `hasMore`, exact otherwise, and
   labelled "Bookmarks (at least)" in the export. A bare `50` would read as a total. When its
   (separate) read fails the tile is **absent rather than zero**, and the seven real figures still
   render — it is an augmentation, not one of the row's fields.

   **Row 5 was CLOSED WITHOUT CODE.** Mobile's privacy screen has three controls and its own docblock
   says only one is server-backed: `isPrivate` via `PATCH /me` — **which web already shipped** at
   `edit-profile-page.tsx:253`. The other two are local display gates over counts that the frozen
   `v1` never exposes cross-user and that web does not display at all. There was nothing to build, and
   building a toggle to hide a figure web does not show would have been the wrong kind of parity. §2
   row 8 is closed by evidence; the arrangement difference (dedicated screen vs. a section of
   edit-profile) is in §4.1.

3. **Does mobile need a follow-up?** **No — nothing new.** Neither reduction creates a mobile gap:
   mobile has strictly more here, and the extra is platform-inherent rather than a web debt. The
   pre-existing follow-ups are untouched and still open: **M7-3** (no clap control) and **M7-1** (the
   hardcoded 2000 in the comment composer). W7c did not touch mobile at all, per its constraint.

4. **§2 re-swept.** Rows **6 and 8 both closed** — 6 as a deliberate PARTIAL port (the portable half,
   with the local half in §4), 8 as closed-not-built. That leaves **row 7 (onboarding) as the only §2
   row with no owner**, and §5 was rewritten to say exactly that instead of listing five items that
   have since closed.

5. **Nothing left unrecorded.** Two new platform-inherent rows in §4 (the three local-history cards;
   the local content-privacy toggles), two new accepted arrangement differences in §4.1 (reader
   analytics entry point + the relabelling; where the one real privacy toggle lives), **no new
   defects**, and **one visual baseline needing a CI mint** — `frontend-reading-stats.png`, which only
   the `web-e2e` workflow's visual job may produce, in the pinned image (§3.5 **T-8**; docs/e2e/10
   §8.3). It was deliberately NOT minted locally, and "a snapshot doesn't exist" is the correct local
   result until that job runs.

---

### 6.11 P-2's sweep (2026-08-17)

The **only §5.1 gap that was open on BOTH clients**, and therefore the only row in the W-track where
there was no reference implementation to port from — both halves were written against the backend
contract on the same day (web `7ff62d4`, mobile `738c8d9`). That is also why this sweep matters more
than most: with no reference, a divergence between the two clients could not be caught by comparing
one to the other, only by pinning both to the server's regex.

1. **Only what the row named?** Yes. @mentions in the AF6 story-review composer, on both clients, and
   nothing else. No notification-preference surface (mentions ride the existing
   `NotificationType.CommentMention`, which already shipped), no mention support in the **piece**
   comment composer (a different endpoint with no `mentions` concept — see the constant defect below),
   and no onboarding. One thing was added that the row did not name, and it is recorded in §3 rather
   than hidden here: **M7-1's constant**, because P-2 could not have been written correctly without it.

2. **The wire format, which is the whole reason this was not a text-field feature.** A mention is
   stored as `@<uuid>` **inside the comment body**. `CommentService.parseMentions` re-derives
   `mentions[]` from the body with its own `MENTION_UUID_RE` (`comment.service.ts:46`), so **the body
   is the mention** and the DTO's `mentions` array only states client intent. The format was chosen
   because it is **rename-proof**: the stored token points at a _person_, and the name is resolved
   fresh at render time rather than frozen into prose that goes stale.

   The cost is that a raw body is unreadable — 37 characters of hex where a name belongs. So neither
   composer ever shows one. The writer types and edits **handles**, and exactly one pure module per
   client owns the translation:

   |         | Web                                                       | Mobile                                                      |
   | ------- | --------------------------------------------------------- | ----------------------------------------------------------- |
   | module  | `frontend/src/features/collaboration/lib/mention-text.ts` | `lib/features/collaboration/presentation/mention_text.dart` |
   | display | `"nice catch @farheen"`                                   | same                                                        |
   | raw     | `"nice catch @550e8400-…-446655440000"`                   | same                                                        |

   Both modules are **pure** — the round-trip is unit-testable without a textarea or a widget, which is
   the property that lets the two clients be pinned to the same behaviour without an E2E run. The two
   `MENTION_UUID_RE` / `mentionUuidPattern` regexes are deliberately character-identical to the
   server's. **If these three ever disagree, one client counts and renders a set of mentions the
   server does not notify, or the reverse** — so a change to any one of them is a change to all three.

3. **Why a handle and not a pen name.** The reverse mapping (display text → ids) has to be **total**,
   and a pen name breaks it twice: pen names are **not unique** — two collaborators called "Ali" are
   indistinguishable when turning display text back into ids — and they **contain spaces**, so there is
   no token boundary to find one by. A username is unique platform-wide and drawn from `[a-z0-9_]`
   (`Patterns.username`), which makes both the tokenizer and the reverse map exact. It is also what
   people actually type.

4. **Why the candidate set is the story roster and NOT `GET /users/:username` — a safety decision, and
   a correction to §5.1's stated shape of the work.** The row proposed "the same lookup the invite
   dialog uses, applied inline". **That could not be used**, and the audit that found this is the
   fourth time a §5/§2 cell has been corrected on contact with the code (cf. **W8-1**, **M7-3**,
   **W7c**).

   `CommentService.notifyComment` notifies **every id it is handed, with no access check of any kind**
   (`comment.service.ts:250-270` — verified 2026-08-17; the policy `assert` above it authorizes the
   _commenter_, never the _mentioned_). So whatever a composer is willing to resolve is, in effect, the
   set of people who can be notified about a private story. `GET /users/:username` resolves **anybody
   on the platform** — precisely the id a mention must never be able to carry. Mentioning a stranger
   would tell them a story exists, who is discussing it, and hand them a notification linking to a
   comment they cannot open.

   Candidates therefore come from `GET /stories/:id/members` — exactly "people who can see this story".
   The endpoint synthesises the **owner** row from the piece author before appending collaborators
   (`membership.service.ts:102`), so author + members needs no second request and no client-side union.
   What **is** reused from the invite flow is the _lesson_ of **M-1** — a mention is an id, and the
   writer confirms a person before one is sent — not its endpoint.

   Two consequences worth stating: a roster that cannot be read means **no typeahead, not a broken
   screen** (the composer still posts plain text), and the **viewer is not filtered out** — "as @me
   noted above" is legitimate prose, and the server drops self-notification anyway
   (`comment.service.ts:259`).

5. **The constant defect P-2 found, which is a real bug and not a tidiness note.** Both composers were
   counting the story-review body against the **2,000-character engagement comment cap**. That is the
   wrong endpoint's limit. AF6's private story review is `MAX_COMMENT_BODY_LENGTH` in `@qalam/shared`
   `collaboration.ts` — **5,000** — while 2,000 is `limits.ts`'s cap on a **public piece comment**.
   The two had been conflated. Mobile had no mirror of the larger constant at all, so
   `Limits.storyCommentBodyMax = 5000` was added (`lib/shared/domain/limits.dart:24`) with a docblock
   naming which endpoint it belongs to, sitting directly beneath `commentMaxLength = 2000` with the
   distinction spelled out. The visible symptom was a composer refusing a review the server would have
   accepted — a false rejection, silently, at 40% of the real limit.

6. **The counter counts the RAW body, not what is on screen.** `@MaxLength` is applied server-side to
   the **raw** string, where every mention is 37 characters rather than the handle's length. A counter
   over the display text would tell the writer they had room and then take a `400` — the failure is
   invisible until submit, and worse the closer a body gets to the cap. Both clients therefore length-
   check through `rawBodyLength` / `rawCommentBodyLength`, and both have a spec that pins exactly this
   ("counts the RAW body, so a comment the server would reject is caught here").

7. **Do the two clients actually match?** Compared function by function: same regexes, same function
   names, same round-trip semantics, same raw-length rule, same roster source, same never-throw
   behaviour on an unreadable roster. **One deliberate difference**, and it is platform-inherent rather
   than a gap: web's typeahead is keyboard-first (Enter selects, Escape leaves plain text — asserted in
   `comment-composer.spec.tsx`), mobile's is a tap target list. Not recorded in §4.1 because "a
   keyboard affordance on the keyboard platform" is not a feature difference.

8. **Verification.** Both repos' full gates were run for the first time on this row — P-2 had shipped
   with only its own new spec files run, which its commit messages stated. Mobile: `dart analyze` clean,
   **772 passed / 1 skipped**, and the nine P-2 files format-clean. Web: `tsc --noEmit` clean, `eslint
--max-warnings=0` clean, **135 files / 893 tests passed**, including `mention-text.spec.ts` (21) and
   the six `CommentComposer — mentions` / `CommentThread — mentions in a reply` cases. **No failures,
   so no fix commit.**

   > **The whole-tree `dart format` is not a valid mobile gate**, and this is the second time it has
   > been attempted. The repo's baseline predates Dart's tall style and configures no `page_width`, so
   > `dart format .` rewrites ~124 unrelated files and reports "changed". The gate is `dart format
--set-exit-if-changed` **over the commit's own files**; a whole-tree reformat must never be
   > committed.

9. **Does mobile need a follow-up?** **No new one.** The two pre-existing mobile follow-ups from
   §6.10 are unchanged in kind, and both are closed by this session's later phases: **M7-1** (the
   hardcoded 2000) and **M7-3** (no clap control). Nothing P-2 built creates a gap on either client —
   it is the rare row where both sides shipped together, so §5.1 closes rather than moving.

---

### 6.12 M7-3's sweep (2026-08-17)

The **reverse-direction** row — the only one in the W-track where web was the reference and mobile
did the porting. That inversion is the reason this sweep's second question is the interesting one.

1. **Only what the row named?** Yes — the clap, on mobile, and nothing else. No change to the web
   clap (web is the reference for this row; porting revealed no web defect to record). No new or
   changed backend endpoint — the contract was already shipped and frozen, and it was sufficient.
   Nothing from B2, W6 or onboarding.

   One thing was added that the row did not name: **a `ref.onDispose` on the engagement controller**,
   because the port surfaced a real leak (§3.15, last paragraph) that the debounce made reachable.

2. **The audit ran BEFORE any code, and it confirmed the row rather than correcting it.** Worth
   recording precisely because the previous three attempts went the other way — **W8-1**, **M7-3**
   itself and **W7c** each found a §2/§5 cell that misdescribed a client. Six claims were checked
   against the mobile tree and all six held: no clap gesture anywhere (31 files mention "clap", every
   one read-only), no `pieceClaps` path and no clap method on the repository, `claps` + `clapCount`
   already arriving and already decoded on the entity, the 50 cap and `CLAP_LIMIT_REACHED` already
   mirrored, and `_guarded` already gating every action on the bar. **A register cell being right is
   not the default here, so it is worth writing down when it is.**

3. **Does web actually have every part mobile built?** This is the question the reverse direction
   makes non-trivial, and the answer is **no — mobile has strictly more, and the extra is
   platform-inherent**, the same shape §6.10 found for reader analytics:

   - **Same four properties**, ported unchanged: accumulate optimistically, one request per burst,
     clamp at the cap with a no-op tap (never an error), all-or-nothing removal.
   - **The debounce window is deliberately IDENTICAL at 600 ms.** This is recorded as a
     _non_-difference on purpose. Web justified 250 ms–1 s for a mouse; the lower bound holds **more**
     strongly under a thumb, which repeats faster than a pointer that has to stay still between
     clicks, and the upper bound is if anything tighter on mobile because everything inside the window
     rides on a lifecycle callback that a force-stop can skip. A divergence here would have been easy
     and wrong.
   - **Mobile queues an offline burst; web cannot.** Web has no offline write story by design
     (§4, "Partly inherent") and `use-claps`' own docblock says porting mobile's `SyncEngine` was out
     of scope. Recorded in §4.1 with its reason rather than left as an unexplained asymmetry.
   - **Two arrangement differences**, both in §4.1: removal lives in mobile's More sheet rather than
     inline, and the flush hooks are each platform's name for the same event.

4. **Nothing about what a clap MEANS was invented.** The debounce window, the outbox behaviour and
   the merge semantics are engineering calls and are argued from the contract and the platform. The
   cap, the accumulation, the all-or-nothing removal and the notification type all came from the
   frozen `v1` contract. Where the contract was silent — what a merged queue should do — the decision
   is written into the handler's docblock **with its cost**, not just its conclusion.

5. **§2 re-swept.** **Row 5 is now true.** It has carried a `CORRECTED 2026-08-10` note since W7b
   caught it crediting mobile with a clap it did not have; that note is **kept** and the row now
   records both dates. Deleting it would erase the more useful fact — that a §2 cell was wrong for
   long enough to nearly cause a one-sided build — in favour of the less useful one, that it is right
   today. **Row 7 (onboarding) remains the only §2 row with no owner.**

6. **Nothing left unrecorded.** One §3 finding closed (**M7-3**, with file:lines and the two outbox
   decisions), one §4.1 row rewritten from "a tracked gap" to three accepted differences with reasons,
   one §2 cell moved to true-with-history, **one defect found and fixed in flight** (the autoDispose
   timer leak), and **no new open defects**. No new mobile readiness report: this is one control on
   one bar against an existing reference, and §3.15 plus this sweep hold everything a report would —
   a fourth document would dilute rather than add.

---

### 6.13 D3's sweep (2026-08-17)

The first row in this track that is a **product decision made real rather than a feature ported**, and
the only one whose deliverable is a capability being **taken away**. Both clients moved together, so
there is no follow-up on either — but the answer to question 1 below is where the interesting part is.

**What shipped**, four commits, one per layer:

| Layer             | Commit    | File:line                                                                                                                                                                                   |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Map + server gate | `bda3f08` | `packages/shared/src/ai.ts` (`AI_FEATURE_PREMIUM_CODE`, `premiumCodeForAiFeature`, `AI_FEATURE_PREMIUM_CODE_IS_TOTAL`) · `backend/src/modules/monetization/ai-usage-meter.service.ts:53-81` |
| Deployment audit  | `390c1ac` | `backend/src/modules/monetization/monetization.config-service.ts` (`auditEnforcedPaidFeatures`, `onModuleInit`, `driftedPaidEntitlements`)                                                  |
| Web               | `af8448f` | `frontend/src/lib/ai-availability.ts` (`upgrade-writing`) · `frontend/src/app/routes/write.tsx` (the gate) · `writing-assistant-panel.tsx` (`writingGate`)                                  |
| Mobile            | `a826103` | `lib/features/ai/domain/value_objects/ai_feature_ids.dart` (the Dart mirror) · `panels/writing_assistant_panel.dart`, `panels/craft_coach_panel.dart` · `widgets/ai_writing_lock_card.dart` |

**Gates.** Backend 146 suites / 1216 tests, frontend 136 files / 906 tests, both `pnpm typecheck` and
`eslint --max-warnings=0` clean. Mobile 814 tests (was 801 after M7-3) + 1 skipped, `dart analyze`
clean.

#### The map, and why it stops where it does

`AiFeature → PremiumFeature | null`, in `@qalam/shared` beside `AiFeature`, mirrored in Dart for the
Flutter client. **Five** features are sold behind `ai_writing`: `writing_assistant`, `craft_coach`, and
the three vestigial AF1 codes (`grammar`, `rewrite`, `summarization`) which have no caller and are
mapped for totality. Everything else maps to `null`, each for its own reason:

- the five AF3 analyses and the three AF4 surfaces belong to **D4**, deferred — §5.2 consequence 1
  still forbids gating them, and doing so would pre-empt a decision nobody has taken;
- `moderation` and `playground` are infrastructure, not a sold capability;
- the six reserved codes have no caller, no flag and no product scope. ⚠️ **`expand` and `shorten` read
  like writing and are deliberately NOT mapped to it** — the assistant's own expand/condense actions
  are prompt keys under `writing_assistant` and are already gated. Whoever gives one of those codes a
  real caller must revisit that row rather than inherit `null`.

**Totality is the load-bearing part.** The map is declared with `satisfies Record<AiFeature, …>` rather
than a `Record<>` annotation, which keeps `keyof typeof` as the literal keys so the mutual-extends
assertion beside it is a real check and not a tautology; adding an `AiFeature` without a row fails
`pnpm typecheck` in three places. `@qalam/shared` has no test runner — it is pure vocabulary — so
typecheck **is** its suite, and that is where the pin belongs. Dart has no equivalent for a `Map`
literal, so `aiPremiumMapIsTotal()` stands in for it and the mobile suite asserts it. The direction
matters more than it looks: a future AI feature that forgets to declare itself must fail loudly, never
default to free.

#### DECISION §2 — free KEEPS `ai_budget`, and §5.2's premise was wrong

§5.2 item 4 called free's allowance "an allowance that cannot be spent" and asked for it to be removed
or zeroed. **That was written before AF4 shipped and is no longer true.** Verified in the code rather
than reasoned about:

- `ask_book` → `ask-book.service.ts:49-51` calls `AiCompletionService.complete()`, which meters via
  `AI_USAGE_METER` → `assertAllowed(AiBudget)`. Live on both clients (`use-ask-book.ts`,
  `ask_book_screen.dart`).
- `semantic_search` with `synthesize: true` → `semantic-search.service.ts:88-90`, same path. Live on
  both (`ai-search-panel.tsx:35`, `semantic_search_controller.dart`).

So free's budget **is** spendable. Removing it would deny free users every metered AI feature — far
wider than D3 decided, and a silent pre-emption of D4. Zeroing the token limits instead would route the
refusal to `QUOTA_EXCEEDED` ("wait for a reset that never helps"), which is the **§3.6** conflation
defect committed again. Free therefore keeps `ai_budget` and loses only writing.

**One correction to the brief's own framing, recorded because it is the kind of thing that rots:**
`recommendations` does **not** meter — `recommendation.service.ts` has zero `completion.` calls and only
asserts the AI feature flag. It is two of the three AF4 consumers, not three. The conclusion is
unchanged; two live spenders are enough.

#### The two traps, and how each was closed

**TRAP 1 — a code-only catalogue change is inert on existing deployments.** It does not bite D3, and
that is the finding rather than a migration. `mergePlans` spreads a stored tier wholesale (only `limits`
merges per key) and settings rows insert with `orIgnore()`, so a stored `features` array shadows the
compiled default forever — the class that caught B4's `maxPieces`. But under DECISION §2 free's compiled
default is **already** exactly `[ai_budget]` and stays that way, so there is no catalogue edit for a
stored array to shadow. The regression rides entirely on the gate, which is code and is therefore live
on every deployment the moment it deploys. Pinned by a test that starts from a stored pre-D3 catalogue.

**The inverse IS real, and it is the failure that actually hurts:** a paid tier missing `ai_writing` now
denies a PAYING subscriber. No seeded install can be in that state — `monetization.plans` was born with
`ai_writing` on plus/pro/enterprise in the same commit that created the setting (`14b8bec`, verified in
the introducing diff), so only a hand edit produces it, and it was harmless until this commit.
`auditEnforcedPaidFeatures` reports it at boot and **deliberately does not repair it**. Where the two
constraints conflict — "a stale seed must end up correct" against "an admin's edit must not be silently
overwritten" — the admin's intent is privileged, because a stored array replaces rather than merges and
a stale seed is therefore **indistinguishable by inspection** from a deliberate removal. Healing one
would silently overwrite the other, so the dangerous state is made loud instead. The enforced-code set
is derived from the map rather than listed, so D4 will widen this audit rather than leave it stale.

**TRAP 2 — a naive gate takes AI writing from EVERYONE when payments are dark.** Entitlement resolution
answers even with `feature.payments.enabled` down and degrades to deny, so with payments dark nobody
holds a subscription, everyone resolves to free, and a gate that ran anyway would wall every user. The
gate sits **behind the meter's existing early return**, inheriting the convention rather than restating
it, and a test with the flag off proves a free user still gets AI writing.

#### Where the gate lives, and the one arrangement difference between the clients

Server-side it is in `AiUsageMeterService.checkQuota`, not `AiFeatureService`: it is the one place every
AI request already passes through carrying its `feature` (`prepare()` feeds both `complete()` and
`stream()`, so neither can bypass it), the AI module must never import monetization (that inversion is
the whole reason the `AI_USAGE_METER` seam exists), and TRAP 2 comes for free. The cost is that a
refusal arrives after context assembly and prompt render; it spends no provider tokens, which is the
part that matters. Both entitlement asserts run **before** `assertWithinQuota`, so an unentitled writer
gets `ENTITLEMENT_DENIED` and never `QUOTA_EXCEEDED`.

Client-side both use their OWN existing `PremiumGate` on the entitlements snapshot they already read —
no new endpoint, and `GET /ai/features` untouched. **They differ in how the gate reaches the panel, and
the reason is a web-only rule:**

|       | Web                                                                                                                                                                  | Mobile                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| How   | `app/routes/write.tsx` passes a `writingGate` render-prop into the panel                                                                                             | the panels import `PremiumGate` directly                                  |
| Why   | a feature may never import another feature (docs/26 §185) — the same rule that made `upgrade` reactive-only until now, and that puts the editor↔AI seam at app level | mobile has no such rule; `features/writing` already imports `features/ai` |
| Scope | only the Assistant and Craft Coach **tabs** — Explorer and Ask are untouched                                                                                         | only the two AF2 **panels**                                               |

The web prop is **required rather than optional-with-a-default**, on purpose: an omitted gate would
silently serve AI writing to a free user, so forgetting it is a compile error. It caught the existing
panel spec immediately. Mobile's equivalent is that `PremiumGate` fails closed, which caught the
existing prompt-library test — hence `buildTestContainer`'s new `entitlementSnapshot` parameter.

#### The fourth remedy

There are now four ways AI can be off and each has a different fix. The new one is its own state
(`upgrade-writing` on web, `AiErrorCopy.aiWritingLocked` on mobile) rather than a reword of the existing
`upgrade`, and both clients pin all four apart by test:

| Code                                      | State                 | What it says                     | Remedy                      |
| ----------------------------------------- | --------------------- | -------------------------------- | --------------------------- |
| `AI_DISABLED`                             | `off`                 | an admin turned the platform off | nothing the user can do     |
| `AI_DISABLED_BY_USER`                     | `self-off` (B5)       | they turned it off               | turn it back on in settings |
| `QUOTA_EXCEEDED`                          | `quota`               | out of budget                    | wait, or top up             |
| `ENTITLEMENT_DENIED` on a writing feature | **`upgrade-writing`** | AI writing is on Plus and above  | see plans                   |

It is split from `upgrade` because the two denials name different things: `upgrade` means the account
has no AI allowance **at all**, while this one means the allowance is intact and only writing is sold
separately. Telling a free writer "your plan doesn't include an AI allowance" would be **false** as well
as the wrong remedy — they can still run AI search and Ask My Book. The copy is resolved from the same
`AI_FEATURE_PREMIUM_CODE` map the server gated on, not from the 402's `details`, so it cannot drift from
the decision and needs no extra plumbing through either client's stream store.

**The mid-flight path carries equal weight**, because the gate cannot cover the window between a page
load and a generation: the entitlement can be revoked, or the payments flag raised, in between. Both
clients map the 402 on the **streaming** path as well as the plain one, and render the identical notice
the gate's locked slot shows — a writer walled on open and one walled mid-generation are in the same
situation and must not be told two different stories.

#### What D4 still owns

Everything past `ai_writing`, unchanged by this row except that it now has a floor rather than a
blocker. The six codes — `ai_discovery`, `premium_search`, `premium_recommendations`,
`story_intelligence`, `advanced_analytics`, `publishing_pro` — are still computed and asserted by
nothing, `PolicyEngineService.isEntitled()` still has zero callers, and **consequence 1 of §5.2 still
forbids either client from gating them.** Both clients carry a test proving a free user can still use
`ask_book`, and the server carries one proving the same at the meter — three regression tests against
scope creep, in the place each would first go wrong. The five AF3 analyses have a complete backend and
no client, so D4's answer for them is still a client question as much as an enforcement one.

**Parity check.** Question 3 — does the other platform need a follow-up? — is **no** for the first time
in several rows: both clients shipped in the same session against the same server change, with one
recorded arrangement difference (how the gate reaches the panel, above) that is inherent to web's import
rule and not a gap. §5.2 item 4 is rewritten; §5.1's remaining row is untouched by this.

---

### 6.14 A1's sweep (2026-08-17)

The first **Track A** row, and the first in this document with no client counterpart to check — see the
parity question below, which is answered rather than skipped.

**What shipped**, three slices, one commit each:

| Slice   | Commit    | Routes                                                         | Endpoints consumed                                                                                     |
| ------- | --------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **A1a** | `f8644ea` | `/billing/plans`, `/billing/entitlements`                      | `GET plans` · `GET/PATCH config` · `GET overrides/:userId` · `POST overrides` · `DELETE overrides/:id` |
| **A1b** | `ea3335d` | `/billing/coupons`, `/billing/actions`                         | `GET/POST coupons` · `PATCH coupons/:id` · `POST credits/adjust` · `POST payments/:id/refund`          |
| **A1c** | `7ae5ca9` | `/billing/revenue`, `/billing/subscriptions`, `/billing/usage` | `GET analytics/revenue` · `…/subscriptions` · `…/usage`                                                |

**Gates.** Admin `pnpm typecheck` clean · `eslint --max-warnings=0` clean · **61 files / 259 tests**
(baseline 53 / 156, so +8 files / +103 tests) · `pnpm build` clean. E2E: 17 new functional tests in
`tests/admin/monetization.spec.ts`, one new RBAC test in the existing `rbac.spec.ts`, three new a11y
scans in the existing `a11y.spec.ts` — 47 tests in `admin-chromium` (was 29), 14 in `admin-dark` (was 8).

#### Did the row deliver only what it named?

Yes, with three additions the audit forced and one it declined.

**Added, because the audit found an asymmetry the brief's destructive-action list missed:** a `deny`
entitlement override confirms like a revoke. An override outranks the plan in **both** directions
(`entitlement.service.ts:177`), so denying a code a subscriber's tier includes removes access they paid
for — the same consequence as a revoke, under a button labelled "grant". The brief listed refund, credit
deduction, override revoke and config patch; this is a fifth.

**Added:** each premium code is marked enforced or not. Exactly two are asserted by a route today —
`ai_budget` and, since D3 (2026-08-17), `ai_writing`. Granting one of D4's six changes nothing, and an
operator should learn that from the screen rather than from a ticket about a grant that "did not work".

**Added:** `RequirePermission`, a route guard beside `RequireRole`. See the nav/guard note below.

**Declined:** a generic coupon edit modal. `PATCH coupons/:id` accepts four fields; A1b ships the
activate/deactivate toggle because a coupon leaking discounts needs stopping now, while editing a value
mid-campaign changes what earlier redeemers got versus later ones. The other three fields are one form
away whenever a row asks for them.

#### What the audit corrected

**The count is 14, not 15.** The brief said "Fifteen shipped endpoints" and "every one of the 15"; its own
anchor table listed 14, and `grep` on the controller returns 14 route decorators. Every line number in
the brief matched, so the anchors were right and only the total was wrong. Track A's remaining rows should
not inherit the figure.

**Nav items gate by `minRole`, not by a `permission` field.** The brief described items as
`{ label, to, icon, permission }`; they are `{ key, label, path, icon, minRole }`. `billing.*` is granted
to `Role.Admin` and `SuperAdmin` only, so `minRole: Role.Admin` selects exactly the viewers who hold
`billing.manage`, and `usePermissions().can()` reads the same grant map — the two are not independent
sources of truth. So the nav keeps its shape and the **routes** got
`RequirePermission(PERMISSIONS.BillingManage)`, which names the check the server actually makes and would
follow the grant map if `billing.*` ever moved off Admin. Rewriting all 30-odd nav entries inside a
monetization row would have made the diff mostly unrelated churn.

**31 route modules, not 30** — which is what §5 of docs/45 already said.

**Six backend gaps, recorded in §3 as A1-1 … A1-7 and none fixed.** Three of them changed what A1 could
build, and are the honest limits of this row:

1. **No admin route reads a subscription** (A1-7). The row's premise was "an operator cannot see a
   subscription"; that is still true for a single account, because the endpoint does not exist. A1c is
   aggregate-only and says so on the page.
2. **No admin route reads a credit balance** (A1-3), and a deduction **clamps at zero** rather than
   erroring. Together these make the brief's "confirmation states the resulting balance" unbuildable
   honestly, so the confirmation states the delta and the floor — both certain — and the response's
   post-clamp figure is reported afterwards. An invented projection is the kind of number an operator
   reads back to a customer.
3. **Nothing lists payments** (A1-5), so refunds are id-in by necessity.

Also: `PATCH config` writes 4 of 7 fields (A1-2), the coupon response drops 3 fields the create DTO
accepts (A1-4), revenue sums across currencies (A1-6), and `PAYMENT_NOT_FOUND` covers a payment that
exists but cannot be refunded (A1-1).

#### The plan catalogue, and the two readings a plain table gets wrong

B4, B6, B7 and D3 all resolve their behaviour out of `monetization.plans`, which makes this the
consequential screen of the row.

**The sentinel.** `0` means unlimited on every limit key except `maxCollaborators`, where `-1` is
unlimited and `0` is a real, sold zero. A table rendering one convention across all keys shows Free as
having _unlimited collaborators_ — the exact inverse of what B6 sells, with green tests and no error. The
reading is delegated to `resolvePlanLimit`, the shared reader that is the single place the two conventions
are reconciled, and the convention is printed **at every field**, including the ordinary ones: a note that
appears only on the odd key reads as decoration, and a rule an operator must hover to find is a rule they
will act without.

**Provenance.** `GET plans` returns the resolved catalogue and says nothing about which numbers an admin
chose, so default-vs-override is derived against the same `DEFAULT_PLAN_*` constants the server compiled
from. Deliberately **weaker for `features` than for limits**: `mergePlans` merges `limits` per key but
spreads the rest of a stored tier wholesale, so a stored feature array REPLACES the compiled one and no
per-code provenance exists to report. The UI answers at array granularity and says why, instead of
decorating codes with a precision the wire cannot support.

**No admin writer exists** for the catalogue (`updatePlans` is unexposed), so the screen is read-only and
every tier links to the Settings surface that owns the JSON.

#### Empty states, and not fabricating a zero

All three analytics endpoints compute on read from append-only ledgers, so a young install returns a
complete response full of zeroes. Rendering it is the **W7c** defect: a fabricated zero reads as a
measurement and cannot be told apart from a real collapse. Each dashboard therefore withholds its figures
entirely and says why, keyed off a **count** rather than a sum — a sum of zero is ambiguous, a count of
zero is not. Two rules are more careful than the obvious version:

- **Subscriptions** keys off `byStatus` having no rows, not `activeCount === 0`. An install whose only
  subscriptions are cancelled has real history and zero active ones; that is a churn event worth seeing,
  and flattening it to "no data" would hide it.
- **Usage** requires no feature rows **and** no tokens. A provider that reported no token counts still
  produced attributable spend.

The E2E spec asserts the exclusive-or directly: a dashboard shows figures or the empty state, never both.

#### Does any other client need this?

**No, and admin has no mobile counterpart — stated explicitly rather than left unaddressed.** This is the
first row in this register where the parity question has a structural answer instead of a follow-up:
`billing.manage` is an operator permission, the mobile app ships no admin surface at all, and the web
frontend is the _customer_ side of monetization (W4 shipped its five screens). So there is no second
platform on which any of this could exist, and no §3 row is owed. The register's step-3 question is
answered "not applicable, by construction" — the only such answer so far, which is why it is spelled out.

**Two visual baselines are pending**, and deliberately unminted here: `admin-billing-plans.png` and
`admin-billing-actions.png`, across all four admin projects (chromium / firefox / webkit / dark). Only the
web-e2e workflow's visual job may mint a baseline, in the pinned image
([e2e/10 §8.3](./e2e/10_UIQuality.md)) — a locally produced PNG bakes in this machine's fonts and fails in
CI forever. Determinism was checked FIRST, which is why it is two files and not seven: the three
dashboards and the coupon list all vary with data other specs in this suite create under
`fullyParallel`, and masking cannot save them because the empty-vs-populated branch changes the page's
STRUCTURE and therefore its height, not just its numbers. Entitlements has nothing to show until an id is
typed.
