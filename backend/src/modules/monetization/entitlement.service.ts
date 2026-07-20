import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ACCESS_GRANTING_SUBSCRIPTION_STATUSES,
  ENTITLEMENT_CACHE_TTL_SECONDS,
  EntitlementReason,
  EntitlementStatus,
  OverrideEffect,
  PlanTier,
  PremiumFeature,
  SubscriptionStatus,
  entitlementAllows,
  subscriptionStatusToEntitlement,
} from '@qalam/shared';
import type { EntitlementDecision, EntitlementSnapshot, PlanLimits } from '@qalam/shared';
import { Repository } from 'typeorm';

import { CacheService } from '../../infrastructure/cache/cache.service';
import { MONETIZATION_CACHE } from './monetization.constants';
import { MonetizationConfigService } from './monetization.config-service';
import {
  EntitlementDeniedException,
  EntitlementOverrideNotFoundException,
} from './monetization.exceptions';
import { EntitlementOverride } from './entities/entitlement-override.entity';
import { Subscription } from './entities/subscription.entity';

/** The effective plan + status a user's subscription resolves to at a point in time. */
interface EffectivePlan {
  tier: PlanTier;
  status: EntitlementStatus;
  /** When the current access window ends (period/trial/grace), else null. */
  boundary: Date | null;
}

/**
 * The Entitlement Service (AF5) — THE single source of truth for premium access. Every
 * premium capability in the app resolves access HERE (never a scattered inline flag): it
 * merges the plan the user's subscription grants, administrative/promotional/temporary
 * overrides, and time boundaries (trial/grace/period) into one decision per feature.
 *
 * Server-authoritative and cached: the per-user snapshot is memoized in Redis (short TTL +
 * explicit invalidation on any subscription/override change) so the hot path (the AI usage
 * meter calls this on every request) stays cheap. Reads the subscription row directly
 * (not via SubscriptionService) so there is no dependency cycle — SubscriptionService and
 * the admin override flow call {@link invalidate} after they mutate.
 */
@Injectable()
export class EntitlementService {
  constructor(
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(EntitlementOverride)
    private readonly overrides: Repository<EntitlementOverride>,
    private readonly config: MonetizationConfigService,
    private readonly cache: CacheService,
  ) {}

  /** The full entitlement snapshot for a user (cached; the client gates on this). */
  async getSnapshot(userId: string): Promise<EntitlementSnapshot> {
    return this.cache.wrap(
      MONETIZATION_CACHE.entitlements(userId),
      ENTITLEMENT_CACHE_TTL_SECONDS,
      () => this.computeSnapshot(userId),
    );
  }

  /** The decision for one feature. */
  async decide(userId: string, feature: PremiumFeature): Promise<EntitlementDecision> {
    const snapshot = await this.getSnapshot(userId);
    return (
      snapshot.features.find((decision) => decision.feature === feature) ?? {
        feature,
        status: EntitlementStatus.Deny,
        allowed: false,
        reason: EntitlementReason.PlanExcludes,
        expiresAt: null,
        remaining: null,
        limit: null,
      }
    );
  }

  /** Throw ENTITLEMENT_DENIED unless the user may use the feature. */
  async assertAllowed(userId: string, feature: PremiumFeature): Promise<EntitlementDecision> {
    const decision = await this.decide(userId, feature);
    if (!decision.allowed) {
      throw new EntitlementDeniedException(feature, decision.reason);
    }
    return decision;
  }

  /** The user's effective AI usage limits (plan limits; enterprise 0 = unlimited). */
  async getLimits(userId: string): Promise<PlanLimits> {
    const plan = await this.effectivePlan(userId);
    const definition = await this.config.getPlan(plan.tier);
    return definition?.limits ?? { aiDailyTokens: 0, aiMonthlyTokens: 0, aiMonthlyCredits: 0 };
  }

