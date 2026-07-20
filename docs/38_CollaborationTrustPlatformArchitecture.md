# 38 — Collaboration, Publishing & Trust Platform (AF6)

**Status: ✅ COMPLETE + verified (backend + mobile). Admin UI deferred (architecture-ready).**
Phase-2 additive epic. Frozen `v1` contract untouched — every AF6 route is new and
additive (docs 25 §8). Companion: mobile report `qalam-mobile/docs/50`.

AF6 introduces the **Policy Engine** — the single source of truth for authorization and
trust decisions — and the collaboration, publishing, and trust platforms that consume it.
It is built **on top of** the existing modules, never duplicating them: PBAC
(`permissions`), content lifecycle (`pieces`), moderation (`moderation`), audit trail
(`audit`), entitlements (`monetization`, AF5), notifications, and settings/feature-flags.

---

## 1. Folder tree

```
backend/src/modules/
├── policy/                         # THE KEYSTONE — reusable authorization engine (@Global)
│   ├── policy.types.ts             # subject/resource/context types + the 4 self-registered ports
│   ├── policy.constants.ts         # declarative action→role / action→permission tables
│   ├── policy.rules.ts             # 9 pure, ordered rules (feature-flag…default-deny)
│   ├── policy-engine.service.ts    # evaluate() / assert() / explain() / isEntitled() / invalidateUser()
│   ├── policy-cache.service.ts     # short-TTL per-user decision cache
│   ├── policy.exceptions.ts        # PolicyDeniedException (effect → HTTP status)
│   ├── policy.module.ts · index.ts
│   └── policy-engine.service.spec.ts        (19 tests)
├── policy-integration/             # plugs the OPTIONAL inputs in (keeps the engine cycle-free)
│   ├── entitlement-policy.provider.ts       # AF5 EntitlementService → engine
│   ├── feature-flag-policy.provider.ts      # Settings feature-flags → engine
│   └── policy-integration.module.ts
├── trust/                          # reputation, strikes, restrictions, blocks/mutes
│   ├── entities/ trust-profile · user-strike · user-restriction · user-block
│   ├── trust.service.ts · trust-status.service.ts (Policy TRUST port) · trust.repository.ts
│   ├── trust.controller.ts (user) · trust.admin.controller.ts (moderator)
│   ├── dto/ · mappers · constants · exceptions · util · module · index
│   └── trust.service.spec.ts                (18 tests)
├── collaboration/                  # membership, invitations, inline comments, suggestions, presence, activity
│   ├── entities/ story-membership · story-invitation · collaboration-comment · story-suggestion · collaboration-activity
│   ├── membership.service.ts · invitation.service.ts · comment.service.ts · suggestion.service.ts
│   ├── presence.service.ts · activity.service.ts · story-membership.provider.ts (Policy MEMBERSHIP port)
│   ├── collaboration.policy.ts (resource builders) · collaboration-notifier.port.ts (+ adapter)
│   ├── collaboration.controller.ts · repository · dto/ · mappers · constants · exceptions · module · index
│   └── {membership,invitation,comment,suggestion}.service.spec.ts   (47 tests)
├── publishing/                     # editorial review, approval, snapshots, publishing history
│   ├── entities/ review-session · story-snapshot · publication-event
│   ├── publishing.service.ts · review.service.ts · snapshot.service.ts · repository
│   ├── publishing.controller.ts · dto/ · mappers · constants · exceptions · module · index
│   └── {publishing,review}.service.spec.ts  (10 tests)
└── moderation/safety/              # NEW pluggable automated content safety (extends existing moderation)
    ├── safety.types.ts (SafetyDetector + SAFETY_DETECTORS token)
    ├── heuristic-safety.detector.ts · ai-safety.detector.ts (AI-assisted seam)
    ├── content-safety.service.ts · content-safety.controller.ts
    └── content-safety.service.spec.ts       (4 tests)

packages/shared/src/                # new wire vocabulary (as-const enums + pure helpers)
├── policy.ts        PolicyEffect · TrustStatus · PolicyResourceType · POLICY_ACTIONS · PolicyDecision · policyEffectAllows
├── collaboration.ts StoryRole · STORY_ROLE_RANK · InvitationStatus · Comment/SuggestionStatus · PresenceState · CollaborationActivity
├── publishing.ts    ReviewState · ReviewDecision · PublicationEvent · SnapshotReason
├── trust.ts         TrustLevel · StrikeSeverity · RestrictionType · RestrictionScope · trustLevelForScore · trustStatusForRestriction
├── permissions.ts   +9 codes (collaboration.* publishing.* trust.* policy.*) + role grants
├── error-codes.ts   +30 AF6 codes
└── enums.ts         +11 AF6 NotificationType kinds, +4 NotificationEntityType

backend/src/database/migrations/1784533235398-Af6CollaborationTrust.ts   # 12 additive tables
```

