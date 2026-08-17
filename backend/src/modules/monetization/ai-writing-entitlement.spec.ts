import {
  AiFeature,
  AiProvider,
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_LIMITS,
  ERROR_CODES,
  OverrideEffect,
  PlanTier,
  PremiumFeature,
  SubscriptionStatus,
} from '@qalam/shared';
import type { PlanDefinition } from '@qalam/shared';
import type { Repository } from 'typeorm';

import type { CacheService } from '../../infrastructure/cache/cache.service';
import type { DomainEventBus } from '../../common/events/domain-event-bus';
import type { AiUsageQuotaCheck } from '../../common/metering/ai-usage-meter.port';
import { AiUsageMeterService } from './ai-usage-meter.service';
import type { CreditService } from './credit.service';
import { EntitlementService } from './entitlement.service';
import type { EntitlementOverride } from './entities/entitlement-override.entity';
import type { Subscription } from './entities/subscription.entity';
import type { MonetizationConfigService } from './monetization.config-service';
import type { MonetizationFeatureService } from './monetization.feature-service';
import { EntitlementDeniedException } from './monetization.exceptions';
import type { UsageService } from './usage.service';

/**
 * D3 — **the free tier gets no AI writing** (owner, 2026-08-08; docs/45 §4 row D3,
 * docs/48 §5.2 item 4 + §6.13). ⚠️ A deliberate behaviour REGRESSION for existing free
 * users, flagged before the decision and taken anyway.
 *
 * These tests wire the **real** `EntitlementService` into the meter rather than stubbing
 * `assertAllowed`, because the thing under test is precisely the journey from "which tier
 * is this user on" to "does this AI request proceed". A stubbed entitlement mock would
 * pass against the pre-fix code, which is the one property every test here must not have.
 *
 * The third describe block is the scope regression test and matters as much as the first:
 * D4's codes and the AF4 surfaces must stay ungated, so it pins that a free user can still
 * ask a book a question. Gating that would silently pre-empt a decision the owner deferred.
 */

// ── Fixtures ──────────────────────────────────────────────────────────────────

function planFor(tier: PlanTier): PlanDefinition {
  return {
    tier,
    name: tier,
    description: `${tier} plan`,
    features: [...DEFAULT_PLAN_FEATURES[tier]] as PremiumFeature[],
    limits: { ...DEFAULT_PLAN_LIMITS[tier] },
    monthlyCredits: 0,
    prices: {},
    trialDays: 0,
  };
}

function quotaInput(feature: AiFeature): AiUsageQuotaCheck {
  return {
    userId: 'u1',
    feature,
    provider: AiProvider.OpenAI,
    model: 'gpt-4o',
    estimatedTokens: 500,
  };
}