  /** The user's current tier (for display + limits). */
  async getTier(userId: string): Promise<PlanTier> {
    return (await this.effectivePlan(userId)).tier;
  }

  /** Drop the cached snapshot (called after a subscription/override change). */
  async invalidate(userId: string): Promise<void> {
    await this.cache.del(MONETIZATION_CACHE.entitlements(userId));
  }

  /** Active, unexpired overrides for a user (admin + internal). */
  async listOverrides(userId: string): Promise<EntitlementOverride[]> {
    return this.overrides.find({
      where: { userId, active: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Grant an administrative / promotional / temporary entitlement override. */
  async grantOverride(input: {
    userId: string;
    feature: PremiumFeature;
    effect: OverrideEffect;
    limit?: number | null;
    expiresAt?: Date | null;
    grantedBy?: string | null;
    reason?: string | null;
    source?: string | null;
  }): Promise<EntitlementOverride> {
    const override = await this.overrides.save(
      this.overrides.create({
        userId: input.userId,
        feature: input.feature,
        effect: input.effect,
        limit: input.limit ?? null,
        active: true,
        expiresAt: input.expiresAt ?? null,
        grantedBy: input.grantedBy ?? null,
        reason: input.reason ?? null,
        source: input.source ?? null,
        metadata: {},
      }),
    );
    await this.invalidate(input.userId);
    return override;
  }

  /** Deactivate an override (revoke a grant). */
  async revokeOverride(id: string): Promise<EntitlementOverride> {
    const override = await this.overrides.findOne({ where: { id } });
    if (override === null) {
      throw new EntitlementOverrideNotFoundException();
    }
    override.active = false;
    const saved = await this.overrides.save(override);
    await this.invalidate(override.userId);
    return saved;
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private async computeSnapshot(userId: string): Promise<EntitlementSnapshot> {
    const plan = await this.effectivePlan(userId);
    const definition = await this.config.getPlan(plan.tier);
    const included = new Set(definition?.features ?? []);
    const overrides = await this.activeOverrides(userId);

    const features: EntitlementDecision[] = Object.values(PremiumFeature).map((feature) => {
      const override = overrides.get(feature);
      // 1. Administrative / promotional / temporary override wins.
      if (override !== undefined) {
        return this.decisionFromOverride(feature, override);
      }
      // 2. Otherwise the plan decides, carrying the subscription's time-based status.
      if (included.has(feature)) {
        const status = plan.status;
        return {
          feature,
          status,
          allowed: entitlementAllows(status),
          reason: reasonForStatus(status),
          expiresAt: plan.boundary?.toISOString() ?? null,
          remaining: null,
          limit: null,
        };
      }
      // 3. Not in the plan and no override → denied (upgrade required).
      return {
        feature,
        status: EntitlementStatus.Deny,
        allowed: false,
        reason: EntitlementReason.PlanExcludes,
        expiresAt: null,
        remaining: null,
        limit: null,
      };
    });

    const refreshAt = this.earliestBoundary(plan.boundary, overrides);
    return {
      tier: plan.tier,
      status: plan.status,
      features,
      refreshAt: refreshAt?.toISOString() ?? null,
    };
  }

  private async effectivePlan(userId: string): Promise<EffectivePlan> {
    const subscription = await this.subscriptions.findOne({ where: { userId } });
    const now = new Date();
    if (subscription === null) {
      return { tier: PlanTier.Free, status: EntitlementStatus.Allow, boundary: null };
    }
    return this.resolveSubscription(subscription, now);
  }

  /** Resolve a subscription row to its effective tier + status, honoring time boundaries. */
  private resolveSubscription(subscription: Subscription, now: Date): EffectivePlan {
    const status = subscription.status;
    // Grace expired → treat as lapsed (free), defensively (the sweep normally transitions it).
    if (
      status === SubscriptionStatus.GracePeriod &&
      subscription.gracePeriodEnd !== null &&
      subscription.gracePeriodEnd.getTime() < now.getTime()
    ) {
      return { tier: PlanTier.Free, status: EntitlementStatus.Expired, boundary: null };
    }
    if (
      status === SubscriptionStatus.Trialing &&
      subscription.trialEnd !== null &&
      subscription.trialEnd.getTime() < now.getTime()
    ) {
      return { tier: PlanTier.Free, status: EntitlementStatus.Expired, boundary: null };
    }
    if (!ACCESS_GRANTING_SUBSCRIPTION_STATUSES.includes(status)) {
      // Paused / canceled / expired / pending → not free features + degraded status.
      return {
        tier: PlanTier.Free,
        status: subscriptionStatusToEntitlement(status),
        boundary: null,
      };
    }
    const boundary =
      status === SubscriptionStatus.Trialing
        ? subscription.trialEnd
        : status === SubscriptionStatus.GracePeriod
          ? subscription.gracePeriodEnd
          : subscription.currentPeriodEnd;
    return {
      tier: subscription.tier,
      status: subscriptionStatusToEntitlement(status),
      boundary: boundary ?? null,
    };
  }

  private async activeOverrides(userId: string): Promise<Map<PremiumFeature, EntitlementOverride>> {
    const now = Date.now();
    const rows = await this.overrides.find({ where: { userId, active: true } });
    const byFeature = new Map<PremiumFeature, EntitlementOverride>();
    for (const row of rows) {
      if (row.expiresAt !== null && row.expiresAt.getTime() < now) {
        continue; // lapsed temporary/promotional grant
      }
      byFeature.set(row.feature, row);
    }
    return byFeature;
  }

  private decisionFromOverride(
    feature: PremiumFeature,
    override: EntitlementOverride,
  ): EntitlementDecision {
    if (override.effect === OverrideEffect.Deny) {
      return {
        feature,
        status: EntitlementStatus.Deny,
        allowed: false,
        reason: EntitlementReason.DeniedOverride,
        expiresAt: override.expiresAt?.toISOString() ?? null,
        remaining: null,
        limit: null,
      };
    }
    const status =
      override.effect === OverrideEffect.Limited
        ? EntitlementStatus.Limited
        : EntitlementStatus.Allow;
    const reason =
      override.source === 'promotional'
        ? EntitlementReason.Promotional
        : override.expiresAt !== null
          ? EntitlementReason.TemporaryAccess
          : EntitlementReason.AdminOverride;
    return {
      feature,
      status,
      allowed: true,
      reason,
      expiresAt: override.expiresAt?.toISOString() ?? null,
      remaining: null,
      limit: override.limit,
    };
  }

  private earliestBoundary(
    planBoundary: Date | null,
    overrides: Map<PremiumFeature, EntitlementOverride>,
  ): Date | null {
    const candidates: Date[] = [];
    if (planBoundary !== null) {
      candidates.push(planBoundary);
    }
    for (const override of overrides.values()) {
      if (override.expiresAt !== null) {
        candidates.push(override.expiresAt);
      }
    }
    if (candidates.length === 0) {
      return null;
    }
    return candidates.reduce((min, date) => (date.getTime() < min.getTime() ? date : min));
  }
}

/** Map an entitlement status to its reason when it comes from the plan. */
function reasonForStatus(status: EntitlementStatus): EntitlementReason {
  switch (status) {
    case EntitlementStatus.Trial:
      return EntitlementReason.Trial;
    case EntitlementStatus.GracePeriod:
      return EntitlementReason.GracePeriod;
    case EntitlementStatus.Allow:
    case EntitlementStatus.Limited:
      return EntitlementReason.PlanIncludes;
    case EntitlementStatus.Suspended:
      return EntitlementReason.Suspended;
    case EntitlementStatus.Expired:
    case EntitlementStatus.Cancelled:
      return EntitlementReason.Expired;
    default:
      return EntitlementReason.NoSubscription;
  }
}