---

## 2. Policy Engine architecture (the single source of truth)

The existing `PermissionGuard`/`PermissionResolver` answer only the coarse question _"does
this principal hold capability X?"_. Data-aware questions (ownership, story role, trust
standing, visibility, entitlement) were historically scattered across services (docs 13
§4.3). **The Policy Engine centralizes all of it into one decision.**

**`PolicyEngineService.evaluate(request) → PolicyDecision`** composes six inputs through an
**ordered pipeline of 9 pure, synchronous rules** (`policy.rules.ts`). The engine resolves
all data-aware inputs ONCE per evaluation (into a `PolicyEvaluationContext`) so rules stay
pure and trivially testable; the first rule to return a non-null decision wins:

| #   | Rule         | Decides                                                                                                    |
| --- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| 0   | feature-flag | writes denied if the collaboration platform is master-disabled                                             |
| 1   | trust        | **suspended / read-only / muted / shadowed / scoped-restriction** short-circuit (highest-precedence deny)  |
| 2   | block        | user-to-user block → `blocked`                                                                             |
| 3   | permission   | staff permission grants outright (`publishing.approve`, `trust.manage`, …); missing base permission denies |
| 4   | ownership    | the story owner may do anything on their story                                                             |
| 4b  | self-service | a comment/suggestion author may act on their own artifact                                                  |
| 5   | story-role   | collaborator rank ≥ the action's minimum → allow; too low → deny                                           |
| 6   | visibility   | non-member reads: public+published → allow, private → deny                                                 |
| 7   | default-deny | secure fallback                                                                                            |

**Decision effects** (`PolicyEffect`, the AF6 catalogue): `allow`, `deny`,
`conditional_access` (+obligations e.g. `shadow_only`), `requires_review`, `read_only`,
`temporary_restriction`, `suspended`, `blocked`, `muted`. `assert()` throws
`PolicyDeniedException` (mapping effect → HTTP status) unless the effect permits.

**Reusability & no cycles.** The engine has **zero compile-time dependency** on trust,
collaboration, monetization, or settings. Data-aware inputs arrive through **four ports**
(`TrustStatusPort`, `StoryMembershipPort`, `PolicyEntitlementPort`, `PolicyFeatureFlagPort`)
that provider modules **self-register at bootstrap** (`onModuleInit`). With no ports the
engine still runs on permissions + ownership + visibility (that is exactly what its 19 unit
tests exercise). Adding a future capability = adding a row to the declarative tables in
`policy.constants.ts`, never touching the engine or any consumer's guard.

**Caching.** `PolicyCacheService` caches decisions per user with a 30 s TTL; every standing
change (`invalidateUser`) is called by trust (strike/restriction/block) and collaboration
(membership/role change) so a stale `allow` can never outlive the change.

**Client surface.** `explain(subject, actions[], resource)` returns a per-action decision
map — collaboration exposes it at `GET /stories/:id/capabilities`, which drives the mobile
client's permission displays and restricted-state screens. The client **reflects** server
decisions; it never re-derives authorization.

---

## 3. Collaboration architecture

A "story" is a `pieces` row viewed as a collaborative work (`storyId === pieceId`). All
story facts (owner/visibility/published) come from the reused
`PiecesService.getStoryContext()` — collaboration never imports the pieces repository.

- **Membership & roles** — `StoryRole` = owner › co_author › editor › reviewer › beta_reader
  (rank-ordered). `story_memberships`; the owner is synthetic (the piece author, no row).
- **Invitations** — token-based, `INVITATION_TTL_HOURS` (7 d) expiry, accept/decline/revoke;
  accept creates the membership. Authorized by `StoryInvite` (co-author+); acceptance is
  authorized by invitation ownership (the invitee holds the token).
- **Inline comments** — `collaboration_comments` (soft-deletable), `kind` general/inline with
  a JSON `anchor` `{from,to,quote}`, threads via `parentId`, `@mention` extraction, resolve.
