import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreditReason, QuotaWindow } from '@qalam/shared';
import { Repository } from 'typeorm';

import { CreditTransaction } from './entities/credit-transaction.entity';
import { EntitlementService } from './entitlement.service';
import { QuotaExceededException } from './monetization.exceptions';

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
 * The Usage service (AF5) — the single source of truth for AI usage. Every metered AI
 * request writes one `ai_usage` row to the credit ledger (via the meter → Credit service),
 * so this service derives all AI usage — daily/monthly/lifetime rollups, per-feature
 * breakdown, cost, and a linear forecast — from ONE place (no duplicated token counting;
 * the AI platform still keeps its raw provider-token log). It also owns the QUOTA decision:
 * {@link assertWithinQuota} enforces the plan's daily/monthly token caps (0 = unlimited),
 * which the meter calls before every AI request (soft/hard budget protection).
 */
@Injectable()
export class UsageService {
  constructor(
    @InjectRepository(CreditTransaction)
    private readonly ledger: Repository<CreditTransaction>,
    private readonly entitlements: EntitlementService,
  ) {}

  /**
   * Throw QUOTA_EXCEEDED if the user has already reached their plan's daily or monthly
   * AI token cap. Checked BEFORE a generation (the caller may slightly exceed on the final
   * call — caps bound sustained use, they are not byte-exact gates).
   */
  async assertWithinQuota(userId: string): Promise<void> {
    const limits = await this.entitlements.getLimits(userId);
    if (limits.aiDailyTokens > 0) {
      const daily = await this.sumTokensSince(userId, this.startOfDayUtc());
      if (daily >= limits.aiDailyTokens) {
        throw new QuotaExceededException(QuotaWindow.Daily);
      }
    }
    if (limits.aiMonthlyTokens > 0) {
      const monthly = await this.sumTokensSince(userId, this.startOfMonthUtc());
      if (monthly >= limits.aiMonthlyTokens) {
        throw new QuotaExceededException(QuotaWindow.Monthly);
      }
    }
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

  private async sumTokensSince(userId: string, since: Date): Promise<number> {
    const row = await this.ledger
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.tokens), 0)', 'tokens')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.reason = :reason', { reason: CreditReason.AiUsage })
      .andWhere('t.created_at >= :since', { since })
      .getRawOne<{ tokens: string }>();
    return Number(row?.tokens ?? 0);
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
