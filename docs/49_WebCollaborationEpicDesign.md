# 49 — W3 Design: Collaboration, Publishing & Trust on the web

**Status:** ✅ All three slices landed (W3a `10fa085`, W3b `0c0de84`, W3c 2026-07-29) · **Epic:** W3 ([45 §4.3](./45_WebClientRoadmap.md)) · **Size:** L, landed in three slices
**Backend platform:** ✅ complete — [38](./38_CollaborationTrustPlatformArchitecture.md) (AF6)
**Reference client:** `qalam-mobile/lib/features/collaboration/` — report `qalam-mobile/docs/50`

W3 is size **L** and its roadmap row carries no detail bullets, so per the per-epic flow's step 1
("design first — this doc, or a numbered successor for anything large enough to need its own") it gets
this document. Nothing here adds product surface beyond what mobile already ships; where it departs
from mobile, §2 says so explicitly and the parity register owns it.

---

## 1. Verified starting state

Checked by opening every reference, not by reading a roadmap paraphrase — the [48 §6](./48_PlatformParityRegister.md) step-2 discipline:

| Claim                        | Verified                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend AF6 is complete      | ✅ `policy`, `policy-integration`, `collaboration`, `publishing`, `trust`, `moderation/safety`; 12 additive tables; ~40 routes in `ApiPaths`' AF6 block              |
| Mobile has 6 screens to port | ✅ `collaborators`, `comments`, `suggestions`, `invitations_inbox`, `publishing_workflow`, `restricted_state` + `CapabilityGate` / `PresenceBar` / `RoleBadge`       |
| No backend enabler needed    | ✅ every surface below maps to an existing route; W3 adds **no** backend code (flow step 2 default)                                                                  |
| The feature is E2E-testable  | ✅ unlike W2's AI gap: `feature.collaboration.enabled` **fails open** (`feature-flag-policy.provider.ts` — absent flag reads as enabled), so the E2E stack has it on |
| Web has nothing yet          | ✅ no `frontend/src/features/collaboration`; greenfield                                                                                                              |
| Mobile's invite works        | ❌ **it did not** — see §2.1. The one surface with no valid reference to port (fixed on mobile since).                                                               |

## 2. Deliberate departures from mobile

Two, both forced, both recorded in the register rather than left to be discovered later.

### 2.1 Invite is built from the contract, not ported (defect M-1)

Mobile's invite sends `{role, email?, userId?}`; `CreateInvitationDto` requires `{inviteeId: UUID, role}`
under `whitelist: true, forbidNonWhitelisted: true`, so **every mobile invite 400s** and no
email-invite path exists in the backend. Full analysis: [48 §3.1](./48_PlatformParityRegister.md).

Web therefore builds the flow the contract actually supports:

```
handle input → GET /users/:username → ProfileResponseDto.id → POST /stories/:id/invitations {inviteeId, role}
```

`GET /users/:username` already returns `id`, and the reader's author card already uses that lookup to
get a follow target — so this is an existing pattern, not a new mechanism. **Mobile was then fixed to
the same shape on 2026-07-28**, using this as its reference; M-1 is closed
([48 §3.1](./48_PlatformParityRegister.md)).

### 2.2 Availability: dark-launched, mirroring mobile

Mobile gates AF6 behind the compile-time `QALAM_ENABLE_COLLABORATION`, **default off**, with 5 screens
self-gating. Web mirrors it: **`VITE_ENABLE_COLLABORATION`, default `false`** in `config/env.ts`, with
routes/pages self-gating the same way. Playwright's `webServer` block sets it `true`, so E2E covers
everything while the shipped default stays dark. Availability parity is preserved, so this needs no
register row.

The server remains authoritative regardless — the client flag is a kill switch, never an authorization
input.

## 3. The rule that shapes every surface: reflect, never re-derive

`GET /stories/:id/capabilities` returns the Policy Engine's per-action decision map
(`{action, effect, allowed, reason, obligations}[]`). Every affordance is gated on it, and the client
**never** computes authorization from a role, an ownership check, or a trust level:

