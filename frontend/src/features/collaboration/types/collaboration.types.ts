import type {
  CommentKind,
  CommentStatus,
  InvitationStatus,
  PieceStatus,
  PolicyActionCode,
  PolicyEffect,
  PolicyObligation,
  PresenceState,
  PublicationEvent,
  RestrictionScope,
  RestrictionType,
  ReviewDecision,
  ReviewState,
  SnapshotReason,
  StoryRole,
  SuggestionStatus,
  TrustLevel,
  TrustStatus,
  Visibility,
} from '@qalam/shared';

/**
 * Wire types for the collaboration surface (AF6, W3a — docs/49 §4). One-to-one with the
 * backend DTOs in `collaboration-response.dto.ts`.
 *
 * The **vocabulary** (`StoryRole`, `PolicyEffect`, `InvitationStatus`, …) is imported from
 * `@qalam/shared` and never re-declared here — the wire is authoritative, and a second copy of
 * a role list is a second thing to get out of step with the server.
 */

/**
 * A collaborator on a story. Note what is NOT here: no username, pen name, or avatar — the
 * server returns **ids only**, so any human-readable label is resolved separately through the
 * profile lookup. Mobile hit the same wall (its `StoryMember.label` falls back to the raw id).
 */
export interface StoryMember {
  userId: string;
  role: StoryRole;
  invitedById: string | null;
  /** Join time; `null` for the owner, who is synthesised from the piece author (no row). */
  joinedAt: string | null;
}

export interface StoryInvitation {
  id: string;
  storyId: string;
  inviterId: string;
  inviteeId: string;
  role: StoryRole;
  status: InvitationStatus;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
}

/** A collaborator's live presence in the story workspace (polled, not pushed — docs/49 §6). */
export interface StoryPresence {
  userId: string;
  state: PresenceState;
  lastSeenAt: string;
}

/**
 * One Policy Engine decision the client **reflects**. `allowed` is the server's answer; the
 * client never recomputes it from a role, an ownership check, or a trust level (docs/49 §3).
 * `reason` is a machine code suitable for branching, and `obligations` carry conditions of a
 * `conditional_access` decision (e.g. `shadow_only`).
 */
export interface StoryCapability {
  action: PolicyActionCode | string;
  effect: PolicyEffect;
  allowed: boolean;
  reason: string;
  obligations: PolicyObligation[];
}

export interface StoryCapabilities {
  storyId: string;
  capabilities: StoryCapability[];
}

// ── Comments & suggestions (W3b) ───────────────────────────────────────────────────────────────

/** A text-range anchor. `quote` is a display aid the server echoes back for comments. */
export interface CommentAnchor {
  from: number;
  to: number;
  quote?: string;
}

/**
 * A collaboration comment or reply — one-to-one with `CommentDto`.
 *
 * Note what is **not** here, because mobile's equivalent invented all of it (defect M-3,
 * docs/48 §3.2): no `authorName`, no `authorAvatarKey`, and **no `replies` array**. Author identity
 * is `authorId` only, and a thread is a separate fetch (`GET /comments/:id/thread`).
 */
