import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentStatus, SubscriptionEventType } from '@qalam/shared';
import { Repository } from 'typeorm';

import { UsageService as AiUsageService } from '../ai';

import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionEvent } from './entities/subscription-event.entity';

/** One currency's slice of the revenue overview — the same four figures, in ONE unit. */
export interface RevenueByCurrency {
  /** The payment row's currency code, lower-cased as stored (e.g. `usd`). */
  currency: string;
  totalRevenue: number;
  last30dRevenue: number;
  refunded: number;
  paymentsCount: number;
}

/**
 * Revenue overview for the admin dashboard.
 *
 * **The four scalars sum ACROSS currencies and always have** — `1000 usd + 1000 inr` reads as
 * `2000`. `byCurrency` (B8, docs/48 §3, A1-6) is the figure that is actually addable; the scalars
 * keep their exact former type and meaning because the admin dashboard already reads them and §8 of
 * the freeze forbids retyping a shipped field. On a single-currency install the one `byCurrency` row
 * equals the scalars, which is the property the spec pins.
 */
export interface RevenueAnalytics {
  totalRevenue: number;
  last30dRevenue: number;
  refunded: number;
  paymentsCount: number;
  /** Per-currency breakdown, highest total first. Empty only when no payment row exists. */
  byCurrency: RevenueByCurrency[];
}

/** Subscription + conversion metrics. */
export interface SubscriptionAnalytics {
  byStatus: Record<string, number>;
  byTier: Record<string, number>;
  activeCount: number;
  trialingCount: number;
  last30d: { created: number; upgraded: number; downgraded: number; canceled: number };
}

/** AI usage + cost metrics. */
export interface UsageAnalytics {
  totalTokens: number;
  totalCostUsd: number;
  last30dCostUsd: number;
  byFeature: Array<{ feature: string; tokens: number; costUsd: number }>;
}

/**
 * Admin monetization analytics (AF5) — computed on read from the append-only ledgers
 * (payments, subscription_events, credit_transactions) so revenue/subscription/usage/
 * AI-cost dashboards need no separate rollup table. (Pre-aggregation into a dedicated
 * monetization aggregate + a domain-event listener is a documented scale seam.) Also the
 * observability surface: these are the revenue/conversion/AI-cost metrics.
 */
@Injectable()
export class MonetizationAnalyticsService {
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Subscription) private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionEvent)
    private readonly events: Repository<SubscriptionEvent>,
    private readonly aiUsage: AiUsageService,
  ) {}

  async revenue(): Promise<RevenueAnalytics> {
    const since = this.daysAgo(30);
    const [total, recent, refunded, count, byCurrency] = await Promise.all([
      this.sumPayments(PaymentStatus.Succeeded, null),
      this.sumPayments(PaymentStatus.Succeeded, since),
      this.sumPayments(PaymentStatus.Refunded, null),
      this.payments.count({ where: { status: PaymentStatus.Succeeded } }),
      this.revenueByCurrency(since),
    ]);
    return {
      totalRevenue: total,
      last30dRevenue: recent,
      refunded: Math.abs(refunded),
      paymentsCount: count,
      byCurrency,
    };
  }

  async subscriptions(): Promise<SubscriptionAnalytics> {
    const byStatus = await this.groupCount(this.subscriptionRepo, 's', 'status');
    const byTier = await this.groupCount(this.subscriptionRepo, 's', 'tier');
    const since = this.daysAgo(30);
    const [created, upgraded, downgraded, canceled] = await Promise.all([
      this.countEvents(SubscriptionEventType.Created, since),
      this.countEvents(SubscriptionEventType.Upgraded, since),
      this.countEvents(SubscriptionEventType.Downgraded, since),
      this.countEvents(SubscriptionEventType.Canceled, since),
    ]);
    return {
      byStatus,
      byTier,
      activeCount: byStatus.active ?? 0,
      trialingCount: byStatus.trialing ?? 0,
      last30d: { created, upgraded, downgraded, canceled },
    };
  }

  /**
   * Platform AI cost, for the operator.
   *
   * Reads `ai_usage_logs` through the AI module's own service since D5. It used to read the
   * monetization CREDIT ledger, which was a mirror of those rows written by the meter; the
   * mirror is gone, so this reads the original rather than a table that would now be empty.
   * Tokens and cost stay an ADMIN concern — D5 removed them from the writer's view, not the
   * operator's.
   */
  async usage(): Promise<UsageAnalytics> {
    const [totals, recent, byFeature] = await Promise.all([
      this.aiUsage.platformTotals(),
      this.aiUsage.platformTotals(this.daysAgo(30)),
      this.aiUsage.platformByFeature(),
    ]);
    return {
      totalTokens: totals.totalTokens,
      totalCostUsd: totals.totalCostUsd,
      last30dCostUsd: recent.totalCostUsd,
      byFeature,
    };
  }

  /**
   * The same four revenue figures, GROUPED BY currency, in one pass over the payments ledger.
   *
   * One query rather than four-per-currency: the currencies are not known ahead of time, so a
   * per-currency loop would need a `SELECT DISTINCT currency` first and then N round trips that grow
   * with the install. Conditional aggregation keeps it at exactly one scan whatever the mix.
   *
   * `refunded` is `ABS`-ed per row inside the sum rather than on the total, because a refund row is
   * stored negative and a currency that has ONLY refunds must not report a negative "refunded".
   */
  private async revenueByCurrency(since: Date): Promise<RevenueByCurrency[]> {
    const rows = await this.payments
      .createQueryBuilder('p')
      .select('p.currency', 'currency')
      .addSelect(
        'COALESCE(SUM(CASE WHEN p.status = :succeeded THEN p.amount ELSE 0 END), 0)',
        'total',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN p.status = :succeeded AND p.created_at >= :since THEN p.amount ELSE 0 END), 0)',
        'recent',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN p.status = :refunded THEN ABS(p.amount) ELSE 0 END), 0)',
        'refunded',
      )
      .addSelect('COUNT(*) FILTER (WHERE p.status = :succeeded)', 'count')
      .where('p.status IN (:...statuses)', {
        statuses: [PaymentStatus.Succeeded, PaymentStatus.Refunded],
      })
      .setParameters({
        succeeded: PaymentStatus.Succeeded,
        refunded: PaymentStatus.Refunded,
        since,
      })
      .groupBy('p.currency')
      .getRawMany<{
        currency: string;
        total: string;
        recent: string;
        refunded: string;
        count: string;
      }>();

    return rows
      .map((row) => ({
        currency: row.currency,
        totalRevenue: Number(row.total),
        last30dRevenue: Number(row.recent),
        refunded: Number(row.refunded),
        paymentsCount: Number(row.count),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  private async sumPayments(status: PaymentStatus, since: Date | null): Promise<number> {
    const qb = this.payments
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.status = :status', { status });
    if (since !== null) {
      qb.andWhere('p.created_at >= :since', { since });
    }
    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async groupCount<E extends object>(
    repo: Repository<E>,
    alias: string,
    column: string,
  ): Promise<Record<string, number>> {
    const rows = await repo
      .createQueryBuilder(alias)
      .select(`${alias}.${column}`, 'key')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`${alias}.${column}`)
      .getRawMany<{ key: string; count: string }>();
    const out: Record<string, number> = {};
    for (const row of rows) {
      out[row.key] = Number(row.count);
    }
    return out;
  }

  private async countEvents(type: SubscriptionEventType, since: Date): Promise<number> {
    return this.events
      .createQueryBuilder('e')
      .where('e.type = :type', { type })
      .andWhere('e.created_at >= :since', { since })
      .getCount();
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * 86_400_000);
  }
}
