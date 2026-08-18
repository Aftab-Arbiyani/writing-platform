/**
 * Policy Engine vocabulary (AF6) — the single authorization + trust decision
 * contract for the whole platform.
 *
 * The backend Policy Engine is the SINGLE SOURCE OF TRUTH for authorization: it
 * composes PBAC permissions, story roles, ownership, trust standing,
 * entitlements, visibility, and feature flags into ONE decision. Clients read
 * these same enums to render permission displays and restricted-state screens —
 * they never re-derive authorization, they only reflect a server decision.
 *
 * `as const` objects + derived union types (never TS `enum`): the values ARE the
 * exact wire/DB strings (see `enums.ts` for the rationale).
 */

/**
 * The effect of a policy decision — the AF6 decision catalogue. `allow` and
 * `conditional_access` permit the action (the latter with obligations); every
 * other effect blocks it and tells the client which restricted state to render.
 */
export const PolicyEffect = {
  Allow: 'allow',
  Deny: 'deny',
  ConditionalAccess: 'conditional_access',
  RequiresReview: 'requires_review',
  ReadOnly: 'read_only',
  TemporaryRestriction: 'temporary_restriction',
  Suspended: 'suspended',
  Blocked: 'blocked',
  Muted: 'muted',
} as const;
export type PolicyEffect = (typeof PolicyEffect)[keyof typeof PolicyEffect];

/** Effects under which the action MAY proceed (possibly with obligations). */
export const POLICY_PERMITTED_EFFECTS: readonly PolicyEffect[] = [
  PolicyEffect.Allow,
  PolicyEffect.ConditionalAccess,
];

/** Whether an effect permits the action to proceed. Pure; shared client+server. */
export function policyEffectAllows(effect: PolicyEffect): boolean {
  return POLICY_PERMITTED_EFFECTS.includes(effect);
}

/**
 * A principal's platform trust standing — resolved by the Trust Platform and
 * consumed by the engine's trust rule, which short-circuits to a restrictive
 * effect. Ordered loosely best→worst.
 */
export const TrustStatus = {
  Trusted: 'trusted',
  Normal: 'normal',
  Limited: 'limited',
  ReadOnly: 'read_only',
  Muted: 'muted',
  Shadowed: 'shadowed',
  Suspended: 'suspended',
  /**
   * RESERVED — never produced, and nothing should start producing it without a
   * product decision. Recorded here in B9 (finding A2-5) so the next reader stops
   * rediscovering it.
   *
   * It is unreachable by construction, not by omission: a trust status is derived
   * only from `trustStatusForRestriction` or a score band, and `RestrictionType` has
   * no `banned` member, so nothing can map to this. It would also be
   * indistinguishable if it were reachable — `TrustRule` gives `banned` and
   * `suspended` the identical decision (`policy.rules.ts`).
   *
   * **A ban already lives elsewhere, and that is why this stays reserved.**
   * `ReportResolution.UserBanned` resolves to `suspendUser(user, actor, permanent)`
   * (`moderation.service.ts`) — i.e. `users.status = suspended`, audited as
   * `MODERATION_ACTIONS.UserBan`. Ban is an ACCOUNT sanction, not a trust standing.
   * Wiring this member would stand up a third sanction system beside the two that
   * A2-1 already found talking past each other, so it needs a new `RestrictionType`,
   * a distinct effect in `TrustRule`, and a decision about what a ban means that a
   * suspension does not — none of which is a defect fix. Do not delete it either:
   * removing an enum member is a breaking change (docs/25 §8).
   */
  Banned: 'banned',
} as const;
export type TrustStatus = (typeof TrustStatus)[keyof typeof TrustStatus];

/** What a policy request targets. */
export const PolicyResourceType = {
  Story: 'story',
  Comment: 'comment',
  Suggestion: 'suggestion',
  Invitation: 'invitation',
  Publication: 'publication',
  Review: 'review',
  Report: 'report',
  User: 'user',
  /** Reserved for future Organizations / Editorial Workspaces (no migration). */
  Workspace: 'workspace',
  Platform: 'platform',
} as const;
export type PolicyResourceType = (typeof PolicyResourceType)[keyof typeof PolicyResourceType];

/**
 * Action catalogue (dot-cased `resource.verb`). Open catalogue — a new
 * capability appends a code here and never needs a migration (actions are
 * matched as plain strings by the engine's rule set).
 */
export const POLICY_ACTIONS = {
  StoryView: 'story.view',
  StoryEdit: 'story.edit',
  StoryComment: 'story.comment',
  StorySuggest: 'story.suggest',
  StoryInvite: 'story.invite',
  StoryManageMembers: 'story.manage_members',
  StoryManageRoles: 'story.manage_roles',
  StoryTransfer: 'story.transfer',
  CommentResolve: 'comment.resolve',
  CommentDelete: 'comment.delete',
  SuggestionResolve: 'suggestion.resolve',
  PublicationPublish: 'publication.publish',
  PublicationUnpublish: 'publication.unpublish',
  PublicationSchedule: 'publication.schedule',
  PublicationChangeVisibility: 'publication.change_visibility',
  ReviewRequest: 'review.request',
  ReviewSubmit: 'review.submit',
  ReviewApprove: 'review.approve',
  ModerationAct: 'moderation.act',
  TrustManage: 'trust.manage',
} as const;
export type PolicyActionCode = (typeof POLICY_ACTIONS)[keyof typeof POLICY_ACTIONS];

/**
 * Obligations attached to a `conditional_access` / `requires_review` decision —
 * conditions the caller must honor for the action to be legitimate.
 */
export const PolicyObligation = {
  RequiresReview: 'requires_review',
  RequiresEntitlement: 'requires_entitlement',
  ReadOnly: 'read_only',
  RateLimited: 'rate_limited',
  ShadowOnly: 'shadow_only',
} as const;
export type PolicyObligation = (typeof PolicyObligation)[keyof typeof PolicyObligation];

/**
 * One evaluated decision — the wire shape the engine returns and the `explain`
 * endpoint exposes. `matchedRule` names the rule that decided (for audit + the
 * admin policy viewer); `obligations` is empty unless the effect is conditional.
 */
export interface PolicyDecision {
  readonly effect: PolicyEffect;
  readonly allowed: boolean;
  readonly reason: string;
  readonly matchedRule: string;
  readonly obligations: readonly PolicyObligation[];
  readonly ttlSeconds?: number;
}

/** Default cache TTL for a resolved decision (seconds). */
export const POLICY_DECISION_CACHE_TTL_SECONDS = 30;

/** Feature-flag key that master-disables the collaboration platform. */
export const COLLABORATION_MASTER_FLAG_KEY = 'feature.collaboration.enabled';