export interface CollaborationComment {
  id: string;
  storyId: string;
  authorId: string;
  parentId: string | null;
  kind: CommentKind;
  anchor: CommentAnchor | null;
  body: string;
  status: CommentStatus;
  resolvedById: string | null;
  /** Mentioned **user ids** — the wire deals in ids, never handles. */
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

/** `CommentThreadDto` — a root comment plus its replies, from `GET /comments/:id/thread`. */
export interface CommentThread {
  comment: CollaborationComment;
  replies: CollaborationComment[];
}

/** A proposed edit — one-to-one with `SuggestionDto`. `anchor` is required on the wire. */
export interface EditSuggestion {
  id: string;
  storyId: string;
  authorId: string;
  anchor: { from: number; to: number };
  originalText: string;
  suggestedText: string;
  status: SuggestionStatus;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

// ── Publishing (W3c) ───────────────────────────────────────────────────────────────────────────

/**
 * The piece a publication action answers with — `PieceResponseDto`, **not** an event or a
 * snapshot row.
 *
 * `POST /stories/:id/{publish,unpublish,schedule}`, `PATCH /stories/:id/visibility` and
 * `POST /stories/:id/snapshots/:sid/revert` all return the whole piece in its new state
 * (`publishing.controller.ts`). Mobile decoded all five as a publication event (and the revert as a
 * snapshot); nothing threw, because every field defaulted — so `type` came back `''` and the piece
 * id masqueraded as an event id, silent junk on a 200 (defect **P-1**, `qalam-mobile/docs/56` §2.2).
 *
 * Only the fields a publishing UI reads are declared. `content` is deliberately absent: it is the
 * full TipTap document, this surface does not render prose, and modelling it here would duplicate
 * the writing feature's `Piece` across a boundary features may not cross (docs/26 §4).
 */
export interface StoryPublicationState {
  /** The piece id — which is also the story id (`storyId === pieceId`). */
  id: string;
  title: string;
  status: PieceStatus;
  /** `public` | `unlisted` | `private`. There is no `followers` — sending one is a 400 (P-3). */
  visibility: Visibility;
  wordCount: number;
  /** Null until the first publish/schedule, permanent thereafter. */
  slug: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
}

/**
 * An editorial review session — one-to-one with `ReviewDto`.
 *
 * The wire says `requestedById` and `submittedAt` (not `requestedBy`/`requestedAt`), and it carries
 * `decision` — the field that says *why* a review left `in_review`. Mobile read the first two under
 * the wrong names, so both were permanently null, and ignored the third (**P-6**). Ids only; there
 * are no `*Name` fields.
 */
export interface ReviewSession {
  id: string;
  storyId: string;
  requestedById: string;
  state: ReviewState;
  reviewerId: string | null;
  decision: ReviewDecision | null;
  notes: string | null;
  submittedAt: string;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A read-only content version — `SnapshotDto`. Identified by `version`; there is no label. */
export interface StorySnapshot {
  id: string;
  storyId: string;
  version: number;
  title: string;
  content: Record<string, unknown>;
  wordCount: number;
  /** `publish` | `manual` | `pre_edit` | `review` | `restore`. */
  reason: SnapshotReason;
  createdById: string;
  createdAt: string;
}

/** One entry of the immutable publishing history — `PublicationEventDto`. */
export interface PublicationHistoryEvent {
  id: string;
  storyId: string;
  actorId: string;
  type: PublicationEvent;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Trust (W3c) ────────────────────────────────────────────────────────────────────────────────

/**
 * One restriction on an account — `RestrictionDto`.
 *
 * "No longer in force" is expressed as a non-null **`liftedAt`**; there is no `active` flag and no
 * `startsAt`. Mobile read both of those, so it was right only by luck — `TrustSummaryDto.restrictions`
 * happens to contain active rows only (**T-2**, `qalam-mobile/docs/56` §2.3).
 */
export interface UserRestriction {
  id: string;
  userId: string;
  type: RestrictionType;
  /** Which surface it covers: `global` covers every scope. */
  scope: RestrictionScope;
  reason: string;
  issuedById: string;
  expiresAt: string | null;
  liftedAt: string | null;
  createdAt: string;
}

/** The viewer's own standing — `TrustSummaryDto` from `GET /me/trust`. */
export interface TrustSummary {
  score: number;
  level: TrustLevel;
  status: TrustStatus;
  activeStrikeWeight: number;
  restrictions: UserRestriction[];
}

/**
 * `block` severs interaction both ways; `mute` hides someone from the viewer only.
 *
 * Declared here rather than imported: `BlockKind` lives in the backend's own
 * `trust.constants.ts` and is **not** exported from `@qalam/shared`, so there is nothing to import.
 * Recorded as a parity note in docs/48 §3.3 — this is the one piece of AF6 vocabulary a client has
 * to restate.
 */
export type BlockKind = 'block' | 'mute';

/**
 * One block or mute edge — `BlockDto`.
 *
 * `id` is the **relationship's** id and `blockedId` is the user. Mobile resolved the blocked user as
 * `json['userId'] ?? json['id']`, and since there is no `userId` on the wire it fell through to the
 * row id — both UUIDs, so `DELETE /users/:id/block` 404'd and unblocking could never work
 * (**T-1**, `qalam-mobile/docs/56` §2.3). No username/avatar: ids only.
 */
export interface BlockEntry {
  id: string;
  blockerId: string;
  blockedId: string;
  kind: BlockKind;
  createdAt: string;
}