- `<CapabilityGate action="...">` — the `PremiumGate` analogue; renders children only when the
  matching capability is `allowed`.
- **Fails closed.** A failed capabilities load degrades to read-only, exactly as mobile does. Never
  optimistic.
- Role rank (`STORY_ROLE_RANK`, `storyRoleAtLeast`) is imported from `@qalam/shared` for **display
  ordering only** — never to decide whether a button appears.
- Restricted effects (`suspended`, `read_only`, `muted`, `blocked`, `conditional_access` +
  `shadow_only`) render the W3c walls from the server's own `effect`/`reason`.

## 4. Conventions (W1/W2 template — no new patterns)

`frontend/src/features/collaboration/`, following `features/reading/` exactly:

| Layer         | Content                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `api/`        | `collaboration.api.ts`, `publishing.api.ts`, `trust.api.ts` — the only place AF6 routes are named                        |
| `types/`      | `collaboration.types.ts` — wire types mirroring the DTOs; vocabulary re-exported from `@qalam/shared`, never re-declared |
| `hooks/`      | one hook per query/mutation, `qk.*` keys only, invalidation by prefix                                                    |
| `components/` | `capability-gate`, `role-badge`, `presence-bar`, member/invitation/comment/suggestion pieces                             |
| `pages/`      | one page per route below                                                                                                 |
| `index.ts`    | the feature's public surface; `app/routes/*` composes it                                                                 |

New `qk` namespace (added to `lib/query-keys.ts`, never ad-hoc arrays):

```ts
stories: {
  all: ['stories'],
  capabilities: (id) => ['stories', id, 'capabilities'],
  members:      (id) => ['stories', id, 'members'],
  invitations:  (id) => ['stories', id, 'invitations'],
  comments:     (id) => ['stories', id, 'comments'],
  suggestions:  (id) => ['stories', id, 'suggestions'],
  activity:     (id) => ['stories', id, 'activity'],
  presence:     (id) => ['stories', id, 'presence'],
  review:       (id) => ['stories', id, 'review'],
  snapshots:    (id) => ['stories', id, 'snapshots'],
  history:      (id) => ['stories', id, 'publication-history'],
},
invitations: { mine: () => ['invitations', 'mine'] },   // GET /me/invitations
trust:       { me: () => ['trust', 'me'], blocks: () => ['trust', 'blocks'] },
```

