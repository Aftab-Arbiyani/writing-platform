import { Injectable, Logger, Optional } from '@nestjs/common';
import { PolicyEffect, StoryRole, policyEffectAllows, type PolicyDecision } from '@qalam/shared';

import { AuditService } from '../audit/audit.service';
import { PermissionResolver } from '../permissions/permission.resolver';
import { PolicyCacheService } from './policy-cache.service';
import {
  DEFAULT_TRUST_CONTEXT,
  POLICY_AUDIT_ACTIONS,
  POLICY_AUDIT_TARGET,
  policyCacheKey,
} from './policy.constants';
import { PolicyDeniedException } from './policy.exceptions';
import { buildPolicyRules } from './policy.rules';
import type {
  AccountStatusPort,
  PolicyEntitlementPort,
  PolicyEvaluationContext,
  PolicyEvaluationRequest,
  PolicyFeatureFlagPort,
  PolicyRule,
  StoryMembershipPort,
  TrustStatusPort,
} from './policy.types';

/**
 * The Policy Engine — the SINGLE SOURCE OF TRUTH for authorization and trust
 * decisions (AF6). Every collaborative, publishing, and moderation write is
 * authorized here; no consumer re-implements permission logic.
 *
 * It composes six inputs — PBAC permissions, ownership, story roles, trust
 * standing, visibility, and feature flags — through an ordered, pure rule
 * pipeline (`policy.rules.ts`) and returns one {@link PolicyDecision}. Data-aware
 * inputs the engine cannot derive locally (trust standing, story membership,
 * entitlements, flags) arrive through ports that the Trust / Collaboration /
 * Monetization / Settings modules self-register at bootstrap — so the engine
 * sits at the centre with NO compile-time dependency on any of them (no cycles).
 *
 * Standalone-safe: with no ports registered it still evaluates using
 * permissions + ownership + visibility (the ports degrade to safe defaults),
 * which is exactly what its unit tests exercise.
 */
/** Secure fallback if (impossibly) no rule matched — the pipeline always ends in default-deny. */
const DENIED_FALLBACK: PolicyDecision = {
  effect: PolicyEffect.Deny,
  allowed: false,
  reason: 'No policy rule granted this action.',
  matchedRule: 'default-deny',
  obligations: [],
};

@Injectable()
export class PolicyEngineService {
  private readonly logger = new Logger(PolicyEngineService.name);
  private readonly rules: PolicyRule[] = buildPolicyRules();

  private trustPort?: TrustStatusPort;
  private membershipPort?: StoryMembershipPort;
  private entitlementPort?: PolicyEntitlementPort;
  private featureFlagPort?: PolicyFeatureFlagPort;
  private accountStatusPort?: AccountStatusPort;

