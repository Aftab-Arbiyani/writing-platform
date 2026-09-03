import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AI_QUOTA_RULES,
  CreditReason,
  QuotaWindow,
  quotaRuleForAiFeature,
  resolvePlanLimit,
} from '@qalam/shared';
import type { AiFeature } from '@qalam/shared';
import { Repository } from 'typeorm';

import { UsageService as AiUsageService } from '../ai';
import { CreditTransaction } from './entities/credit-transaction.entity';
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

/** A usage roll-up over one window. */
export interface UsageWindowSummary {
  window: QuotaWindow;
  tokens: number;
  credits: number;
  requests: number;
  costUsd: number;
  tokenLimit: number | null;
  creditLimit: number | null;
  usedFraction: number | null;
  resetsAt: string | null;
}

/** The full usage picture + a simple linear forecast to period end. */
export interface UsageSummary {
  daily: UsageWindowSummary;
  monthly: UsageWindowSummary;
  total: UsageWindowSummary;
  byFeature: Array<{ feature: string; tokens: number; credits: number; requests: number }>;
  forecastMonthlyTokens: number;
  forecastMonthlyCostUsd: number;
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
 * The token/credit rollups below are the pre-D5 surface and are on their way out with the
 * credit ledger they read.
 */
@Injectable()
export class UsageService {
  constructor(
    @InjectRepository(CreditTransaction)
    private readonly ledger: Repository<CreditTransaction>,
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

  /** The caller's full usage summary (daily/monthly/lifetime + per feature + forecast). */
  async getSummary(userId: string): Promise<UsageSummary> {
    const limits = await this.entitlements.getLimits(userId);
    const [daily, monthly, total, byFeature] = await Promise.all([
      this.windowSummary(userId, QuotaWindow.Daily, this.startOfDayUtc(), limits),
      this.windowSummary(userId, QuotaWindow.Monthly, this.startOfMonthUtc(), limits),
      this.windowSummary(userId, QuotaWindow.Total, null, limits),
      this.featureBreakdown(userId),
    ]);

    // Linear projection: monthly-so-far scaled by (days in month / days elapsed).
    const now = new Date();
    const daysElapsed = Math.max(1, now.getUTCDate());
    const daysInMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const factor = daysInMonth / daysElapsed;
    return {
      daily,
      monthly,
      total,
      byFeature,
      forecastMonthlyTokens: Math.round(monthly.tokens * factor),
      forecastMonthlyCostUsd: Number((monthly.costUsd * factor).toFixed(4)),
    };
  }

  private async windowSummary(
    userId: string,
    window: QuotaWindow,
    since: Date | null,
    limits: { aiDailyTokens: number; aiMonthlyTokens: number; aiMonthlyCredits: number },
  ): Promise<UsageWindowSummary> {
    const qb = this.ledger
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.tokens), 0)', 'tokens')
      .addSelect('COALESCE(SUM(CASE WHEN t.type = :debit THEN -t.delta ELSE 0 END), 0)', 'credits')
      .addSelect('COALESCE(SUM(t.cost_usd), 0)', 'cost')
      .addSelect('COUNT(*)', 'requests')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.reason = :reason', { reason: CreditReason.AiUsage })
      .setParameter('debit', 'debit');
    if (since !== null) {
      qb.andWhere('t.created_at >= :since', { since });
    }
    const row = await qb.getRawOne<{
      tokens: string;
      credits: string;
      cost: string;
      requests: string;
    }>();
    const tokens = Number(row?.tokens ?? 0);
    const tokenLimit =
      window === QuotaWindow.Daily
        ? limits.aiDailyTokens || null
        : window === QuotaWindow.Monthly
          ? limits.aiMonthlyTokens || null
          : null;
    const creditLimit = window === QuotaWindow.Monthly ? limits.aiMonthlyCredits || null : null;
    return {
      window,
      tokens,
      credits: Number(row?.credits ?? 0),
      requests: Number(row?.requests ?? 0),
      costUsd: Number(row?.cost ?? 0),
      tokenLimit,
      creditLimit,
      usedFraction: tokenLimit !== null ? Math.min(1, tokens / tokenLimit) : null,
      resetsAt: this.resetsAt(window)?.toISOString() ?? null,
    };
  }

  private async featureBreakdown(
    userId: string,
  ): Promise<Array<{ feature: string; tokens: number; credits: number; requests: number }>> {
    const rows = await this.ledger
      .createQueryBuilder('t')
      .select('t.feature', 'feature')
      .addSelect('COALESCE(SUM(t.tokens), 0)', 'tokens')
      .addSelect('COALESCE(SUM(CASE WHEN t.type = :debit THEN -t.delta ELSE 0 END), 0)', 'credits')
      .addSelect('COUNT(*)', 'requests')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.reason = :reason', { reason: CreditReason.AiUsage })
      .andWhere('t.feature IS NOT NULL')
      .setParameter('debit', 'debit')
      .groupBy('t.feature')
      .getRawMany<{ feature: string; tokens: string; credits: string; requests: string }>();
    return rows.map((r) => ({
      feature: r.feature,
      tokens: Number(r.tokens),
      credits: Number(r.credits),
      requests: Number(r.requests),
    }));
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
