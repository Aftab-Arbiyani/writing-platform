import type { Role } from '@qalam/shared';
import type {
  PolicyDecision,
  StoryRole,
  TrustStatus,
  TrustLevel,
  Visibility,
  RestrictionScope,
  RestrictionType,
} from '@qalam/shared';

/**
 * Server-internal Policy Engine types. The wire-facing decision shape
 * ({@link PolicyDecision}) lives in `@qalam/shared`; everything here is the
 * engine's own vocabulary and never crosses the wire verbatim.
 */

/** The principal an evaluation is about — always resolved from the JWT, never the body. */
export interface PolicySubject {
  readonly userId: string;
  readonly role: Role;
}

/**
 * The resource an action targets. Callers (trusted services that already loaded
 * the row) supply the facts they know — `ownerId`, `storyId`, `visibility`,
 * `targetUserId`. The engine NEVER trusts a client-supplied owner: only a
 * service that read the DB may populate these.
 */
export interface PolicyResource {
  readonly type: string;
  readonly id?: string | null;
  /** The user who owns the resource (piece author, comment author, …). */
  readonly ownerId?: string | null;
  /** The story (piece) this resource belongs to, for story-role resolution. */
  readonly storyId?: string | null;
  /** The story owner, when different from `ownerId` (e.g. a comment on someone's story). */
  readonly storyOwnerId?: string | null;
  readonly visibility?: Visibility | null;
  /** Whether the underlying content is published (visibility rule input). */
  readonly isPublished?: boolean;
  /** The "other" user an action interacts with (block/mention/moderation target). */
  readonly targetUserId?: string | null;
}

/** A single authorization question posed to the engine. */
export interface PolicyEvaluationRequest {
  readonly subject: PolicySubject;
  readonly action: string;
  readonly resource: PolicyResource;
  readonly context?: Record<string, unknown>;
}

/** A user's resolved trust standing — the Trust Platform's answer to the engine. */
export interface TrustContext {
  readonly status: TrustStatus;
  readonly level: TrustLevel;
  readonly restrictions: readonly { type: RestrictionType; scope: RestrictionScope }[];
}

/**
 * Everything a rule needs, resolved ONCE per evaluation so rules stay pure and
 * synchronous (trivially unit-testable). The engine populates this before the
 * rule pipeline runs.
 */
export interface PolicyEvaluationContext {
  readonly request: PolicyEvaluationRequest;
  readonly permissions: ReadonlySet<string>;
  readonly trust: TrustContext;
  /** The subject's effective story role (`owner` if they own the story), or null. */
  readonly storyRole: StoryRole | null;
  /** True if the subject owns the STORY (full authority over their own work). */
  readonly isOwner: boolean;
  /** True if the subject authored the specific resource (comment/suggestion). */
  readonly isResourceOwner: boolean;
  /** True if a block edge exists between subject and `resource.targetUserId`. */
  readonly isInteractionBlocked: boolean;
  /** True if the collaboration platform is disabled by feature flag. */
  readonly platformDisabled: boolean;
}

/**
 * A pure, synchronous authorization rule. Returns a terminal decision or `null`
 * to defer to the next rule. Rules run in a fixed precedence; the first
 * non-null decision wins.
 */
export interface PolicyRule {
  readonly name: string;
  evaluate(ctx: PolicyEvaluationContext): PolicyDecision | null;
}

// ── Ports (self-registered at bootstrap to avoid module cycles) ─────────────

/** Trust Platform → engine. Implemented by the Trust module's TrustStatusService. */
export interface TrustStatusPort {
  getTrustContext(userId: string): Promise<TrustContext>;
  /** Whether an interaction between two users is blocked either way. */
  isInteractionBlocked(subjectUserId: string, targetUserId: string): Promise<boolean>;
}

/** Collaboration → engine. Implemented by the Collaboration module's membership service. */
export interface StoryMembershipPort {
  /** The user's story role, or null if they are not a member. */
  getStoryRole(storyId: string, userId: string): Promise<StoryRole | null>;
}

/** Monetization → engine. Implemented by an adapter over the AF5 EntitlementService. */
export interface PolicyEntitlementPort {
  /** Whether the user is entitled to a premium collaboration/publishing feature. */
  isEntitled(userId: string, feature: string): Promise<boolean>;
}

/** Settings → engine. Implemented by an adapter over the feature-flag service. */
export interface PolicyFeatureFlagPort {
  isEnabled(flagKey: string): Promise<boolean>;
}

export type { PolicyDecision };