  constructor(
    private readonly permissions: PermissionResolver,
    private readonly cache: PolicyCacheService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  // ── Port registration (called by provider modules' onModuleInit) ───────────

  registerTrustPort(port: TrustStatusPort): void {
    this.trustPort = port;
  }
  registerMembershipPort(port: StoryMembershipPort): void {
    this.membershipPort = port;
  }
  registerEntitlementPort(port: PolicyEntitlementPort): void {
    this.entitlementPort = port;
  }
  registerFeatureFlagPort(port: PolicyFeatureFlagPort): void {
    this.featureFlagPort = port;
  }
  registerAccountStatusPort(port: AccountStatusPort): void {
    this.accountStatusPort = port;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Resolves one authorization question to a decision (cached, then audited if blocking). */
  async evaluate(request: PolicyEvaluationRequest): Promise<PolicyDecision> {
    const key = policyCacheKey(
      request.subject.userId,
      request.action,
      request.resource.id ?? request.resource.storyId ?? null,
    );
    const cached = this.cache.get(request.subject.userId, key);
    if (cached !== null) {
      return cached;
    }

    const ctx = await this.buildContext(request);
    let decision: PolicyDecision = DENIED_FALLBACK;
    for (const rule of this.rules) {
      const result = rule.evaluate(ctx);
      if (result !== null) {
        decision = result;
        break;
      }
    }

    this.cache.set(request.subject.userId, key, decision);
    if (!decision.allowed) {
      await this.recordDenied(request, decision);
    }
    return decision;
  }

  /**
   * Evaluates and throws {@link PolicyDeniedException} unless the action is
   * permitted. Returns the (permitting) decision so callers can honor
   * obligations (e.g. shadow-only writes, requires-review). This is the method
   * every write path calls — "server-side authorization" in one line.
   */
  async assert(request: PolicyEvaluationRequest): Promise<PolicyDecision> {
    const decision = await this.evaluate(request);
    if (!policyEffectAllows(decision.effect)) {
      throw new PolicyDeniedException(decision);
    }
    return decision;
  }

  /**
   * Evaluates several actions against one resource for a subject — powers client
   * capability displays and restricted-state screens (the client reflects these,
   * never re-derives them).
   */
  async explain(
    subject: PolicyEvaluationRequest['subject'],
    actions: readonly string[],
    resource: PolicyEvaluationRequest['resource'],
  ): Promise<Record<string, PolicyDecision>> {
    const out: Record<string, PolicyDecision> = {};
    for (const action of actions) {
      out[action] = await this.evaluate({ subject, action, resource });
    }
    return out;
  }

  /**
   * Whether a user is entitled to a premium collaboration/publishing feature —
   * the Policy Engine's entitlement input, resolved through the Monetization
   * port (AF5 EntitlementService). Fails OPEN (true) when no port is registered
   * so the platform runs without monetization wired. Callers gate premium
   * capabilities with this before the write (e.g. exceeding the free
   * collaborator cap).
   */
  async isEntitled(userId: string, feature: string): Promise<boolean> {
    if (this.entitlementPort === undefined) {
      return true;
    }
    try {
      return await this.entitlementPort.isEntitled(userId, feature);
    } catch (error) {
      this.logger.warn(`entitlement port failed for ${userId}: ${(error as Error).message}`);
      return true;
    }
  }

  /** Drops all cached decisions for a user — call after any standing change. */
  invalidateUser(userId: string): void {
    this.cache.invalidateUser(userId);
  }

  // ── Context resolution ───────────────────────────────────────────────────

  private async buildContext(request: PolicyEvaluationRequest): Promise<PolicyEvaluationContext> {
    const { subject, resource } = request;

    const storyOwnerId =
      resource.storyOwnerId ?? (resource.type === 'story' ? (resource.ownerId ?? null) : null);
    const isOwner = storyOwnerId !== null && storyOwnerId === subject.userId;
    const isResourceOwner = resource.ownerId != null && resource.ownerId === subject.userId;

    // One parallel fan-out, so the account-status read added by B9 (A2-1) costs no
    // serial time — it lands beside the five that were already here, and the whole
    // context resolution sits behind the per-user decision cache above.
    const [permissions, trust, storyRole, isInteractionBlocked, platformDisabled, accountClosed] =
      await Promise.all([
        this.permissions.resolve(subject.role, subject.userId),
        this.resolveTrust(subject.userId),
        this.resolveStoryRole(resource.storyId ?? null, subject.userId, isOwner),
        this.resolveBlock(subject.userId, resource.targetUserId ?? null),
        this.resolvePlatformDisabled(),
        this.resolveAccountClosed(subject.userId),
      ]);

    return {
      request,
      permissions,
      trust,
      storyRole,
      isOwner,
      isResourceOwner,
      isInteractionBlocked,
      platformDisabled,
      accountClosed,
    };
  }

  /**
   * Whether the account itself is closed. `undefined` when no port is registered, so
   * {@link AccountStatusRule} defers instead of denying — and `undefined` again if the
   * port throws, because failing CLOSED here would lock every user out of every
   * policy-gated action the moment the users table was unreachable. Every other port
   * on this path makes the same trade.
   */
  private async resolveAccountClosed(userId: string): Promise<boolean | undefined> {
    if (this.accountStatusPort === undefined) {
      return undefined;
    }
    try {
      return await this.accountStatusPort.isAccountClosed(userId);
    } catch (error) {
      this.logger.warn(`account-status port failed for ${userId}: ${(error as Error).message}`);
      return undefined;
    }
  }

  private async resolveTrust(userId: string) {
    if (this.trustPort === undefined) {
      return DEFAULT_TRUST_CONTEXT;
    }
    try {
      return await this.trustPort.getTrustContext(userId);
    } catch (error) {
      this.logger.warn(`trust port failed for ${userId}: ${(error as Error).message}`);
      return DEFAULT_TRUST_CONTEXT;
    }
  }

  private async resolveStoryRole(
    storyId: string | null,
    userId: string,
    isOwner: boolean,
  ): Promise<StoryRole | null> {
    if (isOwner) {
      return StoryRole.Owner;
    }
    if (storyId === null || this.membershipPort === undefined) {
      return null;
    }
    try {
      return await this.membershipPort.getStoryRole(storyId, userId);
    } catch (error) {
      this.logger.warn(`membership port failed for ${storyId}: ${(error as Error).message}`);
      return null;
    }
  }

  private async resolveBlock(userId: string, targetUserId: string | null): Promise<boolean> {
    if (targetUserId === null || targetUserId === userId || this.trustPort === undefined) {
      return false;
    }
    try {
      return await this.trustPort.isInteractionBlocked(userId, targetUserId);
    } catch {
      return false;
    }
  }

  private async resolvePlatformDisabled(): Promise<boolean> {
    if (this.featureFlagPort === undefined) {
      return false;
    }
    try {
      return !(await this.featureFlagPort.isEnabled('feature.collaboration.enabled'));
    } catch {
      return false;
    }
  }

  private async recordDenied(
    request: PolicyEvaluationRequest,
    decision: PolicyDecision,
  ): Promise<void> {
    if (this.audit === undefined) {
      return;
    }
    // Only persist genuinely notable outcomes (restrictions/suspensions/reviews),
    // not routine role-based denials, to keep the audit log signal-rich.
    const notable = decision.effect !== PolicyEffect.Deny || request.resource.type === 'report';
    if (!notable) {
      return;
    }
    try {
      await this.audit.record({
        actorId: request.subject.userId,
        actorRole: request.subject.role,
        action:
          decision.effect === PolicyEffect.Deny
            ? POLICY_AUDIT_ACTIONS.Denied
            : POLICY_AUDIT_ACTIONS.Restricted,
        targetType: POLICY_AUDIT_TARGET.Policy,
        targetId: request.resource.id ?? request.resource.storyId ?? null,
        metadata: {
          action: request.action,
          effect: decision.effect,
          rule: decision.matchedRule,
        },
      });
    } catch (error) {
      this.logger.warn(`policy audit failed: ${(error as Error).message}`);
    }
  }
}
