import {
  PERMISSIONS,
  POLICY_ACTIONS,
  RestrictionScope,
  StoryRole,
  TrustLevel,
  TrustStatus,
  type PermissionCode,
} from '@qalam/shared';

import type { TrustContext } from './policy.types';

/**
 * Policy Engine configuration tables — the declarative heart of authorization.
 * Adding a capability means adding a row here, never touching the engine or a
 * consumer's guard logic. This is what makes the engine reusable across every
 * future platform capability without duplication.
 */

/**
 * Actions granted directly by a platform PERMISSION (the "staff" path). If the
 * subject holds the mapped permission the action is allowed outright; otherwise
 * the engine defers to the story-role / ownership rules (the "member" path).
 * Both paths coexist: a platform editor approves via `publishing.approve`, a
 * story editor approves via their story role.
 */
export const ACTION_STAFF_PERMISSION: Readonly<Record<string, PermissionCode>> = {
  [POLICY_ACTIONS.ReviewApprove]: PERMISSIONS.PublishingApprove,
  [POLICY_ACTIONS.ReviewSubmit]: PERMISSIONS.PublishingReview,
  [POLICY_ACTIONS.ModerationAct]: PERMISSIONS.ReportResolve,
  [POLICY_ACTIONS.TrustManage]: PERMISSIONS.TrustManage,
};

/**
 * Base platform permission every actor must hold to touch a capability at all
 * (the coarse gate). Absence → hard deny before any story-role check.
 */
export const ACTION_BASE_PERMISSION: Readonly<Record<string, PermissionCode>> = {
  [POLICY_ACTIONS.StoryComment]: PERMISSIONS.CollaborationUse,
  [POLICY_ACTIONS.StorySuggest]: PERMISSIONS.CollaborationUse,
  [POLICY_ACTIONS.StoryInvite]: PERMISSIONS.CollaborationUse,
  [POLICY_ACTIONS.StoryEdit]: PERMISSIONS.CollaborationUse,
};

/**
 * Minimum story role a member needs for an action. Owner (rank 100) satisfies
 * every entry. Absent actions are not story-role gated (decided by other rules).
 */
export const ACTION_MIN_STORY_ROLE: Readonly<Record<string, StoryRole>> = {
  [POLICY_ACTIONS.StoryView]: StoryRole.BetaReader,
  [POLICY_ACTIONS.StoryComment]: StoryRole.BetaReader,
  [POLICY_ACTIONS.StorySuggest]: StoryRole.Reviewer,
  [POLICY_ACTIONS.StoryEdit]: StoryRole.Editor,
  [POLICY_ACTIONS.CommentResolve]: StoryRole.Editor,
  [POLICY_ACTIONS.CommentDelete]: StoryRole.Editor,
  [POLICY_ACTIONS.SuggestionResolve]: StoryRole.CoAuthor,
  [POLICY_ACTIONS.StoryInvite]: StoryRole.CoAuthor,
  [POLICY_ACTIONS.StoryManageMembers]: StoryRole.Owner,
  [POLICY_ACTIONS.StoryManageRoles]: StoryRole.Owner,
  [POLICY_ACTIONS.StoryTransfer]: StoryRole.Owner,
  [POLICY_ACTIONS.ReviewRequest]: StoryRole.CoAuthor,
  [POLICY_ACTIONS.ReviewSubmit]: StoryRole.Reviewer,
  [POLICY_ACTIONS.ReviewApprove]: StoryRole.Editor,
  [POLICY_ACTIONS.PublicationPublish]: StoryRole.CoAuthor,
  [POLICY_ACTIONS.PublicationUnpublish]: StoryRole.CoAuthor,
  [POLICY_ACTIONS.PublicationSchedule]: StoryRole.CoAuthor,
  [POLICY_ACTIONS.PublicationChangeVisibility]: StoryRole.CoAuthor,
};

/** Actions that only READ — never blocked by a read-only restriction. */
export const READ_ONLY_ACTIONS: ReadonlySet<string> = new Set<string>([POLICY_ACTIONS.StoryView]);

/**
 * Actions the AUTHOR of the specific resource may always perform on it (self
 * service): deleting/resolving your own comment, withdrawing your own suggestion.
 */
export const SELF_SERVICE_ACTIONS: ReadonlySet<string> = new Set<string>([
  POLICY_ACTIONS.CommentDelete,
  POLICY_ACTIONS.CommentResolve,
  POLICY_ACTIONS.SuggestionResolve,
]);

/** Actions that are muted-sensitive (a muted user may not perform them). */
export const MUTED_SENSITIVE_ACTIONS: ReadonlySet<string> = new Set<string>([
  POLICY_ACTIONS.StoryComment,
  POLICY_ACTIONS.StorySuggest,
]);

/** Maps an action to the restriction scope that governs it. */
export function restrictionScopeForAction(action: string): RestrictionScope {
  if (action.startsWith('publication.') || action.startsWith('review.')) {
    return RestrictionScope.Publishing;
  }
  if (action === POLICY_ACTIONS.StoryComment) {
    return RestrictionScope.Comments;
  }
  if (
    action.startsWith('story.') ||
    action.startsWith('comment.') ||
    action.startsWith('suggestion.')
  ) {
    return RestrictionScope.Collaboration;
  }
  return RestrictionScope.Global;
}

/** Whether an action mutates state (everything that is not a pure read). */
export function isWriteAction(action: string): boolean {
  return !READ_ONLY_ACTIONS.has(action);
}

/** The trust context a user with no restrictions and no trust profile defaults to. */
export const DEFAULT_TRUST_CONTEXT: TrustContext = {
  status: TrustStatus.Normal,
  level: TrustLevel.Member,
  restrictions: [],
};

// ── Audit + cache ───────────────────────────────────────────────────────────

/** Audit action strings emitted for notable (denied/restricted) policy outcomes. */
export const POLICY_AUDIT_ACTIONS = {
  Denied: 'policy.denied',
  Restricted: 'policy.restricted',
} as const;

export const POLICY_AUDIT_TARGET = {
  Policy: 'policy',
} as const;

/** Builds the decision-cache key for one evaluation. */
export function policyCacheKey(userId: string, action: string, resourceId: string | null): string {
  return `${userId}:${action}:${resourceId ?? '-'}`;
}
