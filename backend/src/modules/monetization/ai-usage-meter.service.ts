import { Injectable } from '@nestjs/common';
import { QuotaWindow, quotaRuleForAiFeature, premiumCodeForAiFeature } from '@qalam/shared';

import { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEventType } from '../../common/events/domain-events';
import type { AiUsageMeter, AiUsageQuotaCheck } from '../../common/metering/ai-usage-meter.port';
import { EntitlementService } from './entitlement.service';
import { MonetizationFeatureService } from './monetization.feature-service';
import { QuotaExceededException } from './monetization.exceptions';
import { UsageService } from './usage.service';

/**
 * The AI usage meter (AF5) — the Monetization module's implementation of the `AI_USAGE_METER`
 * port the AI orchestrator delegates to, and the one place a plan's limits meet a generation.
 *
 * `checkQuota` runs before every generation: the requested feature's premium code when it has
 * one (`ai_writing`, `story_intelligence`), then that feature's per-plan allowance. Entitlement
 * is asserted FIRST so a user who is not sold the feature gets ENTITLEMENT_DENIED ("upgrade")
 * rather than QUOTA_EXCEEDED ("wait for the reset") — the conflation docs/48 §3.6 records as W4.
 *
 * **There is no `recordConsumption` any more (D5).** It existed to convert a generation's cost
 * into credits and debit a wallet; with the credit economy gone there is nothing to debit, and
 * `ai_usage_logs` — written by the AI platform itself — is both the cost record and the source
 * the allowance counts. A second write-path here would only be a copy to keep in step.
 *
 * When the monetization platform flag is OFF the meter is a NO-OP, so the AI platform keeps its
 * own token-cap behaviour with zero change (backward-compatible dark launch).
 */
@Injectable()
export class AiUsageMeterService implements AiUsageMeter {
  constructor(
    private readonly feature: MonetizationFeatureService,
    private readonly entitlements: EntitlementService,
    private readonly usage: UsageService,
    private readonly events: DomainEventBus,
  ) {}

  async checkQuota(input: AiUsageQuotaCheck): Promise<void> {
    if (!(await this.feature.isEnabled())) {
      return; // monetization dark → AF1 token caps apply, meter is inert
    }
    // The per-feature premium code, when the feature is sold behind one (D3,
    // docs/45 §4 row D3, docs/48 §6.13). Asserted HERE rather than in `AiFeatureService`
    // for three reasons that all point the same way:
    //
    // 1. It is the one place every AI request already passes through carrying its
    //    `feature` — `AiCompletionService.prepare()` feeds both `complete()` and
    //    `stream()`, so neither path can bypass it and no new port is needed.
    // 2. The AI module must never import monetization (that inversion is the whole
    //    reason the `AI_USAGE_METER` seam exists), so a gate inside `AiFeatureService`
    //    would need a second port to answer a question this one already can.
    // 3. The payments-dark early return above covers it for free: with the flag off
    //    NOBODY holds a subscription, so every user resolves to the free plan and a gate
    //    that ran anyway would take AI writing from EVERYONE, not just free users.
    //    Obeying the meter's existing convention is what makes the dark build correct.
    //
    // Broad-to-narrow is deliberate: `ai_budget` ("may you use AI at all") is asserted
    // first, so a deny override on the budget still reports `ai_budget` as the blocker.
    // Both run BEFORE `assertWithinQuota`, so a user who is not entitled gets
    // ENTITLEMENT_DENIED ("upgrade") and never QUOTA_EXCEEDED ("wait for reset") — the
    // conflation docs/48 §3.6 records against W4.
    const premiumCode = premiumCodeForAiFeature(input.feature);
    if (premiumCode !== null) {
      await this.entitlements.assertAllowed(input.userId, premiumCode);
    }
    try {
      // D5: the allowance is per-feature, so the feature decides which one is checked and
      // over what window. `reserve` lets a caller that spends several in one action say so.
      await this.usage.assertWithinQuota(input.userId, input.feature, input.reserve ?? 1);
    } catch (error) {
      if (error instanceof QuotaExceededException) {
        await this.events.emit(DomainEventType.AiQuotaExceeded, {
          userId: input.userId,
          // The window the allowance actually resets on, read off the exception's own detail
          // rather than hard-coded: `polishActionsPerDay` is daily and reporting it as
          // monthly would misdescribe the event to every consumer downstream.
          window: quotaRuleForAiFeature(input.feature)?.window ?? QuotaWindow.Monthly,
          feature: input.feature,
        });
      }
      throw error;
    }
  }
}