- **Suggestions** — proposed edits with an `anchor` + original/suggested text; accept/reject
  (co-author+) / withdraw (author). **Conflict detection**: accept fails
  (`SUGGESTION_CONFLICT`) if the live content no longer contains the anchored `originalText`.
- **Presence & typing** — Redis-swappable in-memory heartbeat with `PRESENCE_TTL_SECONDS`.
- **Activity feed** — every mutation appends a `collaboration_activities` event (in the
  mutation's transaction) → a faithful history.

**Every write calls `engine.assert(...)`.** Story-scoped **reads** (members, comments,
suggestions, activity, invitations) also assert `StoryView`/`StoryInvite` so a private
draft's collaboration data cannot be enumerated.

## 4. Publishing architecture

The editorial layer on top of the piece lifecycle — it **reuses** `PiecesService`
(`publish`/`schedule`/`archive`/`update`/`preview`) via the on-behalf pattern (passing the
story's real author as `ownerId`, exactly as `moderateHide` does) and never reimplements
piece state changes.

- **Draft / Private / Unlisted / Public** — the existing `Visibility` enum; visibility
  changes go through `engine.assert(PublicationChangeVisibility)`.
- **Scheduled publishing** — reuses the existing BullMQ delayed-publish path.
- **Review workflow** — `review_sessions` (`in_review → approved | changes_requested`).
  Opt-in per story: a story is review-gated **only** while an open, non-approved session
  exists; then `publish` is blocked (`PUBLICATION_NOT_APPROVED`) until `approve`. No session
  → direct publish (unchanged, backward-compatible).
- **Snapshots / revisions** — `story_snapshots` (versioned, read-only), captured on publish
  and on manual request; `revert` restores content. Pruned past `MAX_SNAPSHOTS_PER_STORY`.
- **Publishing history** — `publication_events` (immutable) records the full lifecycle.
- **Notifications** — review-requested / review-completed / story-published (best-effort).

## 5. Moderation architecture

The existing `moderation` module (reports, appeals, warnings, triage, resolution → hide/
remove/warn/suspend/ban, bulk, statistics, audit) is **fully reused**. AF6 adds:

- **Automated safety rules** — a pluggable `SafetyDetector` pipeline (`SAFETY_DETECTORS`
  multi-provider array). `HeuristicSafetyDetector` (spam links / shouting / repetition /
  abuse lexicon) ships on; `AiSafetyDetector` is the **AI-assisted moderation seam** (reuses
  AF1 when wired). `ContentSafetyService.evaluate()` aggregates signals → a recommended
  severity; exposed at `POST /admin/safety/scan` and injectable anywhere.
- **Shadow restrictions** — `RestrictionType.Shadow` (trust) → `TrustStatus.Shadowed` →
  the engine's trust rule returns `conditional_access` + `shadow_only`, so shadowed writes
  succeed but are the author's to see.

## 6. Trust Platform architecture

`trust_profiles` (score 0–100 → `TrustLevel`), `user_strikes` (weighted, escalating),
`user_restrictions` (`read_only`/`muted`/`restricted`/`shadow`/`suspended` × scope),
`user_blocks` (block/mute edges).

- **Strike escalation** — active-strike weight ≥ `STRIKE_RESTRICTION_THRESHOLD` auto-applies
  a restriction; ≥ `STRIKE_SUSPENSION_THRESHOLD` auto-suspends (idempotent, no stacking).
- **`TrustStatusService`** implements the Policy Engine's `TrustStatusPort`: `resolveTrustContext()`
  (the hot path — read-only, defaults for users with no profile) and `isInteractionBlocked()`.
- Every standing change calls `engine.invalidateUser()` (blocks invalidate **both** parties,
  since a block is bidirectional). Every moderator action is audited.

---

## 7. Flutter implementation — see `qalam-mobile/docs/50`

`lib/features/collaboration/` (data/domain/presentation), 3 repositories, Riverpod
composition root, write controllers, and screens (collaborators, comments, suggestions,
invitations inbox, publishing workflow, restricted-state) + `CapabilityGate`/`PresenceBar`/
`RoleBadge`. Capabilities fail **closed** to read-only. 15 tests, `flutter analyze` clean.

## 8. Admin implementation (deferred — architecture-ready)

Per the established epic pattern (AF2/AF4/AF5 deferred frontend/admin), the React admin UI
is **not built** this epic, but every surface it needs already exists as an API + is
authorized by the Policy Engine, so it is a pure client:

| Admin surface                                   | Backing API (built)                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Moderator dashboard / queue / reports / appeals | existing `admin/reports`, `admin/appeals` + `admin/safety/scan`                        |
| Policy management / configuration               | `PERMISSION_CATALOGUE` + `/admin/feature-flags` (settings); `policy.manage` permission |
| Role management                                 | PBAC `role_permissions` (existing admin)                                               |
| Trust analytics / warnings / restrictions       | `admin/users/:id/trust`, `/strikes`, `/restrictions`                                   |
| Publishing dashboard                            | `/stories/:id/review`, `/publication-history`                                          |
| Audit viewer                                    | existing `audit` admin browser (policy decisions recorded there)                       |

## 9. Observability

Reuses the existing structured-logging + `/metrics` + audit infrastructure (docs 14). Every
notable policy outcome (deny/restriction) and every collaboration/publishing/trust/moderation
write is recorded through the shared **`AuditService`** (`policy.*`, `trust.*`,
`publishing.*`, moderation `*` action codes) — queryable in the admin audit browser and the
per-target timeline. Metrics (policy latency, moderation queue, report resolution time,
comment/suggestion/collaboration counts) surface through the existing monitoring seam.

## 10. Security

- **Server-side authorization on every write** — `engine.assert(...)` is the single gate;
  no hand-rolled permission logic; the client is never trusted (capabilities are advisory).
- **Read-scoping** — story-scoped collaboration + publishing reads assert `StoryView`, so
  private drafts don't leak.
- **Least privilege** — story roles are rank-ordered; owner-immutability, self-service, and
  staff-permission paths are explicit rules.
- **Trust short-circuits** — suspended/blocked/muted/read-only/shadow are resolved before any
  grant; strike escalation is automatic.
- **Invitation verification** — cryptographic tokens, TTL expiry, invitee-only acceptance.
- **Audit logging** — every moderator/trust/publishing mutation. **Rate limiting** — reused
  global `RateLimitGuard`. **No SQL injection** — TypeORM parameterization only. **No secrets
  logged.** Cache invalidation prevents stale-grant escalation.

## 11. Test coverage

Backend: **748 unit tests pass** (102 suites; +98 AF6 — policy 19, trust 18, collaboration
47, publishing 10, safety 4). `tsc --noEmit` clean · `eslint` clean (AF6) · `nest build`
green · migration verified **up → down → up** on PostgreSQL 16. Mobile: 15 AF6 tests +
full-suite green except 2 **pre-existing environmental** golden-drift failures (0.03 % pixel,
an M7 social widget untouched by AF6).

## 12. Manual testing guide

Prereq: `docker compose up -d`, `pnpm --filter backend migration:run`, `pnpm dev`.

1. **Collaboration** — author creates a piece; `POST /stories/:id/invitations` (role `editor`)
   → invitee `GET /me/invitations` → `POST /invitations/:id/accept` → `GET /stories/:id/members`
   shows both. Editor `POST /stories/:id/comments` (inline anchor) + `/suggestions`.
   `GET /stories/:id/capabilities` reflects the editor's grants; a beta-reader cannot edit.
2. **Publishing review** — `POST /stories/:id/review` → author `publish` returns 409
   `PUBLICATION_NOT_APPROVED` → reviewer `POST /stories/:id/review/approve` → publish succeeds;
   `GET /stories/:id/publication-history` shows the trail; `GET /stories/:id/snapshots` has a
   publish snapshot.
3. **Trust** — moderator `POST /admin/users/:id/strikes` ×3 (moderate) → auto-restriction;
   the user's next write returns 403 `POLICY_DENIED` with effect `temporary_restriction`.
   `POST /users/:id/block` → the blocked user's comment on your story returns effect `blocked`.
4. **Safety** — `POST /admin/safety/scan {"text":"buy http://a http://b http://c http://d"}`
   returns `flagged:true` with a spam signal.

## 13. Reuse confirmation

AF6 adds **zero** duplicate authorization logic. The Policy Engine is the single source of
truth every collaboration, publishing, and moderation write passes through. It **reuses**:
`PermissionResolver` (PBAC), `PiecesService` (story lifecycle + facts), `AuditService`
(trail), `NotificationsService`, `EntitlementService` (AF5 premium gating, via port),
`SettingsService` (feature flags, via port), the existing `moderation` workflow, Redis, and
BullMQ. No frozen `v1` contract was modified; all changes are additive.
