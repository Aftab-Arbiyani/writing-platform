import {
  AiFeature,
  AiProvider,
  PremiumFeature,
  QuotaWindow,
  creditsForCostUsd,
} from '@qalam/shared';
import type { AiTokenUsage } from '@qalam/shared';

import type { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEventType } from '../../common/events/domain-events';
import type {
  AiUsageConsumption,
  AiUsageQuotaCheck,
} from '../../common/metering/ai-usage-meter.port';
import { AiUsageMeterService } from './ai-usage-meter.service';
import type { CreditService } from './credit.service';
import type { EntitlementService } from './entitlement.service';
import type { MonetizationConfigService } from './monetization.config-service';
import type { MonetizationFeatureService } from './monetization.feature-service';
import { QuotaExceededException } from './monetization.exceptions';
import type { UsageService } from './usage.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const QUOTA_INPUT: AiUsageQuotaCheck = {
  userId: 'u1',
  feature: AiFeature.WritingAssistant,
  provider: AiProvider.OpenAI,
  model: 'gpt-4o',
  estimatedTokens: 500,
};

const CONSUMPTION_INPUT: AiUsageConsumption = {
  userId: 'u1',
  feature: AiFeature.WritingAssistant,
  provider: AiProvider.OpenAI,
  model: 'gpt-4o',
  usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } as AiTokenUsage,
  costUsd: 0.01,
  requestId: 'req-1',
};

const DEFAULT_METER_CONFIG = {
  creditsPerUsd: 100,
  lowCreditThreshold: 500,
  trialDays: 14,
  gracePeriodDays: 7,
  taxRates: {},
  currencyRates: {},
  regionCurrency: {},
};

// ── Factory ────────────────────────────────────────────────────────────────────