Cross-feature rule ([26 §4](./26_FrontendArchitecture.md)): features never import features. Where
collaboration must meet the editor (W3b's inline comments/suggestions), they meet at an **app-level
seam**, the way W2's `AiEditorTarget` does — the collaboration feature hands anchors/text to the
editor, which applies them through its own commands.

## 5. The three slices

Each slice is independently green — unit → `tsc --noEmit` → `eslint` → build → E2E in **light and
dark** with baselines regenerated in the pinned image — and lands as its own commit. Sub-rows are in
[45 §4.3](./45_WebClientRoadmap.md).

### W3a — Collaboration core (membership)

| Surface           | Route                           | Endpoints                                                                                                                                            |
| ----------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collaborators     | `/write/:storyId/collaborators` | `GET/POST /stories/:id/members`* · `PATCH·DELETE /stories/:id/members/:userId` · `POST /stories/:id/leave` · `GET …/capabilities` · `GET …/presence` |
| Invite (see §2.1) | in-page dialog                  | `GET /users/:username` → `POST /stories/:id/invitations {inviteeId, role}`                                                                           |
| Story invitations | in-page section                 | `GET /stories/:id/invitations` · `DELETE /invitations/:id` (revoke)                                                                                  |
| Invitations inbox | `/me/invitations`               | `GET /me/invitations` · `POST /invitations/:id/accept` · `POST /invitations/:id/decline`                                                             |

\* members list returns **ids only** (`MemberDto`), so display names resolve through the existing
profile lookup — the same constraint mobile hit, where `StoryMember.label` falls back to the raw id.

Components: `CapabilityGate`, `RoleBadge`, `PresenceBar`, `MemberList`, `InviteDialog`, `InvitationList`.
**E2E:** collaborators page renders + role badges; invite dialog resolves a handle and sends `inviteeId`;
inbox accept → membership appears. Both themes.

### W3b — Inline review (comments + suggestions)

| Surface     | Route                         | Endpoints                                                                                                                     |
| ----------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Comments    | `/write/:storyId/comments`    | `GET/POST /stories/:id/comments` · `POST /comments/:id/replies` · `POST /comments/:id/resolve` · `PATCH·DELETE /comments/:id` |
| Suggestions | `/write/:storyId/suggestions` | `GET/POST /stories/:id/suggestions` · `POST /suggestions/:id/accept` · `…/reject` · `…/withdraw`                              |

General **and** inline comments (`kind`, `anchor {from,to,quote}`), threads, resolve, `@mention`
display. Suggestions carry an `anchor` plus `originalText`/`suggestedText`; **`SUGGESTION_CONFLICT` on
accept is a first-class UI state** (the live text no longer contains the anchored original), not a
generic error. Editor contact via the app-level seam (§4). **E2E:** comment thread + resolve;
suggestion accept; conflict state. Both themes.

> ⚠️ **W3b builds from the DTOs — mobile is only a partial reference here.** The pre-W3b audit
> ([48 §3.2](./48_PlatformParityRegister.md)) found mobile's `addSuggestion` sends no `anchor` (which is
> required) plus two properties the DTO rejects, so it could only ever 400 — and it is unreachable
> anyway, since the suggestions screen has no create affordance (**M-2**). Mobile's comment and
> suggestion entities also parse six keys the wire never sends, never call the thread endpoint
> (`GET /comments/:id/thread`), and never parse the suggestion `anchor` (**M-3**).
>
> Concretely, for W3b: threads come from `GET /comments/:id/thread` returning
> `CommentThreadDto {comment, replies}` — **not** a `replies` array on `CommentDto`; replies post to
> `POST /comments/:id/replies` with `{body, mentions?}`, **never** `parentId` on the create endpoint;
> both list endpoints are **cursor-paginated**; and author identity is `authorId` only, so display names
> resolve the same way W3a's `CollaboratorIdentity` does.

### W3c — Publishing + trust

| Surface             | Route                               | Endpoints                                                                                                                                     |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Publishing workflow | `/write/:storyId/publishing`        | `POST /stories/:id/review` · `…/review/approve` · `…/review/changes` · `POST …/publish` · `…/unpublish` · `…/schedule` · `PATCH …/visibility` |
| Snapshots + history | same page                           | `GET/POST /stories/:id/snapshots` · `GET /snapshots/:id` · `POST /stories/:id/snapshots/:sid/revert` · `GET …/publication-history`            |
| Restricted state    | rendered wherever an effect demands | driven by capabilities + `GET /me/trust`                                                                                                      |
| Blocks / mutes      | `/settings/blocks`                  | `GET /me/blocks` · `POST·DELETE /users/:id/block` · `POST·DELETE /users/:id/mute`                                                             |

Review gating is **opt-in per story** — a story is gated only while an open non-approved session
exists; with no session, publish is unchanged. `PUBLICATION_NOT_APPROVED` is a named UI state.
**E2E:** request review → approve → publish; restricted wall; snapshot revert. Both themes.

## 6. Explicit non-goals

Out of scope, and not "nice to also add" (that is how W-1 happened):

- **Real-time transport.** Presence polls, as mobile does. The backend has no websocket layer.
- **Admin/moderator UI** — [38 §8](./38_CollaborationTrustPlatformArchitecture.md), owned by `A2`.
- **Automated safety scan** (`POST /admin/safety/scan`) — moderator surface, `A2`.
- **Reporting flow** — deferred on mobile too, and no client exists to extend.
- **Fixing mobile's M-1 invite** — logged, unowned, deliberately not done inside a web epic.
- Anything not named in §5.

