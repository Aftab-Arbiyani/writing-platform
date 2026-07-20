import { Injectable, Logger } from '@nestjs/common';
import { CreditReason, PremiumFeature, QuotaWindow, creditsForCostUsd } from '@qalam/shared';

import { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEventType } from '../../common/events/domain-events';
import type {
  AiUsageConsumption,
  AiUsageMeter,
  AiUsageQuotaCheck,
} from '../../common/metering/ai-usage-meter.port';
import { CreditService } from './credit.service';
import { EntitlementService } from './entitlement.service';
import { MonetizationConfigService } from './monetization.config-service';
import { MonetizationFeatureService } from './monetization.feature-service';
import { QuotaExceededException } from './monetization.exceptions';
import { UsageService } from './usage.service';

/**
 * The credit-aware AI usage meter (AF5) — the Monetization module's implementation of the
 * `AI_USAGE_METER` port the AI orchestrator delegates to. This is HOW "every AI request
 * passes through the Usage Service" is realized without duplicating any token counting:
 *
 * - `checkQuota` (before generation): confirms the user is entitled to an AI budget, then
 *   enforces the plan's daily/monthly token quota (budget protection). A QUOTA_EXCEEDED
 *   also emits a cost-alert event.
 * - `recordConsumption` (after generation): converts the cost the AI platform already
 *   computed into credits and debits the ledger (feature-attributed, for usage analytics),
 *   emitting a low-credit alert when the balance drops under the threshold.
 *
 * When the monetization platform flag is OFF, the meter is a NO-OP so the AI platform keeps
 * its own token-cap behavior with zero change (backward compatible dark launch).
 */
@Injectable()
export class AiUsageMeterService implements AiUsageMeter {
  private readonly logger = new Logger(AiUsageMeterService.name);

  constructor(
    private readonly feature: MonetizationFeatureService,
    private readonly entitlements: EntitlementService,
    private readonly usage: UsageService,
    private readonly credits: CreditService,
    private readonly config: MonetizationConfigService,
    private readonly events: DomainEventBus,
  ) {}

  async checkQuota(input: AiUsageQuotaCheck): Promise<void> {
    if (!(await this.feature.isEnabled())) {
      return; // monetization dark → AF1 token caps apply, meter is inert
    }
    // Must be entitled to an AI budget at all (a deny override blocks AI entirely).
    await this.entitlements.assertAllowed(input.userId, PremiumFeature.AiBudget);
    try {
      await this.usage.assertWithinQuota(input.userId);
    } catch (error) {
      if (error instanceof QuotaExceededException) {
        await this.events.emit(DomainEventType.AiQuotaExceeded, {
          userId: input.userId,
          window: QuotaWindow.Monthly,
          feature: input.feature,
        });
      }
      throw error;
    }
  }

  async recordConsumption(input: AiUsageConsumption): Promise<void> {
    if (!(await this.feature.isEnabled())) {
      return;
    }
    try {
      const config = await this.config.getConfig();
      const credits = creditsForCostUsd(input.costUsd, config.creditsPerUsd);
      const balance = await this.credits.debit({
        userId: input.userId,
        amount: credits,
        reason: CreditReason.AiUsage,
        feature: input.feature,
        tokens: input.usage.totalTokens,
        costUsd: input.costUsd,
        refType: 'ai_request',
        refId: input.requestId ?? input.conversationId ?? null,
      });
      if (balance > 0 && balance < config.lowCreditThreshold) {
        await this.events.emit(DomainEventType.CreditsLow, { userId: input.userId, balance });
      }
    } catch (error) {
      // Metering must never break a completed generation — record failures are logged,
      // not propagated (the ai_usage_logs telemetry row was already written by AF1).
      this.logger.error(`usage metering failed for ${input.userId}: ${String(error)}`);
    }
  }
}
