import {
  PolicyEffect,
  PolicyObligation,
  STORY_ROLE_RANK,
  TrustStatus,
  Visibility,
  permissionSatisfies,
  type PolicyDecision,
} from '@qalam/shared';

import {
  ACTION_BASE_PERMISSION,
  ACTION_MIN_STORY_ROLE,
  ACTION_STAFF_PERMISSION,
  MUTED_SENSITIVE_ACTIONS,
  SELF_SERVICE_ACTIONS,
  isWriteAction,
  restrictionScopeForAction,
} from './policy.constants';
import type { PolicyEvaluationContext, PolicyRule } from './policy.types';

/** Small helpers for building a decision consistently. */
function decide(
  effect: PolicyEffect,
  matchedRule: string,
  reason: string,
  obligations: PolicyObligation[] = [],
): PolicyDecision {
  return {
    effect,
    allowed: effect === PolicyEffect.Allow || effect === PolicyEffect.ConditionalAccess,
    reason,
    matchedRule,
    obligations,
  };
}

/**
 * Rule 0 — feature flag. If the collaboration platform is master-disabled, every
 * write is denied; reads still pass (owners can view their own work).
 */
export class FeatureFlagRule implements PolicyRule {
  readonly name = 'feature-flag';
  evaluate(ctx: PolicyEvaluationContext): PolicyDecision | null {
    if (ctx.platformDisabled && isWriteAction(ctx.request.action)) {
      return decide(PolicyEffect.Deny, this.name, 'The collaboration platform is disabled.');
    }
    return null;
  }
}

/**
 * Rule 0b — account status (B9, closing half of A2-1). If the ACCOUNT is closed
 * (`users.status = suspended`), nothing it asks for is permitted.
 *
 * **Ordered before {@link TrustRule} deliberately**, and it is the only rule above
 * it: account closure is a stronger statement than any trust standing, and it must
 * outrank every grant below — including `PermissionRule`, so a suspended admin
 * cannot act either.
 *
 * It uses the same `Suspended` effect as a trust suspension because the clients
 * already render that effect as a restricted-state screen, and a suspended account
 * has nothing different to do about it. The `reason` differs so an operator reading
 * the audit trail can tell which system spoke — `matchedRule` is `account-status`
 * here and `trust` there.
 *
 * `accountClosed === undefined` (no port registered) defers rather than denies. Every
 * port in this engine fails open by design; a rule that denied on a missing input
 * would make the standalone engine refuse everyone.
 */
export class AccountStatusRule implements PolicyRule {
  readonly name = 'account-status';
  evaluate(ctx: PolicyEvaluationContext): PolicyDecision | null {
    if (ctx.accountClosed === true) {
      return decide(PolicyEffect.Suspended, this.name, 'This account has been suspended.');
    }
    return null;
  }
}

/**
 * Rule 1 — trust standing. The highest-precedence DENY: a suspended/banned user
 * cannot act; a read-only/muted/shadowed user is constrained per action; an
 * active scoped restriction blocks matching writes. Reads are never blocked by
 * read-only. This is where the AF6 Suspended/ReadOnly/Muted/TemporaryRestriction
 * effects originate.
 */
export class TrustRule implements PolicyRule {
  readonly name = 'trust';
  evaluate(ctx: PolicyEvaluationContext): PolicyDecision | null {
    const { status, restrictions } = ctx.trust;
    const action = ctx.request.action;
    const write = isWriteAction(action);

    if (status === TrustStatus.Banned || status === TrustStatus.Suspended) {
      return decide(PolicyEffect.Suspended, this.name, 'Your account is suspended.');
    }
    if (status === TrustStatus.ReadOnly && write) {
      return decide(PolicyEffect.ReadOnly, this.name, 'Your account is in read-only mode.');
    }
    if (status === TrustStatus.Muted && MUTED_SENSITIVE_ACTIONS.has(action)) {
      return decide(PolicyEffect.Muted, this.name, 'You are muted and cannot post here.');
    }
    if (status === TrustStatus.Shadowed && write) {
      // Shadowed writes succeed but are visible only to the author.
      return decide(PolicyEffect.ConditionalAccess, this.name, 'Your activity is limited.', [
        PolicyObligation.ShadowOnly,
      ]);
    }
    if (write && restrictions.length > 0) {
      const scope = restrictionScopeForAction(action);
      const hit = restrictions.find((r) => r.scope === scope || r.scope === 'global');
      if (hit !== undefined) {
        return decide(
          PolicyEffect.TemporaryRestriction,
          this.name,
          `A ${hit.scope} restriction is active on your account.`,
        );
      }
    }
    return null;
  }
}

/**
 * Rule 2 — user-to-user blocks. If the action interacts with another user who
 * has a block edge with the subject, deny with the Blocked effect.
 */
