import { POLICY_ACTIONS } from '@qalam/shared';
import type { PolicyActionCode } from '@qalam/shared';

/**
 * Collaboration module constants (AF6) — module-local vocabulary kept out of the
 * shared catalogues (mirrors `monetization.constants.ts`): the audit action/target
 * strings this module records, and the set of policy actions the `capabilities`
 * endpoint reflects for the client.
 */

/** Audit-log `action` strings for collaboration mutations (dot-cased target.verb). */
export const COLLABORATION_AUDIT_ACTIONS = {
  MemberAdd: 'story.member.add',
  MemberRemove: 'story.member.remove',
  MemberLeave: 'story.member.leave',
  RoleChange: 'story.role.change',
  InvitationSend: 'story.invitation.send',
  InvitationAccept: 'story.invitation.accept',
  InvitationDecline: 'story.invitation.decline',
  InvitationRevoke: 'story.invitation.revoke',
  CommentCreate: 'story.comment.create',
  CommentResolve: 'story.comment.resolve',
  CommentDelete: 'story.comment.delete',
  SuggestionCreate: 'story.suggestion.create',
  SuggestionAccept: 'story.suggestion.accept',
  SuggestionReject: 'story.suggestion.reject',
  SuggestionWithdraw: 'story.suggestion.withdraw',
} as const;

/** Audit-log `targetType` strings for collaboration entities. */
export const COLLABORATION_AUDIT_TARGET = {
  Story: 'story',
  Membership: 'story_membership',
  Invitation: 'story_invitation',
  Comment: 'collaboration_comment',
  Suggestion: 'story_suggestion',
} as const;

/**
 * The collaboration actions surfaced by `GET /stories/:storyId/capabilities`
 * (via `PolicyEngineService.explain`). The client reflects these decisions to
 * render permission displays / restricted states — it never re-derives them.
 */
export const COLLABORATION_CAPABILITY_ACTIONS: readonly PolicyActionCode[] = [
  POLICY_ACTIONS.StoryView,
  POLICY_ACTIONS.StoryComment,
  POLICY_ACTIONS.StorySuggest,
  POLICY_ACTIONS.StoryInvite,
  POLICY_ACTIONS.StoryManageMembers,
  POLICY_ACTIONS.StoryManageRoles,
  POLICY_ACTIONS.CommentResolve,
  POLICY_ACTIONS.CommentDelete,
  POLICY_ACTIONS.SuggestionResolve,
];

/** Default page size for cursor-paginated collaboration lists. */
export const COLLABORATION_PAGE_SIZE_DEFAULT = 20;
/** Hard cap on a collaboration list page. */
export const COLLABORATION_PAGE_SIZE_MAX = 50;
