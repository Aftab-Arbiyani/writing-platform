# 49 — W3 Design: Collaboration, Publishing & Trust on the web

**Status:** 🚧 In progress · **Epic:** W3 ([45 §4.3](./45_WebClientRoadmap.md)) · **Size:** L, landing in three slices
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

## 7. Definition of done (per slice)

1. Unit tests for hooks + components; `tsc --noEmit`; `eslint`; `pnpm build`.
2. E2E spec added, phase-plan row flipped, baselines regenerated in the pinned image, **light and
   dark** ([e2e/10 §3.3, §8.3](./e2e/10_UIQuality.md)) — a rendered scan, never computed contrast.
3. One commit per slice; a readiness report for the epic when W3c lands.
4. Parity sweep ([48 §6](./48_PlatformParityRegister.md)): only what §5 names, mobile re-checked
   surface-by-surface, any new difference recorded.
