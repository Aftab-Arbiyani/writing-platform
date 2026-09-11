import { Injectable } from '@nestjs/common';
import {
  AI_QUOTA_RULES,
  QuotaWindow,
  quotaRuleForAiFeature,
  resolvePlanLimit,
} from '@umberleaf/shared';
import type { AiFeature } from '@umberleaf/shared';

import { UsageService as AiUsageService } from '../ai';
import { EntitlementService } from './entitlement.service';
import { QuotaExceededException } from './monetization.exceptions';

/** One per-feature allowance and what the user has spent of it (D5). */
export interface FeatureQuota {
  limitKey: string;
  label: string;
  window: QuotaWindow;
  used: number;
  /** `null` when the plan grants this allowance without limit. */
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
  resetsAt: string | null;
}

/**
 * The Usage service (AF5) — where a plan's limits meet what a user has actually done.
 *
 * It owns the QUOTA decision. Since D5 that is a count of ACTIONS against a per-feature
 * allowance ({@link assertWithinQuota}), not a token budget: the writer is told "12 of 30
 * polishes today", so that is the unit enforced. The counts come from the AI platform's own
 * `ai_usage_logs` through its exported `UsageService` — one row per completed generation —
 * rather than a second counter kept in step here.
 *
 * That is also why this module imports the AI module and not the reverse. The AI platform
 * stays ignorant of plans and money (it reaches monetization only through the optional
 * `AI_USAGE_METER` port); monetization is allowed to know what a generation is.
 *
 * **This service no longer touches `credit_transactions`.** It used to also serve
 * daily/monthly/lifetime token rollups and a spend forecast, computed by aggregating the
 * credit ledger. Those went with the vocabulary contract, and the ledger was the reason they
 * had to: B4 stopped writing that table, so the figures had already begun decaying toward
 * zero while still being presented as a measurement, and Phase C drops the table outright —
 * at which point the query would have failed rather than merely misled. Cost and token
 * accounting live in `ai_usage_logs` and are read by the admin dashboards, which is where a
 * business signal belongs; a writer is shown actions, not tokens.
 */
@Injectable()
export class UsageService {
  constructor(
    private readonly entitlements: EntitlementService,
    private readonly aiUsage: AiUsageService,
  ) {}

  /**
   * Throw QUOTA_EXCEEDED if this feature's per-plan allowance is already spent (D5).
   *
   * Counts ACTIONS, not tokens: the rule for the feature says which AI features share the
   * allowance and over what window, and the count comes from `ai_usage_logs` — one row per
   * completed generation — so the unit the writer is told about ("12 of 30 today") is the
   * unit the server enforces.
   *
   * A feature with no rule is uncounted and passes; `uncountedPaidAiFeatures` is the guard
   * that stops a *sold* feature landing in that bucket by accident.
   *
   * Checked BEFORE a generation, so a burst of concurrent requests can overshoot by one or
   * two. That was true of the token cap too and is the right trade: allowances bound
   * sustained use, and paying for a serialising lock on every request to make the boundary
   * exact would cost more than the overshoot.
   *
   * `reserve` lets a caller that will spend several in one action — "Map this story" runs
   * five analyses — check the whole cost up front instead of failing halfway through.
   */
  async assertWithinQuota(userId: string, feature: AiFeature, reserve = 1): Promise<void> {
    const rule = quotaRuleForAiFeature(feature);
    if (rule === null) return;

    const limits = await this.entitlements.getLimits(userId);
    // Read through the resolver, never the raw number — it is the one place the two sentinel
    // conventions are reconciled. These keys are ordinary (`0` = unlimited).
    const limit = resolvePlanLimit(limits, rule.limitKey);
    if (limit.unlimited) return;

    const used = await this.aiUsage.countRequestsSince(userId, rule.features, this.since(rule));
    if (used + reserve > limit.value) {
      throw new QuotaExceededException(rule.window, {
        limitKey: rule.limitKey,
        label: rule.label,
        used,
        limit: limit.value,
        resetsAt: this.resetsAt(rule.window)?.toISOString() ?? '',
      });
    }
  }

  /** Every allowance for a user, with what they have spent — the client's usage surface. */
  async quotas(userId: string): Promise<FeatureQuota[]> {
    const limits = await this.entitlements.getLimits(userId);
    return Promise.all(
      AI_QUOTA_RULES.map(async (rule): Promise<FeatureQuota> => {
        const limit = resolvePlanLimit(limits, rule.limitKey);
        const used = await this.aiUsage.countRequestsSince(userId, rule.features, this.since(rule));
        return {
          limitKey: rule.limitKey,
          label: rule.label,
          window: rule.window,
          used,
          limit: limit.unlimited ? null : limit.value,
          remaining: limit.unlimited ? null : Math.max(0, limit.value - used),
          unlimited: limit.unlimited,
          resetsAt: this.resetsAt(rule.window)?.toISOString() ?? null,
        };
      }),
    );
  }

  private since(rule: { window: QuotaWindow }): Date {
    return rule.window === QuotaWindow.Monthly ? this.startOfMonthUtc() : this.startOfDayUtc();
  }

  private resetsAt(window: QuotaWindow): Date | null {
    const now = new Date();
    if (window === QuotaWindow.Daily) {
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    }
    if (window === QuotaWindow.Monthly) {
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    }
    return null;
  }

  private startOfDayUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private startOfMonthUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
}
