# 48 — Platform Parity Register (web ↔ mobile)

**Status:** 🔒 Binding · **Owner:** every client epic · **Last swept:** 2026-07-29 (after **W4** on web —
row 2 of §2 closed, five contract findings in §3.6, two mobile follow-ups in §3.7; earlier the same day
after W3a + the W-1 port and the M-1 fix on mobile, **W3c-1 and W3c-4 closed** — §3.4)

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

| #   | Area                  | Mobile has                                                                                                               | Web has                                                                             | Closed by                                                                                                                 |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Collaboration**     | 6 screens: collaborators, comments, invitations inbox, publishing workflow, restricted state, suggestions                | nothing                                                                             | **W3**                                                                                                                    |
| 2   | ~~**Monetization**~~  | 5 screens: plans, subscription, billing history, credit dashboard, usage dashboard                                       | ✅ **all five** (W4) — plus a coupon field and two history tabs mobile lacks (§3.7) | **W4 ✅ closed 2026-07-29** — [report](./50_WebMonetizationReadinessReport.md)                                            |
| 3   | **AI breadth**        | 8 screens: conversation, conversations list, discovery, usage, ask-book, prompt library, semantic search, story explorer | in-editor assistant + Craft Coach only (W2)                                         | **W5** (discovery/search/ask), **W6** (story explorer); conversations + prompt library + AI usage **unassigned — see §5** |
| 4   | **Social depth**      | collections, collection detail, comments, responses (+ followers, follow requests)                                       | follow requests; followers via a dialog                                             | **unassigned — see §5**                                                                                                   |
| 5   | **Reader actions**    | clap (1..50 accumulating) and report, on the reader action bar                                                           | like, bookmark, copy-link share                                                     | **unassigned — see §5**                                                                                                   |
| 6   | **Reading analytics** | `reading_analytics_screen` — the _reader's_ own stats                                                                    | writer + per-piece analytics only                                                   | **unassigned — see §5**                                                                                                   |
| 7   | **Onboarding**        | `onboarding_screen` — first-run flow                                                                                     | nothing                                                                             | **unassigned — see §5**                                                                                                   |
| 8   | **Privacy prefs**     | dedicated privacy screen: private account, **show bookmarks count**, **show reading-history count**                      | private-notebook toggle inside edit-profile                                         | **unassigned — small, see §5**                                                                                            |
| 9   | **Offline behaviour** | engagement + follow taken offline are queued and reconciled by a unified `SyncEngine`                                    | no offline write queue                                                              | **see §4** (partly platform-inherent)                                                                                     |

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

## 3.3 M-4 — mobile has a blocks/mutes data layer and no screen (opened 2026-07-29, after W3c)

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

### T-6 · **medium** · `resolveFirst()` asserts on the wrong element, so resolving a comment is untested

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

The last row is the one that matters: it fails identically with the token change reverted, so it is
**pre-existing and unrelated** — the same loaded run showed 2 failures before the fix (this plus the
publishing a11y scan) and 1 after. It is a race between autosave persisting and the reload rehydrating,
which only loses under contention. Not triaged further here.

### T-8 · **high (process)** · running a visual spec locally silently mints host-rendered baselines

`frontend-collaborators` has no baseline for `frontend-chromium` or `frontend-dark`, so running
`visual.spec.ts` locally makes Playwright **write one** ("A snapshot doesn't exist …, writing actual")
from the host's own browser. It looks like a pass on the next run. [10 §8.3](./e2e/10_UIQuality.md) forbids
exactly this — baselines are only valid from `mcr.microsoft.com/playwright:v1.61.1-noble` — and both W3a
and W3c already caught and deleted one. **This pass generated two more and deleted them.**

Three occurrences is a process gap, not bad luck. Worth one of: `--ignore-snapshots` in the local run
script, `ci: true` in the Playwright config so missing snapshots fail instead of being written, or a
pre-commit hook rejecting untracked files under `*-snapshots/`. Recorded rather than fixed — it is a
harness change, outside a tokens-and-baselines pass.

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

