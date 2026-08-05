# 48 — Platform Parity Register (web ↔ mobile)

**Status:** 🔒 Binding · **Owner:** every client epic · **Last swept:** 2026-08-04 (after **W5's
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

| #   | Area                  | Mobile has                                                                                                               | Web has                                                                                                                                           | Closed by                                                                                                                                                     |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Collaboration**     | 6 screens: collaborators, comments, invitations inbox, publishing workflow, restricted state, suggestions                | nothing                                                                                                                                           | **W3**                                                                                                                                                        |
| 2   | ~~**Monetization**~~  | 5 screens: plans, subscription, billing history, credit dashboard, usage dashboard                                       | ✅ **all five** (W4) — **fully at parity since 2026-08-03**: the coupon field (M5-2) and the two missing history tabs (M5-6) are now on both      | **W4 ✅ closed 2026-07-29** — [report](./50_WebMonetizationReadinessReport.md)                                                                                |
| 3   | **AI breadth**        | 8 screens: conversation, conversations list, discovery, usage, ask-book, prompt library, semantic search, story explorer | assistant + Craft Coach (W2), **semantic search + AI discovery shelves (W5 ✅ 2026-08-04)** — [report](./51_WebDiscoverySearchReadinessReport.md) | **W5 closed discovery + search**; **W6** (story explorer, held); conversations + prompt library + AI usage → **W8**; **ask-book is owned by NOBODY — see §5** |
| 4   | **Social depth**      | collections, collection detail, comments, responses (+ followers, follow requests)                                       | follow requests; followers via a dialog                                                                                                           | **unassigned — see §5**                                                                                                                                       |
| 5   | **Reader actions**    | clap (1..50 accumulating) and report, on the reader action bar                                                           | like, bookmark, copy-link share                                                                                                                   | **unassigned — see §5**                                                                                                                                       |
| 6   | **Reading analytics** | `reading_analytics_screen` — the _reader's_ own stats                                                                    | writer + per-piece analytics only                                                                                                                 | **unassigned — see §5**                                                                                                                                       |
| 7   | **Onboarding**        | `onboarding_screen` — first-run flow                                                                                     | nothing                                                                                                                                           | **unassigned — see §5**                                                                                                                                       |
| 8   | **Privacy prefs**     | dedicated privacy screen: private account, **show bookmarks count**, **show reading-history count**                      | private-notebook toggle inside edit-profile                                                                                                       | **unassigned — small, see §5**                                                                                                                                |
| 9   | **Offline behaviour** | engagement + follow taken offline are queued and reconciled by a unified `SyncEngine`                                    | no offline write queue                                                                                                                            | **see §4** (partly platform-inherent)                                                                                                                         |

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

### W5-2 · **medium** · `pieceId` is documented on both sides of the wire and read by nothing

`RecommendationQueryDto.pieceId` (`retrieval-request.dto.ts:125`) and `RecommendationRequest.pieceId`
(`api-types/src/retrieval.ts:206`) both document "seed piece for related-stories / related-chapters".
`grep -rn pieceId backend/src/modules/retrieval/` returns **exactly one hit — the DTO declaration**.
`RecommendationService.byKind` reads `dto.kind` and `dto.storyId` only, so `related_stories` with a
`pieceId` and no `storyId` takes the fallback at `recommendation.service.ts:167-172`:
`trending.getFeed()` — literally reasoned as "Popular right now".

Nobody has ever noticed because nobody has ever sent it: mobile threads `pieceId` through its query object
and its controller and passes **`pieceId: null`** at the only call site
(`ai_discovery_screen.dart:105`).

**This is what blocks W5's reader row.** "Upgrade _more like this_ to the AF4 recommender" (45 §4.1, W1's
deferral) cannot be piece-related against today's backend — it would replace a tag search that IS about the
piece with community trending that is not, and call it a recommendation. Closing it is a small **additive
backend enabler** (implement the parameter the contract already advertises: derive terms from the seed
piece, reuse `SearchService` exactly as the `storyId` branch does) or the row drops the upgrade and keeps
the tag search. **Decision required — recorded, not chosen.**

