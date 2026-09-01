/**
 * Public surface of the collaboration feature (AF6, W3 — docs/49). Imported by the lazy
 * `collaborators` / `invitations` route modules; everything else stays private to the feature, so it
 * remains deletable with one `rm -rf`.
 *
 * `CapabilityGate` and `useCapability` are exported because W3b (comments/suggestions) and W3c
 * (publishing/trust) gate on the same map — but they are exported from HERE, not lifted to `app/`,
 * because they are collaboration's own vocabulary. Features that need to meet collaboration do it
 * through an app-level seam, never by importing this (docs/26 §4).
 */
export { CollaboratorsPage } from './pages/collaborators-page';
export { InvitationsInboxPage } from './pages/invitations-inbox-page';
export { CommentsPage } from './pages/comments-page';
export { SuggestionsPage } from './pages/suggestions-page';
export { PublishingPage } from './pages/publishing-page';
export { BlocksPage } from './pages/blocks-page';

export { CapabilityGate } from './components/capability-gate';
export { SuggestEditAffordance } from './components/suggest-edit-affordance';
export { RoleBadge } from './components/role-badge';
export { PresenceBar } from './components/presence-bar';
export { RestrictedWall } from './components/restricted-wall';

export { useCapability, useStoryCapabilities } from './hooks/use-capabilities';
export { useStoryMembers, useMemberActions } from './hooks/use-members';
export {
  useMyInvitations,
  useStoryInvitations,
  useInvitationActions,
  useResolveHandle,
} from './hooks/use-invitations';
export { useStoryPresence, usePresenceHeartbeat } from './hooks/use-presence';
export { useStoryComments, useCommentThread, useCommentActions } from './hooks/use-comments';
export {
  useStorySuggestions,
  useSuggestionActions,
  isSuggestionConflict,
} from './hooks/use-suggestions';
export { useStoryReview, useReviewActions, isNotApproved } from './hooks/use-review';
export { useStoryHistory, usePublicationActions } from './hooks/use-publishing';
export { useStorySnapshots, useSnapshotActions } from './hooks/use-snapshots';
export { useMyTrust, useMyBlocks, useBlockActions, isRestricted } from './hooks/use-trust';
export { isCollaborationEnabled } from './lib/collaboration-enabled';

export type {
  BlockEntry,
  BlockKind,
  CollaborationComment,
  CommentAnchor,
  CommentThread as CommentThreadData,
  EditSuggestion,
  PublicationHistoryEvent,
  ReviewSession,
  StoryCapabilities,
  StoryCapability,
  StoryInvitation,
  StoryMember,
  StoryPresence,
  StoryPublicationState,
  StorySnapshot,
  TrustSummary,
  UserRestriction,
} from './types/collaboration.types';