### W4-1 · **medium** · `subscription/history` 404s where its three sibling ledgers answer an empty page

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

**Mitigated client-side, deliberately narrowly.** `useSubscriptionHistory` maps that one code to an empty
page so the "Plan changes" tab reads "No plan changes yet" instead of showing an error panel; every other
failure still errors. A client should not be where one of four sibling endpoints gets its shape corrected,
so the asymmetry is recorded rather than absorbed silently.

### W4-2 · **medium** · `@qalam/api-types` declares the wrong shape for `purchases/restore`

| Source                                          | Shape                                        |
| ----------------------------------------------- | -------------------------------------------- |
| `packages/api-types` `RestorePurchasesResponse` | `{ restored, subscription, creditsGranted }` |
| `monetization.controller.ts#restore` (actual)   | `{ restored, providerRef, expiresAt }`       |

Two of three fields are wrong in each direction. A client typed against the package would compile against
a response that never arrives — `subscription` and `creditsGranted` are always `undefined`, and the real
`expiresAt` is invisible to the type system. Mobile happens to read the _correct_ fields (`restored`,
`expiresAt`), so it was written from the controller rather than the package.

W4 declares its own `RestorePurchasesResult` from the controller and says why in a comment. The package is
handwritten pending `openapi.json`, which is exactly how this drifts.

### W4-3 · see [§5.2](#52-the-monetization-catalogue-sells-eight-features-and-the-backend-enforces-one-opened-2026-07-29-during-w4)

The "eight sold, one enforced" hole was already opened during W4 scoping and is documented there. Two notes
from the implementation, confirming its predictions held:

- **Gating followed §5.2 exactly**: `PremiumGate` is used only for `ai_budget`, and the other seven get a
  non-blocking `PremiumBadge`. Its consequence 2 (the two distinct `ai_budget` denials) is what
  `availabilityFromErrorCode`'s new `upgrade` state closes.
- **Independently re-confirmed live**: `PolicyEngineService.isEntitled()` still has zero callers, and
  granting an `ai_writing` override flips the snapshot to `allowed: true` while changing no route's
  behaviour — the decision is computed and then unused.

### W4-4 · **high** · there is no inert payment port, so `subscribe` cannot succeed anywhere without third-party keys

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

**Consequence for the `af5` row.** "Subscribe → entitlement granted" cannot be asserted through a payment
in any environment without real credentials. W4's E2E splits it and fakes neither half: the subscribe leg
drives the real button to the real endpoint and asserts the honest refusal, and the entitlement leg proves
grant → snapshot → gate through an **admin entitlement override** — the same Entitlement Service, the same
snapshot the client gates on. Closing the payment leg needs a Stripe test key in the E2E stack; that is a
**stack item**, tracked in `06 §6`, not a client gap.

### W4-5 · **medium** · `@qalam/api-types` declares a `couponCode` on `ChangePlanRequest` that the DTO rejects

`ChangePlanRequest` in `packages/api-types` carries `couponCode?: string`. The backend's `ChangePlanDto` has
no such property, and the app runs `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`
(`main.ts:169`) — so sending it does not get politely dropped, it **400s the entire plan change**.

This is the same trap as **M-1** (§3.1), one package-level type away: a client trusts a published type,
sends a field the DTO forbids, and the whole write fails. W4 hides the promo field from existing
subscribers rather than sending it, and says why at the call site.

Whether a coupon _should_ apply to a plan change is a product question. Today it cannot, and the type says
it can.

---

## 3.7 Mobile follow-ups opened by W4 (2026-07-29)

Under the parity rule these are rows mobile now needs. Both are **mobile is behind**, and neither is a
regression — they are gaps W4 surfaced by building the same surface properly.

### M5-1 · **medium** · mobile's `PremiumGate` has zero call sites, and its own doc comment says otherwise

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

### M5-2 · **low** · mobile can never redeem a coupon