function subscribedTo(tier: PlanTier): Subscription {
  return {
    id: 'sub-1',
    userId: 'u1',
    tier,
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
  } as unknown as Subscription;
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Builds the meter over a REAL EntitlementService. `subscription: null` is a free user —
 * the plan catalogue served here is the compiled default, so "free" means exactly what
 * `DEFAULT_PLAN_FEATURES[free]` says it means.
 */
function build(opts?: {
  paymentsEnabled?: boolean;
  subscription?: Subscription | null;
  overrideRows?: Partial<EntitlementOverride>[];
}) {
  const paymentsEnabled = opts?.paymentsEnabled ?? true;

  const subscriptions = {
    findOne: jest.fn().mockResolvedValue(opts?.subscription ?? null),
  } as unknown as Repository<Subscription>;

  const overrides = {
    find: jest
      .fn()
      .mockResolvedValue((opts?.overrideRows ?? []) as unknown as EntitlementOverride[]),
  } as unknown as Repository<EntitlementOverride>;

  const config = {
    getPlan: jest.fn().mockImplementation((tier: PlanTier) => Promise.resolve(planFor(tier))),
    getConfig: jest.fn().mockResolvedValue({
      creditsPerUsd: 100,
      lowCreditThreshold: 500,
      trialDays: 14,
      gracePeriodDays: 7,
      taxRates: {},
      currencyRates: {},
      regionCurrency: {},
    }),
  } as unknown as MonetizationConfigService;

  const cache = {
    wrap: jest
      .fn()
      .mockImplementation((_key: string, _ttl: number, compute: () => Promise<unknown>) =>
        compute(),
      ),
    del: jest.fn().mockResolvedValue(1),
  } as unknown as CacheService;

  const entitlements = new EntitlementService(subscriptions, overrides, config, cache);

  const feature = {
    isEnabled: jest.fn().mockResolvedValue(paymentsEnabled),
  } as unknown as MonetizationFeatureService;

  const usage = {
    assertWithinQuota: jest.fn().mockResolvedValue(undefined),
  } as unknown as UsageService;

  const credits = { debit: jest.fn().mockResolvedValue(5_000) } as unknown as CreditService;
  const events = { emit: jest.fn().mockResolvedValue(undefined) } as unknown as DomainEventBus;

  const service = new AiUsageMeterService(feature, entitlements, usage, credits, config, events);
  return { service, usage };
}

/** Every AI feature D3 sells behind `ai_writing` — the five IN rows of the map. */
const GATED_FEATURES = [
  AiFeature.WritingAssistant,
  AiFeature.CraftCoach,
  AiFeature.Grammar,
  AiFeature.Rewrite,
  AiFeature.Summarization,
] as const;

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('D3 — AI writing is a paid capability', () => {
  afterEach(() => jest.clearAllMocks());

  describe('a free user, payments live', () => {
    it.each(GATED_FEATURES)('should deny %s with ENTITLEMENT_DENIED', async (aiFeature) => {
      const { service } = build({ subscription: null });

      await expect(service.checkQuota(quotaInput(aiFeature))).rejects.toBeInstanceOf(
        EntitlementDeniedException,
      );
    });

    it('should name ai_writing as the denied feature, at 402, so the client can offer the right remedy', async () => {
      const { service } = build({ subscription: null });

      // The exception carries the code + status the clients switch on: conflating this
      // with QUOTA_EXCEEDED is the W4 defect recorded in docs/48 §3.6.
      expect.assertions(4);
      try {
        await service.checkQuota(quotaInput(AiFeature.WritingAssistant));
      } catch (caught) {
        const error = caught as EntitlementDeniedException;
        expect(error).toBeInstanceOf(EntitlementDeniedException);
        expect(error.getStatus()).toBe(402);
        expect(error.code).toBe(ERROR_CODES.ENTITLEMENT_DENIED);
        expect(error.details).toEqual([
          expect.objectContaining({ feature: PremiumFeature.AiWriting }),
        ]);
      }
    });

    it('should refuse BEFORE the quota check, so the remedy is "upgrade" and never "wait for reset"', async () => {
      const { service, usage } = build({ subscription: null });

      await expect(
        service.checkQuota(quotaInput(AiFeature.WritingAssistant)),
      ).rejects.toBeInstanceOf(EntitlementDeniedException);

      expect(usage.assertWithinQuota).not.toHaveBeenCalled();
    });
  });

  describe('a paying subscriber, payments live', () => {
    it.each([PlanTier.Plus, PlanTier.Pro, PlanTier.Enterprise])(
      'should allow AI writing on %s',
      async (tier) => {
        const { service } = build({ subscription: subscribedTo(tier) });

        await expect(
          service.checkQuota(quotaInput(AiFeature.WritingAssistant)),
        ).resolves.toBeUndefined();
      },
    );
  });

  describe('scope — D4 and AF4 codes are NOT gated', () => {
    /**
     * The regression test for scope creep. `ask_book`, `semantic_search` and
     * `recommendations` (AF4) and the five AF3 analyses belong to **D4**, whose scope the
     * owner deferred; docs/48 §5.2 consequence 1 still forbids gating them. They meter
     * against `ai_budget`, which free DOES hold — which is the whole reason free keeps
     * that allowance (it is spendable, contrary to what §5.2 assumed when it was written).
     */
    it.each([
      AiFeature.AskBook,
      AiFeature.SemanticSearch,
      AiFeature.Recommendations,
      AiFeature.CharacterAnalysis,
      AiFeature.PlotAnalysis,
      AiFeature.WorldBuilding,
      AiFeature.StyleAnalysis,
      AiFeature.StoryTimeline,
    ])('should allow %s for a FREE user', async (aiFeature) => {
      const { service } = build({ subscription: null });

      await expect(service.checkQuota(quotaInput(aiFeature))).resolves.toBeUndefined();
    });
  });

  describe('payments dark', () => {
    /**
     * TRAP 2. Entitlement resolution answers even when the platform flag is off and
     * degrades to DENY, so with payments dark NOBODY holds a subscription, everybody
     * resolves to free, and a gate that ran anyway would take AI writing from EVERY user
     * rather than from free ones. The meter's existing early return is the convention
     * that makes this correct, and the gate sits behind it deliberately.
     */
    it.each(GATED_FEATURES)('should still allow %s for a free user', async (aiFeature) => {
      const { service } = build({ paymentsEnabled: false, subscription: null });

      await expect(service.checkQuota(quotaInput(aiFeature))).resolves.toBeUndefined();
    });
  });

  describe('an administrative entitlement override', () => {
    it('should allow AI writing for a free user holding an active allow-override', async () => {
      const { service } = build({
        subscription: null,
        overrideRows: [
          {
            userId: 'u1',
            feature: PremiumFeature.AiWriting,
            effect: OverrideEffect.Allow,
            active: true,
            expiresAt: null,
          },
        ],
      });

      await expect(
        service.checkQuota(quotaInput(AiFeature.WritingAssistant)),
      ).resolves.toBeUndefined();
    });
  });
});
