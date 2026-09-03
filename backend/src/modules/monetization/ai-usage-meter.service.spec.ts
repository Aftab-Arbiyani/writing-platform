import { AiFeature, AiProvider, PremiumFeature, QuotaWindow } from '@qalam/shared';

import type { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEventType } from '../../common/events/domain-events';
import type { AiUsageQuotaCheck } from '../../common/metering/ai-usage-meter.port';
import { AiUsageMeterService } from './ai-usage-meter.service';
import type { EntitlementService } from './entitlement.service';
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

// ── Factory ────────────────────────────────────────────────────────────────────

function build(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;

  const feature = {
    isEnabled: jest.fn().mockResolvedValue(enabled),
  } as unknown as MonetizationFeatureService;

  const entitlements = {
    assertAllowed: jest.fn().mockResolvedValue({ allowed: true, feature: PremiumFeature.AiBudget }),
  } as unknown as EntitlementService;

  const usage = {
    assertWithinQuota: jest.fn().mockResolvedValue(undefined),
  } as unknown as UsageService;

  const events = {
    emit: jest.fn().mockResolvedValue(undefined),
  } as unknown as DomainEventBus;

  const service = new AiUsageMeterService(feature, entitlements, usage, events);
  return { service, feature, entitlements, usage, events };
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
      /**
       * D5 removed `ai_budget` — the blanket "may you use AI at all" code that existed to guard
       * a credit balance. What remains is the code the FEATURE is sold behind, asserted once.
       */
      it('asserts the feature’s own premium code, and no blanket AI gate', async () => {
        const { service, entitlements } = build({ enabled: true });

        await service.checkQuota(QUOTA_INPUT);

        expect(entitlements.assertAllowed).toHaveBeenCalledTimes(1);
        expect(entitlements.assertAllowed).toHaveBeenCalledWith('u1', PremiumFeature.AiWriting);
      });

      it('should call assertWithinQuota after the entitlement check', async () => {
        const { service, usage } = build({ enabled: true });

        await service.checkQuota(QUOTA_INPUT);

        // D5: the allowance is per-feature, so the feature and the reservation travel with it.
        expect(usage.assertWithinQuota).toHaveBeenCalledWith('u1', AiFeature.WritingAssistant, 1);
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
});