function build(opts?: { enabled?: boolean; creditBalance?: number }) {
  const enabled = opts?.enabled ?? true;
  const creditBalance = opts?.creditBalance ?? 5_000;

  const feature = {
    isEnabled: jest.fn().mockResolvedValue(enabled),
  } as unknown as MonetizationFeatureService;

  const entitlements = {
    assertAllowed: jest.fn().mockResolvedValue({ allowed: true, feature: PremiumFeature.AiBudget }),
  } as unknown as EntitlementService;

  const usage = {
    assertWithinQuota: jest.fn().mockResolvedValue(undefined),
  } as unknown as UsageService;

  const credits = {
    debit: jest.fn().mockResolvedValue(creditBalance),
  } as unknown as CreditService;

  const config = {
    getConfig: jest.fn().mockResolvedValue(DEFAULT_METER_CONFIG),
  } as unknown as MonetizationConfigService;

  const events = {
    emit: jest.fn().mockResolvedValue(undefined),
  } as unknown as DomainEventBus;

  const service = new AiUsageMeterService(feature, entitlements, usage, credits, config, events);
  return { service, feature, entitlements, usage, credits, config, events };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AiUsageMeterService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('checkQuota', () => {
    describe('when monetization is disabled', () => {
      it('should be a complete no-op — not call entitlements, usage, or events', async () => {
        const { service, entitlements, usage, events } = build({ enabled: false });

        await service.checkQuota(QUOTA_INPUT);

        expect(entitlements.assertAllowed).not.toHaveBeenCalled();
        expect(usage.assertWithinQuota).not.toHaveBeenCalled();
        expect(events.emit).not.toHaveBeenCalled();
      });

      it('should resolve (not throw) regardless of quota state', async () => {
        const { service } = build({ enabled: false });

        await expect(service.checkQuota(QUOTA_INPUT)).resolves.toBeUndefined();
      });
    });

    describe('when monetization is enabled', () => {
      it('should assert the user is entitled to AiBudget before checking quota', async () => {
        const { service, entitlements } = build({ enabled: true });

        await service.checkQuota(QUOTA_INPUT);

        expect(entitlements.assertAllowed).toHaveBeenCalledWith('u1', PremiumFeature.AiBudget);
      });

      it('should call assertWithinQuota after the entitlement check', async () => {
        const { service, usage } = build({ enabled: true });

        await service.checkQuota(QUOTA_INPUT);

        expect(usage.assertWithinQuota).toHaveBeenCalledWith('u1');
      });

      it('should emit AiQuotaExceeded and re-throw when assertWithinQuota raises QuotaExceededException', async () => {
        const { service, usage, events } = build({ enabled: true });
        const quotaError = new QuotaExceededException(QuotaWindow.Monthly);
        (usage.assertWithinQuota as jest.Mock).mockRejectedValue(quotaError);

        await expect(service.checkQuota(QUOTA_INPUT)).rejects.toBeInstanceOf(
          QuotaExceededException,
        );

        expect(events.emit).toHaveBeenCalledWith(
          DomainEventType.AiQuotaExceeded,
          expect.objectContaining({ userId: 'u1' }),
        );
      });

      it('should re-throw non-quota errors without emitting AiQuotaExceeded', async () => {
        const { service, usage, events } = build({ enabled: true });
        const genericError = new Error('unexpected');
        (usage.assertWithinQuota as jest.Mock).mockRejectedValue(genericError);

        await expect(service.checkQuota(QUOTA_INPUT)).rejects.toThrow('unexpected');
        expect(events.emit).not.toHaveBeenCalled();
      });
    });
  });

  describe('recordConsumption', () => {
    describe('when monetization is disabled', () => {
      it('should be a complete no-op — not call credits, config, or events', async () => {
        const { service, credits, config, events } = build({ enabled: false });

        await service.recordConsumption(CONSUMPTION_INPUT);

        expect(credits.debit).not.toHaveBeenCalled();
        expect(config.getConfig).not.toHaveBeenCalled();
        expect(events.emit).not.toHaveBeenCalled();
      });

      it('should resolve silently', async () => {
        const { service } = build({ enabled: false });

        await expect(service.recordConsumption(CONSUMPTION_INPUT)).resolves.toBeUndefined();
      });
    });

    describe('when monetization is enabled', () => {
      it('should debit credits computed via creditsForCostUsd(costUsd, creditsPerUsd)', async () => {
        const { service, credits } = build({ enabled: true });
        const expectedCredits = creditsForCostUsd(
          CONSUMPTION_INPUT.costUsd,
          DEFAULT_METER_CONFIG.creditsPerUsd,
        );

        await service.recordConsumption(CONSUMPTION_INPUT);

        expect(credits.debit).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'u1',
            amount: expectedCredits,
            feature: AiFeature.WritingAssistant,
            tokens: 150,
            costUsd: 0.01,
          }),
        );
      });

      it('should emit CreditsLow when balance drops below the threshold (but stays > 0)', async () => {
        const { service, events } = build({ enabled: true, creditBalance: 499 }); // < 500 threshold

        await service.recordConsumption(CONSUMPTION_INPUT);

        expect(events.emit).toHaveBeenCalledWith(
          DomainEventType.CreditsLow,
          expect.objectContaining({ userId: 'u1', balance: 499 }),
        );
      });

      it('should NOT emit CreditsLow when balance is above the threshold', async () => {
        const { service, events } = build({ enabled: true, creditBalance: 5_000 }); // > 500 threshold

        await service.recordConsumption(CONSUMPTION_INPUT);

        const creditsLowCalls = (events.emit as jest.Mock).mock.calls.filter(
          ([type]: [string]) => type === DomainEventType.CreditsLow,
        );
        expect(creditsLowCalls).toHaveLength(0);
      });

      it('should NOT emit CreditsLow when balance is exactly 0 (entirely spent)', async () => {
        const { service, events } = build({ enabled: true, creditBalance: 0 });

        await service.recordConsumption(CONSUMPTION_INPUT);

        const creditsLowCalls = (events.emit as jest.Mock).mock.calls.filter(
          ([type]: [string]) => type === DomainEventType.CreditsLow,
        );
        // balance > 0 check gates the alert — 0 balance means fully spent, not low
        expect(creditsLowCalls).toHaveLength(0);
      });

      it('should swallow errors from the debit call (never propagate metering failures)', async () => {
        const { service, credits } = build({ enabled: true });
        (credits.debit as jest.Mock).mockRejectedValue(new Error('db error'));

        // Must resolve — metering must never break a completed generation
        await expect(service.recordConsumption(CONSUMPTION_INPUT)).resolves.toBeUndefined();
      });
    });
  });
});