`MonetizationRepository.validateCoupon` exists, is implemented through to the data source, and **is called by
nothing**. `plans_screen` passes no `couponCode` to `subscribe()`, and there is no field to type one into. So
a mobile subscriber cannot use a promotion, and the whole `PromotionType` catalogue is unreachable from the
app.

Web built the field from the DTO (there was nothing to port) and validates through the real endpoint before
checkout. Mobile needs the same field on `plans_screen`. Small, and worth doing with M5-1.

---

## 4. Divergences that are NOT gaps (platform-inherent)

These are accepted permanently and need no epic. They exist because the platforms genuinely differ.

| Mobile-only                  | Why it is not a web gap                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `splash`, `shell`            | App launch + native navigation shell. The web equivalent is the router + app layout.                                          |
| `storage` screen             | Device cache management (clear cached pieces/images). A browser owns its own cache.                                           |
| `gallery` page               | Native media picker/gallery. The web uses the file input + the existing cover uploader.                                       |
| Offline **read** cache       | Mobile caches pieces for offline reading via Hive boxes. Web has a service worker + the offline route, deliberately narrower. |
| Screenshot protection (P7.2) | A mobile OS capability with no browser equivalent.                                                                            |
| Haptics                      | No web analog.                                                                                                                |

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

**Status of the reader row: parked, not closed.** Raised with the product owner on 2026-07-28 and
deliberately deferred — judged low priority, and possibly worth aligning later. So it is accepted
_for now_, not accepted permanently: nothing is blocked on it, no epic owns it, and no client should
change its reader layout on the strength of this row alone.

If a future epic (or the owner) wants the two readers aligned, that is a **roadmap decision** (§5's
standard) — a row in [45](./45_WebClientRoadmap.md) naming which client moves — not something an epic
does in passing.

---

## 5. The unassigned gaps — a real hole in the plan

Items **3 (partly), 4, 5, 6, 7, 8** — plus **P-1 / P-2** in §5.1 — are not owned by any W-track row. The W-track was written to
close the AF1–AF6 client gap, and these fall outside those AF epics. (**W-1 is no longer in this
list** — it was closed by the 2026-07-28 port, §3.1.)

- **Conversation layer** — comments and responses have UI on mobile and none on web. `W3` is
  collaboration/trust and `W4` is monetization; **neither owns comments/responses**.
- **Collections** — mobile has a collections list + detail; web has neither, and no row covers it.
- **Clap / report** — deliberately scoped out of W1, with no row that picks them up.
- **Reader analytics, onboarding, privacy prefs, AI conversations + prompt library + usage** — all
  mobile-shipped, none in the W-track.

### 5.1 Both-platform product gaps in inline review (opened 2026-07-28, after W3b)

Not divergences — **neither client does these**, so they need a roadmap decision rather than a port.
Recorded here because W3b drew them as boundaries, and a boundary that lives only in a commit message
is how the debt in this document accumulated in the first place.

| #   | Gap                                                                                           | Where both clients stand                                                                                                                                                                                                                                    | Shape of the work                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-1 | ~~**Applying an accepted suggestion**~~ **CLOSED — server 2026-07-29, both clients same day** | `POST /suggestions/:id/accept` now **rewrites the anchored range of the piece body**, in the same transaction that marks the suggestion accepted, and captures a `pre_edit` snapshot first. A stale anchor is `409 SUGGESTION_CONFLICT` and writes nothing. | Done on the backend (commit `f6827e0`, `qalam-mobile/docs/56` §3b); mobile's client half in `dd12091`; web's copy + assertions in W3c-4, §3.4. **Nothing outstanding.** |
| P-2 | **Composing @mentions**                                                                       | `mentions` on the wire are resolved user **ids**. Neither composer sends any, so a typed `@handle` is plain text and nobody is notified.                                                                                                                    | Handle→id resolution per mention inside the composer — the same lookup the invite dialog uses, applied inline.                                                          |

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
   free tier's budget would become unspendable. **That contradiction is a product question and it
   blocks scoping the fix** — it must be answered before any row makes the server assert the declared
   features.

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