### W5-3 · **medium** · mobile's Story Explorer has no entry point, and Ask My Book is reachable only through it

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

| Surface                                   | Verdict                 | Why                                                                 |
| ----------------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| Semantic search (library) + suggestions   | **PORTABLE**            | Mobile's client matches the DTO field-for-field; no graph needed    |
| Saved searches                            | **PORTABLE**            | Plain owner-scoped CRUD, cap enforced server-side                   |
| Retrieval-backed discover (library kinds) | **PORTABLE**            | `trending`/`feed`/`authors`/`genres`/`related_topics` need no graph |
| Search filters (language/genre/tags)      | **FIX-THEN-PORT**       | W5-1 — correct api-types first                                      |
| Reader "more like this" → recommender     | **BLOCKED**             | W5-2 — needs the enabler, or keep the tag search                    |
| Ask My Book                               | **BUILD-FROM-CONTRACT** | W5-3 (no verified reference) + W5-4 (no graph producer)             |
| Story Explorer                            | **OUT OF ROW**          | AF3 surface; W6 owns it                                             |

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

| **AI search** | Web: query suggestions are a "Try instead" **row beside the results**. Mobile: a **dropdown while typing**. | Same endpoint, same purpose. Mobile's search runs on submit, so a dropdown is the only place suggestions can go; the web field debounces straight into the URL, so results are already on screen and a dropdown would flicker on a 300 ms timer over the answer it duplicates. |
| **AI discovery** | Web: **two** recommendation shelves on `/discover` (for-you, pick-up-next). Mobile: **five** on a dedicated AI discovery screen (adds trending, authors, genres). | The other three run the same `TrendingService` / `getWriters` / `getTrendingGenres` the web's editorial sections on that page already render — the recommender's versions differ only by carrying a reason. Shipping them would print the same rows twice on one page. |
| **AF4 results** | Web: a result whose navigation target is a `graph_node`, `chapter` or timeline cue renders as a **plain card**. Mobile: opens a **detail sheet**. | The web has no route for those types until `W6` (story explorer). A card that clearly does not claim to navigate beats a link to nowhere; when W6 lands, the target becomes a link with no change to the card. |
| **Saved searches** | Web: the **server list only**. Mobile: a device-local mirror merged with the server list. | Mobile is offline-first (`SyncEngine`, §2 row 9); a browser has no offline reading story to serve, so a local mirror would be cache with no consumer. Both clients read and write the same `/ai/search/saved` rows, which is the parity that matters. |

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

Items **3 (partly), 4, 5, 6, 7, 8** — plus **P-1 / P-2** in §5.1 — are not owned by any W-track row. The W-track was written to
close the AF1–AF6 client gap, and these fall outside those AF epics. (**W-1 is no longer in this
list** — it was closed by the 2026-07-28 port, §3.1.)

- **Conversation layer** — comments and responses have UI on mobile and none on web. `W3` is
  collaboration/trust and `W4` is monetization; **neither owns comments/responses**.
- **Collections** — mobile has a collections list + detail; web has neither, and no row covers it.
- **Clap / report** — deliberately scoped out of W1, with no row that picks them up.
- **Reader analytics, onboarding, privacy prefs, AI conversations + prompt library + usage** — all
  mobile-shipped, none in the W-track. (The last three are named by `W8`, which is unclaimed.)
- **Ask My Book — found unowned by W5's sweep (2026-08-04).** §2 row 3 read "**W5** (discovery/search/ask)",
  and W5 did not ship it: `POST /ai/ask[/stream]` is grounded Q&A over a **story's knowledge graph**, so it
  needs an owned story AND a built AF3 graph (§3.9 W5-4) — the same prerequisite the story explorer has, and
  the reason W5's row could not absorb it. Mobile has the screen; web has nothing; `W6` holds the graph
  prerequisite but its row names the explorer only. **Either W6's row grows to include it or it needs a row
  of its own** — a roadmap decision ([45](./45_WebClientRoadmap.md)), not something an epic takes in passing.

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