## 6b. W3a status (2026-07-28)

**Code complete, unit + E2E green. One item outstanding: the visual baseline, which only CI may mint.**

| Gate                                     | Result                                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (`vitest`)                          | ✅ 14 new; full frontend suite **352 passing / 79 files**                                                                                     |
| `tsc --noEmit`, `eslint`                 | ✅ clean (app + e2e)                                                                                                                          |
| `tsc -b && vite build`, `perf:budget`    | ✅ builds; within budget (entry 141.2 kb)                                                                                                     |
| **E2E functional** (`frontend-chromium`) | ✅ **6/6** — roster + role badge, invite-by-handle → accept → server-side membership, API-arranged invitation, unknown handle, empty inbox    |
| **E2E a11y — light AND dark**            | ✅ **5/5** (`frontend-chromium` + `frontend-dark`) — collaborators page and invitations inbox, no critical/serious violations in either theme |
| **E2E visual baseline**                  | ⏳ **must be minted by CI** — see §6c                                                                                                         |
| Backend unit (`permissions`)             | ✅ 21/21 after the seed fix below                                                                                                             |

### 6c. What the E2E run found (and why running it mattered)

Three real defects that unit tests could not have caught, because unit tests mock the contract:

1. **`collaboration.use` was granted to no role on any pre-AF6 database.** `PermissionsService.seed()`
   seeded role→permission mappings **only when `role_permissions` was entirely empty**, so any
   permission added by a later epic never reached its default roles. A story owner's own roster read
   returned `403 AUTH_PERMISSION_DENIED`. This affected `ai.use` (AF1/AF2) and `billing.use` (AF5)
   identically — i.e. **those features were unusable for ordinary users on every client, mobile
   included.** Fixed by reconciling **per permission code**: a code already granted to some role is
   left untouched (so operator customizations survive), while a genuinely new code gets its defaults.
   Regression test added.
2. **`POST /invitations/:id/accept` returns `MemberDto`, not the invitation** — no `storyId`. The
   client was reading `storyId` off the response to invalidate story caches, which silently did
   nothing. The story id is now passed as a mutation variable.
3. **The inbox's "Earlier" history section could never render.** `GET /me/invitations` filters to
   `InvitationStatus.Pending`, so an answered invitation simply stops being returned. The section was
   deleted, and the unit test that "passed" by mocking declined data was rewritten.

Also found, and **not** fixed (out of scope, worth a follow-up): `e2e/scripts/stack-up.sh` does not set
`RATE_LIMIT_ENABLED=false`, while [e2e/06 §6](./e2e/06_PhasePlan.md) and `web-e2e.yml` both require it —
the suite mints a login per test and trips `authLogin` (5/min) without it. A local run needs the env
set by hand until the script is aligned.

### 6d. The one outstanding gate — visual baseline provenance

`frontend-collaborators.png` has **no committed baseline**, so the `@visual` project reports it missing.
That is deliberate: [e2e/10 §8.3](./e2e/10_UIQuality.md) permits baselines only from
`mcr.microsoft.com/playwright:v1.61.1-noble` via the `web-e2e` workflow with
`update_visual_baselines: true`, downloaded and committed so the diff is reviewed. Playwright wrote an
actual-image on first run; **it was deleted rather than committed.** To close: run that workflow and
commit the artifact.

**Still open as of 2026-07-29, and now the ONLY thing between W3 and closed** — see §6h. The two theme
defects that had to land first are fixed, so the mint is no longer blocked by pending re-tints; it is
blocked only on running the workflow.

---

## 6e. Superseded — pre-run status (kept for the record)

**The environment blocker below was resolved:** the stack does come up, and the E2E has now run. The
failure was that `docker compose` reported containers healthy inside the tool sandbox while they were
never actually created; running it outside the sandbox brought the stack up normally.

