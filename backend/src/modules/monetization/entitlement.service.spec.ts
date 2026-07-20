import {
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_LIMITS,
  EntitlementReason,
  EntitlementStatus,
  OverrideEffect,
  PlanTier,
  PremiumFeature,
  SubscriptionStatus,
} from '@qalam/shared';
import type { PlanDefinition } from '@qalam/shared';
import type { Repository } from 'typeorm';

import type { CacheService } from '../../infrastructure/cache/cache.service';
import { EntitlementService } from './entitlement.service';
import type { EntitlementOverride } from './entities/entitlement-override.entity';
import type { Subscription } from './entities/subscription.entity';
import type { MonetizationConfigService } from './monetization.config-service';
import { EntitlementDeniedException } from './monetization.exceptions';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FREE_PLAN: PlanDefinition = {
  tier: PlanTier.Free,
  name: 'Free',
  description: 'Free plan',
  features: [...DEFAULT_PLAN_FEATURES[PlanTier.Free]] as PremiumFeature[],
  limits: { ...DEFAULT_PLAN_LIMITS[PlanTier.Free] },
  monthlyCredits: 0,
  prices: {},
  trialDays: 0,
};

const PLUS_PLAN: PlanDefinition = {
  tier: PlanTier.Plus,
  name: 'Plus',
  description: 'Plus plan',
  features: [...DEFAULT_PLAN_FEATURES[PlanTier.Plus]] as PremiumFeature[],
  limits: { ...DEFAULT_PLAN_LIMITS[PlanTier.Plus] },
  monthlyCredits: 5_000,
  prices: {},
  trialDays: 14,
};

function makeActiveSub(overrides?: Partial<Subscription>): Subscription {
  return {
    id: 'sub-1',
    userId: 'u1',
    tier: PlanTier.Plus,
    status: SubscriptionStatus.Active,
    interval: 'monthly',
    provider: 'stripe',
    currency: 'usd',
    autoRenew: true,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    scheduledTier: null,
    scheduledInterval: null,
    trialStart: null,
    trialEnd: null,
    gracePeriodEnd: null,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    providerCustomerId: null,
    providerSubscriptionId: null,
    metadata: {},
    ...overrides,
  } as unknown as Subscription;
}

// ── Factory ────────────────────────────────────────────────────────────────────

