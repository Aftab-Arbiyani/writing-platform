/**
 * Collaboration vocabulary (AF6) — story roles, invitations, inline comments,
 * suggestions, presence, and the activity feed. Shared so the Flutter client and
 * the backend agree on every wire string. A "story" here is a {@link PieceStatus}
 * piece viewed as a collaborative work: `storyId === pieceId`.
 *
 * `as const` objects + union types (never TS `enum`). The authorization decision
 * for every action still comes from the Policy Engine (`policy.ts`); these roles
 * are an INPUT to that decision, never a client-side shortcut around it.
 */

/**
 * A collaborator's role on one story. `owner` is the piece author (exactly one).
 * Rank-ordered: a higher role can do everything a lower one can.
 */
export const StoryRole = {
  Owner: 'owner',
  CoAuthor: 'co_author',
  Editor: 'editor',
  Reviewer: 'reviewer',
  BetaReader: 'beta_reader',
} as const;
export type StoryRole = (typeof StoryRole)[keyof typeof StoryRole];

/** Story-role ranks — the engine compares ranks, not names (mirrors ROLE_RANK). */
export const STORY_ROLE_RANK: Record<StoryRole, number> = {
  beta_reader: 10,
  reviewer: 30,
  editor: 60,
  co_author: 80,
  owner: 100,
};

/** Whether a role meets a minimum rank. Pure; shared client+server. */
export function storyRoleAtLeast(role: StoryRole, min: StoryRole): boolean {
  return STORY_ROLE_RANK[role] >= STORY_ROLE_RANK[min];
}

/** Roles a story owner/co-author may assign to invitees (never `owner`). */
export const ASSIGNABLE_STORY_ROLES: readonly StoryRole[] = [
  StoryRole.CoAuthor,
  StoryRole.Editor,
  StoryRole.Reviewer,
  StoryRole.BetaReader,
];

/** Lifecycle of a story invitation. */
export const InvitationStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
  Declined: 'declined',
  Revoked: 'revoked',
  Expired: 'expired',
} as const;
export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

/** An inline comment is anchored to a text range; a general comment is not. */
export const CommentKind = {
  General: 'general',
  Inline: 'inline',
} as const;
export type CommentKind = (typeof CommentKind)[keyof typeof CommentKind];

/** Whether a collaboration comment thread is open or resolved. */
export const CommentStatus = {
  Open: 'open',
  Resolved: 'resolved',
} as const;
export type CommentStatus = (typeof CommentStatus)[keyof typeof CommentStatus];

/** Lifecycle of an edit suggestion. */
export const SuggestionStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
  Rejected: 'rejected',
  Withdrawn: 'withdrawn',
} as const;
export type SuggestionStatus = (typeof SuggestionStatus)[keyof typeof SuggestionStatus];

/** Ephemeral presence of a collaborator in a story workspace (Redis-backed). */
export const PresenceState = {
  Active: 'active',
  Idle: 'idle',
  Typing: 'typing',
} as const;
export type PresenceState = (typeof PresenceState)[keyof typeof PresenceState];

/**
 * Activity-feed event kinds — open catalogue (stored as `varchar`, additive
 * without a migration). New kinds land here first.
 */
export const CollaborationActivity = {
  MemberJoined: 'member_joined',
  MemberLeft: 'member_left',
  RoleChanged: 'role_changed',
  InvitationSent: 'invitation_sent',
  InvitationAccepted: 'invitation_accepted',
  CommentAdded: 'comment_added',
  CommentResolved: 'comment_resolved',
  SuggestionAdded: 'suggestion_added',
  SuggestionAccepted: 'suggestion_accepted',
  SuggestionRejected: 'suggestion_rejected',
  ReviewRequested: 'review_requested',
  ReviewCompleted: 'review_completed',
  Published: 'published',
} as const;
export type CollaborationActivity =
  (typeof CollaborationActivity)[keyof typeof CollaborationActivity];

// ── Guardrails (product limits) ─────────────────────────────────────────────

/** Max collaborators (excluding the owner) on one story. */
export const MAX_STORY_COLLABORATORS = 20;
/** Invitation validity window before it auto-expires. */
export const INVITATION_TTL_HOURS = 168; // 7 days
/** Max length of a collaboration comment body. */
export const MAX_COMMENT_BODY_LENGTH = 5000;
/** Max length of a suggestion's proposed text. */
export const MAX_SUGGESTION_LENGTH = 10000;
/** Presence heartbeat TTL — a collaborator drops off the roster after this. */
export const PRESENCE_TTL_SECONDS = 45;