| Gate                                | Result                                                                                                                                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests (`vitest`)               | ✅ 14 new (capability gate ×6, invite dialog ×3, inbox ×5); full frontend suite **352 passing, 79 files**                                                                                                                           |
| `tsc --noEmit -p tsconfig.app.json` | ✅ clean                                                                                                                                                                                                                            |
| `eslint`                            | ✅ clean (app + e2e)                                                                                                                                                                                                                |
| `tsc -b && vite build`              | ✅ builds; `perf:budget` — **within budget** (entry 141.2 kb)                                                                                                                                                                       |
| E2E **code**                        | ✅ written + typechecked + linted: `tests/frontend/collaboration.spec.ts` (5 tests), 2 page objects, 2 api-fixture helpers, a11y ×2 + visual ×1 case, phase-plan row added, `VITE_ENABLE_COLLABORATION=true` wired into `webServer` |
| E2E **run + baselines**             | ❌ **not run** — see below                                                                                                                                                                                                          |

**Why E2E did not run.** `pnpm e2e:up` cannot bring the stack up in the current sandbox: `docker
compose up --wait` reports the qalam containers healthy, but they are not visible to `docker ps` and
the published Postgres port (`5434`, from `.env`) refuses connections, so `migration:run` fails with
`ECONNREFUSED` and neither the seeds nor the backend start. With no backend there is no run and no
baseline generation — and baselines must be produced in the pinned Playwright image anyway
([e2e/10 §2.2, §5](./e2e/10_UIQuality.md)), never on a dev host.