function build(opts?: {
  subscription?: Subscription | null;
  overrideRows?: Partial<EntitlementOverride>[];
  plan?: PlanDefinition;
}) {
  const subscriptions = {
    findOne: jest.fn().mockResolvedValue(opts?.subscription ?? null),
  } as unknown as Repository<Subscription>;

  const overrideRows = (opts?.overrideRows ?? []) as unknown as EntitlementOverride[];
  const overrides = {
    find: jest.fn().mockResolvedValue(overrideRows),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data: unknown) => ({ ...(data as object) })),
    save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
  } as unknown as Repository<EntitlementOverride>;

  const config = {
    getPlan: jest.fn().mockImplementation((tier: PlanTier) => {
      const plan = opts?.plan;
      if (plan !== undefined) return Promise.resolve(plan);
      if (tier === PlanTier.Free) return Promise.resolve(FREE_PLAN);
      if (tier === PlanTier.Plus) return Promise.resolve(PLUS_PLAN);
      return Promise.resolve(undefined);
    }),
  } as unknown as MonetizationConfigService;

  // Make cache.wrap a pass-through so computeSnapshot is always called directly
  const cache = {
    wrap: jest
      .fn()
      .mockImplementation((_key: string, _ttl: number, compute: () => Promise<unknown>) =>
        compute(),
      ),
    del: jest.fn().mockResolvedValue(1),
  } as unknown as CacheService;

  const service = new EntitlementService(subscriptions, overrides, config, cache);
  return { service, subscriptions, overrides, config, cache };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('EntitlementService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('decide', () => {
    it('should allow AiBudget for a free user (no subscription)', async () => {
      const { service } = build({ subscription: null });

      const decision = await service.decide('u1', PremiumFeature.AiBudget);

      expect(decision.allowed).toBe(true);
      expect(decision.status).toBe(EntitlementStatus.Allow);
      expect(decision.reason).toBe(EntitlementReason.PlanIncludes);
    });

    it('should deny ai_writing for a free user (plan excludes it)', async () => {
      const { service } = build({ subscription: null });

      const decision = await service.decide('u1', PremiumFeature.AiWriting);

      expect(decision.allowed).toBe(false);
      expect(decision.status).toBe(EntitlementStatus.Deny);
      expect(decision.reason).toBe(EntitlementReason.PlanExcludes);
    });

    it('should allow ai_writing for an active Plus subscriber', async () => {
      const { service } = build({ subscription: makeActiveSub() });

      const decision = await service.decide('u1', PremiumFeature.AiWriting);

      expect(decision.allowed).toBe(true);
      expect(decision.status).toBe(EntitlementStatus.Allow);
    });

    it('should allow a feature via an allow override even when the plan excludes it', async () => {
      const { service } = build({
        subscription: null, // free user — no AiWriting in plan
        overrideRows: [
          {
            userId: 'u1',
            feature: PremiumFeature.AiWriting,
            effect: OverrideEffect.Allow,
            active: true,
            expiresAt: null,
            limit: null,
            source: null,
            grantedBy: null,
            reason: 'promotional',
          },
        ],
      });

      const decision = await service.decide('u1', PremiumFeature.AiWriting);

      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe(EntitlementReason.AdminOverride);
    });

    it('should deny a feature via a deny override even when the plan includes it', async () => {
      // Plus subscriber — AiWriting is in the plan
      const { service } = build({
        subscription: makeActiveSub(),
        overrideRows: [
          {
            userId: 'u1',
            feature: PremiumFeature.AiWriting,
            effect: OverrideEffect.Deny,
            active: true,
            expiresAt: null,
            limit: null,
            source: null,
            grantedBy: null,
            reason: 'abuse',
          },
        ],
      });

      const decision = await service.decide('u1', PremiumFeature.AiWriting);

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe(EntitlementReason.DeniedOverride);
    });

    it('should return trial status for a trialing Plus subscription', async () => {
      const { service } = build({
        subscription: makeActiveSub({
          status: SubscriptionStatus.Trialing,
          trialEnd: new Date(Date.now() + 7 * 86_400_000), // 7 days out
        }),
      });

      const snapshot = await service.getSnapshot('u1');

      expect(snapshot.status).toBe(EntitlementStatus.Trial);
      const aiWritingDecision = snapshot.features.find(
        (f) => f.feature === PremiumFeature.AiWriting,
      );
      expect(aiWritingDecision?.allowed).toBe(true);
      expect(aiWritingDecision?.status).toBe(EntitlementStatus.Trial);
    });

    it('should resolve expired grace window to free tier with Expired status', async () => {
      const { service } = build({
        subscription: makeActiveSub({
          status: SubscriptionStatus.GracePeriod,
          gracePeriodEnd: new Date(Date.now() - 86_400_000), // yesterday — expired
        }),
      });

      const decision = await service.decide('u1', PremiumFeature.AiBudget);

      // Free plan includes AiBudget, but the expired grace window marks it denied
      expect(decision.allowed).toBe(false);
      expect(decision.status).toBe(EntitlementStatus.Expired);
    });
  });

  describe('assertAllowed', () => {
    it('should resolve when the feature is allowed', async () => {
      const { service } = build({ subscription: makeActiveSub() });

      await expect(service.assertAllowed('u1', PremiumFeature.AiWriting)).resolves.toMatchObject({
        allowed: true,
      });
    });

    it('should throw EntitlementDeniedException when the feature is denied', async () => {
      const { service } = build({ subscription: null }); // free user

      await expect(service.assertAllowed('u1', PremiumFeature.AiWriting)).rejects.toBeInstanceOf(
        EntitlementDeniedException,
      );
    });
  });

  describe('getLimits', () => {
    it("should return the plan limits for the user's effective tier", async () => {
      const { service } = build({ subscription: makeActiveSub() });

      const limits = await service.getLimits('u1');

      expect(limits.aiDailyTokens).toBe(DEFAULT_PLAN_LIMITS[PlanTier.Plus].aiDailyTokens);
      expect(limits.aiMonthlyTokens).toBe(DEFAULT_PLAN_LIMITS[PlanTier.Plus].aiMonthlyTokens);
    });

    it('should return free plan limits when there is no subscription', async () => {
      const { service } = build({ subscription: null });

      const limits = await service.getLimits('u1');

      expect(limits.aiDailyTokens).toBe(DEFAULT_PLAN_LIMITS[PlanTier.Free].aiDailyTokens);
    });
  });

  describe('invalidate', () => {
    it('should delete the cached entitlement key for the user', async () => {
      const { service, cache } = build();

      await service.invalidate('u1');

      expect(cache.del).toHaveBeenCalledWith(expect.stringContaining('u1'));
    });
  });

  describe('getSnapshot', () => {
    it('should pass through the cache via CacheService.wrap', async () => {
      const { service, cache } = build({ subscription: null });

      await service.getSnapshot('u1');

      expect(cache.wrap).toHaveBeenCalledTimes(1);
    });

    it('should return the correct tier in the snapshot for a Plus subscriber', async () => {
      const { service } = build({ subscription: makeActiveSub() });

      const snapshot = await service.getSnapshot('u1');

      expect(snapshot.tier).toBe(PlanTier.Plus);
      expect(snapshot.status).toBe(EntitlementStatus.Allow);
    });

    it('should return free tier for a user with no subscription', async () => {
      const { service } = build({ subscription: null });

      const snapshot = await service.getSnapshot('u1');

      expect(snapshot.tier).toBe(PlanTier.Free);
    });
  });
});