export class BlockRule implements PolicyRule {
  readonly name = 'block';
  evaluate(ctx: PolicyEvaluationContext): PolicyDecision | null {
    if (ctx.isInteractionBlocked) {
      return decide(PolicyEffect.Blocked, this.name, 'Interaction is blocked between these users.');
    }
    return null;
  }
}

/**
 * Rule 3 — staff permission (the platform-operator path). If the action maps to
 * a staff permission and the subject holds it, allow outright. Also enforces the
 * coarse base-permission gate: lacking the base permission is a hard deny.
 */
export class PermissionRule implements PolicyRule {
  readonly name = 'permission';
  evaluate(ctx: PolicyEvaluationContext): PolicyDecision | null {
    const action = ctx.request.action;
    const staff = ACTION_STAFF_PERMISSION[action];
    if (staff !== undefined && permissionSatisfies(ctx.permissions, staff)) {
      return decide(PolicyEffect.Allow, this.name, `Granted by permission ${staff}.`);
    }
    const base = ACTION_BASE_PERMISSION[action];
    if (base !== undefined && !permissionSatisfies(ctx.permissions, base)) {
      return decide(PolicyEffect.Deny, this.name, `Missing required permission ${base}.`);
    }
    return null;
  }
}

/**
 * Rule 4 — ownership. The resource owner (story author) can perform any
 * collaboration/publication action on their own work.
 */
export class OwnershipRule implements PolicyRule {
  readonly name = 'ownership';
  evaluate(ctx: PolicyEvaluationContext): PolicyDecision | null {
    if (ctx.isOwner) {
      return decide(PolicyEffect.Allow, this.name, 'You own this resource.');
    }
    return null;
  }
}

/**
 * Rule 4b — self service. The author of a comment/suggestion may act on their
 * own artifact (delete/resolve/withdraw) regardless of story role.
 */
export class SelfActionRule implements PolicyRule {
  readonly name = 'self-action';
  evaluate(ctx: PolicyEvaluationContext): PolicyDecision | null {
    if (ctx.isResourceOwner && SELF_SERVICE_ACTIONS.has(ctx.request.action)) {
      return decide(PolicyEffect.Allow, this.name, 'You authored this item.');
    }
    return null;
  }
}

/**
 * Rule 5 — story role. A collaborator with sufficient story-role rank is
 * allowed; a member whose rank is too low is denied (STORY_ROLE_FORBIDDEN). If
 * the action is story-role gated but the subject is not a member, defer to
 * visibility (reads) / default-deny (writes).
 */
export class StoryRoleRule implements PolicyRule {
  readonly name = 'story-role';
  evaluate(ctx: PolicyEvaluationContext): PolicyDecision | null {
    const min = ACTION_MIN_STORY_ROLE[ctx.request.action];
    if (min === undefined) {
      return null;
    }
    const role = ctx.storyRole;
    if (role === null) {
      return null; // not a member — let visibility / default-deny decide
    }
    if (STORY_ROLE_RANK[role] >= STORY_ROLE_RANK[min]) {
      return decide(PolicyEffect.Allow, this.name, `Granted by story role ${role}.`);
    }
    return decide(
      PolicyEffect.Deny,
      this.name,
      `Your story role (${role}) is below the required ${min}.`,
    );
  }
}

/**
 * Rule 6 — visibility (read access for non-members). A published public/unlisted
 * story is viewable by anyone; a private/unpublished story is not.
 */
export class VisibilityRule implements PolicyRule {
  readonly name = 'visibility';
  evaluate(ctx: PolicyEvaluationContext): PolicyDecision | null {
    if (isWriteAction(ctx.request.action)) {
      return null;
    }
    const { visibility, isPublished } = ctx.request.resource;
    if (visibility === undefined || visibility === null) {
      return null;
    }
    if (visibility === Visibility.Private) {
      return decide(PolicyEffect.Deny, this.name, 'This story is private.');
    }
    if (isPublished === true) {
      return decide(PolicyEffect.Allow, this.name, 'This story is publicly viewable.');
    }
    return null;
  }
}

/** Terminal rule — secure default. Nothing granted → deny. */
export class DefaultDenyRule implements PolicyRule {
  readonly name = 'default-deny';
  evaluate(): PolicyDecision {
    return decide(PolicyEffect.Deny, this.name, 'No policy rule granted this action.');
  }
}

/**
 * The ordered rule pipeline. Precedence matters: restrictions and blocks come
 * before grants (a suspended owner still cannot act), and default-deny is last.
 * `AccountStatusRule` sits above the trust rule because a closed account outranks
 * every standing, grant and ownership claim below it (B9, A2-1).
 */
export function buildPolicyRules(): PolicyRule[] {
  return [
    new FeatureFlagRule(),
    new AccountStatusRule(),
    new TrustRule(),
    new BlockRule(),
    new PermissionRule(),
    new OwnershipRule(),
    new SelfActionRule(),
    new StoryRoleRule(),
    new VisibilityRule(),
    new DefaultDenyRule(),
  ];
}

export { decide as buildDecision };