**So W3a is not "done" by [§7](#7-definition-of-done-per-slice)'s standard** — step 2 is outstanding.
What remains is one command on a machine where the stack comes up:

```
pnpm e2e:up && pnpm e2e --project=frontend-chromium --grep @phase4   # functional
pnpm e2e --project=frontend-chromium --project=frontend-dark --grep "@a11y|@visual" --update-snapshots
```

Deliberately **not** done to compensate: no baselines committed from this host, and the phase-plan row
is marked ✅ for _coverage authored_, which must be verified by that first green run before W3b starts.

---

## 6f. W3b status (2026-07-28) — shipped, and what it corrected

**Unit + E2E green.** 6 new unit tests (20 in the feature), **5/5 functional E2E**, a11y clean in
**light and dark**, full frontend suite 358 passing, tsc/eslint clean, build within budget.

Built from the DTOs, as §5's warning required. Four contract facts that a port would have got wrong:

1. **Threads are a separate resource.** `GET /comments/:id/thread` → `CommentThreadDto`; `CommentDto`
   has no `replies`. Threads load on expand, so a forty-comment list makes one request, not forty.
2. **No comment edit exists.** There is no `PATCH /comments/:id` — this document previously claimed
   one. A comment is deleted, not edited.
3. **A suggestion needs its `anchor`.** Required on create. Since this route has no live editor
   selection, the composer asks for the offset explicitly and derives `to` from the replaced text —
   rather than inventing an anchor, which is precisely how M-2 happened.
4. **Accepting a suggestion does not rewrite the prose.** The server verifies the anchored
   `originalText` still exists (else `SUGGESTION_CONFLICT`) and records the decision. The accepted
   card says so in as many words; a silent no-op would be the worst reading of "Accepted".

Both list endpoints are cursor-paginated and status-filterable, and the E2E asserts the filter is
applied **server-side** rather than in the client.

**Two selector defects fixed on the way**, both the same trap — accessible-name matching is by
substring, so `getByRole('button', {name: 'Accept'})` also matches an "Accepted" filter button:
mine, in the new suggestions page object, and a **pre-existing** one in `pages/frontend/drafts-page.ts`
(`name: 'Published'` matched the tab plus every row's "View published piece" button). The latter passed
only while the seeded list was short; it broke once repeated runs filled the database, and is now
`exact`.

**Boundaries drawn deliberately**, so they are not mistaken for oversights:

- **Mentions are displayed, not composed.** The row names "@mention display". The wire takes
  `mentions` as resolved user **ids**, so composing them needs handle→id resolution per mention —
  a surface of its own. A typed `@handle` stays plain text rather than silently failing to notify.
- **No editor integration.** Applying an accepted suggestion to the document belongs to the editor
  and its own commands, through the app-level seam (§4). W3b ships the review surfaces; wiring them
  into the editor's selection is a larger change than this row names.

**Same one gate open as W3a:** no visual baseline is committed for either page — CI mints those (§6d).
Playwright wrote host actuals on the full-suite run; both were deleted, not committed.

---

## 6g. W3c status (2026-07-29) — shipped, and the precondition that made it a port

**Green:** 409 frontend unit tests, `tsc --noEmit` + `eslint` clean, build within bundle budget, and
E2E **9/9 functional + 33/33 a11y in light AND dark** against the local stack with
`RATE_LIMIT_ENABLED=false`.

| Surface             | Route                            | Shipped                                                                                                                                                                        |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Publishing workflow | `/write/:storyId/publishing`     | Review card (request / approve / request-changes with notes), publication card (publish / unpublish / schedule / visibility), versions (capture / revert), publication history |
| Restricted state    | rendered where an effect demands | `RestrictedWall` — wraps the workflow, triggered by the server's own restrictive `effect`                                                                                      |
| Blocks / mutes      | `/settings/blocks`               | Both kinds in one list, unblock/unmute through their own routes, plus account standing                                                                                         |

**This row is the first true port of the epic, and only because the reference was repaired first.**
W3a built invite from the contract (mobile's was broken, M-1) and W3b built from the DTOs entirely
(M-2/M-3). W3c's reference — mobile's `publishing_workflow_screen` — had **eight** defects of its own,
all fixed before this row started (`qalam-mobile/docs/56` §2.2, commit `b64db78`). Five of them were
shapes no unit test catches, because the server accepted the request and discarded it:

| Defect | What it was                                                                       | What web does                                                         |
| ------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| P-1    | Five calls answer `PieceResponseDto`; mobile decoded them as an event/snapshot    | `StoryPublicationState` mirrors the piece fields the UI reads         |
| P-2    | `schedule` sent `scheduledFor` + `visibility` → 400 on two keys and a missing one | `{scheduledAt}`, pinned by a unit test that asserts the key set       |
| P-3    | A `followers` visibility the enum does not contain → 400 every time               | `VISIBILITY_OPTIONS` is asserted equal to `Object.values(Visibility)` |
| P-4    | `GET …/review` answers `data: null`; mobile raised `API_MALFORMED_RESPONSE`       | `ReviewSession \| null`, and "Draft" is the rendered state            |
| P-8    | Four handlers declare no `@Body()`; bodies were discarded in silence              | Those four calls send none, pinned per-call                           |

**The nullable read, done web's way.** Mobile added an explicit `getOrNull` because its client threw
on non-Map data. Web's `api-client` already returns `data` untouched, so nothing in the shared client
needed loosening — the equivalent fix is to stop lying in the type (`Promise<ReviewSession | null>`)
and pin it: `use-review.spec.tsx` asserts `null` arrives as **data**, is cached, and that a real
failure still errors.

**The restricted wall's shape was decided from web's own routing, not copied.** Mobile walls via a
banner because its `guardRedirect` is pure and synchronous. Web's guard is a component and _could_
read trust — but §5 says the wall is "rendered wherever an effect demands", and interception would put
a blocking request in front of every navigation to answer a question a handful of surfaces ask. So
`RestrictedWall` wraps the surface, keys on the server's `effect` (never a locally-derived status),
fetches `GET /me/trust` **only** once a restrictive effect has been seen, and fails open. Both clients
wall at the surface, each for its own reason.

**Blocks/mutes had no reference at all** — mobile's trust data layer is complete and renders nowhere,
recorded as **M-4** ([48 §3.3](./48_PlatformParityRegister.md)). Built from the DTOs, avoiding the one
real defect in that dead code: `BlockDto.id` is the relationship and `blockedId` is the person, and
mixing them up makes unblocking impossible while looking fine (T-1). Both a unit test and the E2E pin
the id that goes out.

### What running the suite found (again, the reason it is not optional)

- **A backend defect the unit tests could not see (W3c-1).** The capability map tells a story owner
  they may `review.approve`; the endpoint's coarse `@Permissions(PublishingApprove)` then 403s them.
  Recorded in [48 §3.4](./48_PlatformParityRegister.md), not worked around — a client-side role check
  is the one thing §3 forbids. The E2E documents the live behaviour and fails when it is fixed.
- **Two contrast defects in shared UI (W3c-2, W3c-3)**, both first reached by this row's a11y scan.
- **Two selector/isolation bugs of my own**, both the traps this epic has now hit three times:
  `getByRole('region', {name: 'Publication'})` matched "Publication history" too (substring), and
  counting rows in the shared writer's cumulative block list passed only until the second run — the
  same shape as W3b's `drafts-page` fix. Both fixed here; the fix for the second is a throwaway
  blocker, so the test owns its data.

**Same one gate open as W3a and W3b:** no visual baseline is committed for the new pages — and none is
minted here. Playwright wrote a host actual for `frontend-collaborators.png` during the full-suite run;
it was deleted, not committed (§6d).

**One pre-existing E2E failure, unrelated to this row:** `assistant.spec.ts` "the editor still writes
and autosaves with the assistant mounted" fails under parallel load. Confirmed pre-existing by
stashing every W3c change and re-running — it fails on the clean tree too (56 passed / 1 failed).

---

## 6h. The theme-defect pass (2026-07-29) — W3c-2 and W3c-3 closed, baseline gate still open

The four defects W3c's hand-off carried are now **all fixed**: W3c-1 and W3c-4 in `2b0cf50`, W3c-2 and
W3c-3 in `1e4d526` (findings in [48 §3.4–3.5](./48_PlatformParityRegister.md)).

| Defect    | Fix                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------- |
| **W3c-2** | `--q-success` `#3e7c4f` → `#356b44`; axe-measured 5.29 / 4.96 / 4.62 on surface / canvas / raised |
| **W3c-3** | `Button.defaultHoverColor` pinned to the accent token; the pointer-parking workaround **deleted** |

Both were verified by _removing_ the fix and watching the scan fail, not by arithmetic alone — which
§8.4 of [10](./e2e/10_UIQuality.md) warns is not verification. Without the pin, axe reports
`4.37 (#ab6846 on #ffffff)` and the publishing scan fails; with it, 31 a11y checks pass in
**light and dark**. And because no scan anywhere paints a `success` tag, QTag's classes were rendered
against the real stylesheet and measured directly.

**Suite state on this tree** (frontend, chromium + dark, `--grep-invert @visual`): **82 passed, 1
failed** — the pre-existing `assistant.spec.ts` flake above. The like-for-like comparison is the useful
part: the same loaded run on the reverted tokens fails **2** (that flake _plus_ the publishing a11y
scan), and **1** with the fix. Nothing else moved.

### The gate that remains — and why it is still not closed

**W3 is not closed.** One gate is open, the same one since W3a: no visual baseline is committed for
`frontend-collaborators` (chromium or dark). It **could not be minted from this environment**:

- `gh` is not installed, no `GH_TOKEN`/`GITHUB_TOKEN` is set, and no git credential helper is
  configured — `git push --dry-run` fails with `could not read Username for 'https://github.com'`.
  So the branch cannot be pushed and `web-e2e` cannot be dispatched. `develop` is **5 commits ahead**
  of `origin/develop` (two of them pre-dating this work).
- The forbidden fallback was **not** taken. Running `visual.spec.ts` locally made Playwright write two
  host-rendered baselines; both were **deleted**, per [10 §8.3](./e2e/10_UIQuality.md). That is the third
  time this trap has been hit — now recorded as a process gap, [48 §3.5](./48_PlatformParityRegister.md) T-8.

**To close W3:** push `develop`, run `web-e2e` with `update_visual_baselines: true`, commit the
`updated-visual-baselines` artifact. Nothing else is outstanding.

**One discrepancy to settle first.** The requested coverage was `frontend-collaborators` plus
`story-publishing`, `settings-blocks` and comments/suggestions — but `visual.spec.ts` defines **nine**
screenshots and none of the last four are among them. A mint cannot create a baseline for a test that
does not exist, so those three pages need `@visual` tests added before their baselines can be minted.
That is a spec addition, outside a tokens-and-baselines pass, so it was **not** done here.
**Resolved 2026-07-29 (§6i): the four specs now exist.**

---

## 6i. The QTag recipe pass (2026-07-29) — T-2/T-3 closed, four visual specs added

Three items, in the order they had to happen.

**1. The recipe, not the swatches.** Every tinted QTag colour failed or nearly failed AA because the
label and the fill were the **same token** — the colour was measured against itself, so the ratio was a
property of one token plus whatever page sat behind it. Fixed structurally: a per-family
`--q-<fam>-on-tint` label token, solved against the darkest page, with **the fills untouched** so hue
and vividness are unchanged. Full before/after (axe, both themes, all three backgrounds) in
[48 §3.5](./48_PlatformParityRegister.md). All five now clear 4.5:1 everywhere; **T-2 and T-3 are
closed**, and dark mode moved only for `danger`, which was the recorded T-3 failure.

The same pairing existed in **seven other places** — `offline-banner` (a live `warning` text failure),
`notification-filters`, `notification-item`'s glyphs, `editor-toolbar`, admin's `login-form` — all
converted. That breadth is the argument for fixing the recipe: darkening five fills would have muddied
the palette and left the next colour free to reintroduce it.

**2. The scan hole.** A token was only scanned if a page happened to paint one, and no scan painted a
`success` tag at all. There is now a permanent spec that parses QTag's `COLOR` map out of the component,
asserts the pairing rule statically, and renders every colour on all three backgrounds in both themes
(48 §3.5, T-2b). Verified by breaking it both ways. W3c's `neutral` workaround on the blocks page is
**removed** — good standing reads `success` again.

**3. The four missing visual specs** — `frontend-story-publishing`, `frontend-settings-blocks`,
`frontend-comments`, `frontend-suggestions` — added following the existing pattern, including its two
hard-won data lessons: the blocks page snapshots as a **throwaway blocker** (the writer's block list is
cumulative and would encode a per-run row count), and every list is masked so the shots pin layout
rather than timestamps and generated ids. All 27 visual specs were validated with
`--ignore-snapshots`, which exercises the arrangement without writing an image.

### The mint must now re-mint EVERYTHING, not just the missing four

This is the important change to the outstanding gate. The re-tint touches tags, notification glyphs,
toolbar active states, the offline banner and admin's login error — so **every committed baseline is
now stale**, not merely absent. A mint that only fills the gaps would leave the nine existing baselines
describing the old palette and they would fail the next verification run.

So the one CI run is `web-e2e` with `update_visual_baselines: true`, and the artifact it produces
replaces **all** baselines: 13 pages × the engines/themes each is projected into. Reviewing that diff is
where the re-tint actually gets looked at, which is why it is one run at the end rather than several.

**Deliberately not minted here.** Nothing was generated locally and no image is committed —
[10 §8.3](./e2e/10_UIQuality.md), and the T-8 trap this repo has now hit three times.

---

## 7. Definition of done (per slice)

1. Unit tests for hooks + components; `tsc --noEmit`; `eslint`; `pnpm build`.
2. E2E spec added, phase-plan row flipped, baselines regenerated in the pinned image, **light and
   dark** ([e2e/10 §3.3, §8.3](./e2e/10_UIQuality.md)) — a rendered scan, never computed contrast.
3. One commit per slice; a readiness report for the epic when W3c lands.
4. Parity sweep ([48 §6](./48_PlatformParityRegister.md)): only what §5 names, mobile re-checked
   surface-by-surface, any new difference recorded.
