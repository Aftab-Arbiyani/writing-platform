import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreditReason, PaymentStatus, SubscriptionEventType } from '@qalam/shared';
import { Repository } from 'typeorm';

import { CreditTransaction } from './entities/credit-transaction.entity';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionEvent } from './entities/subscription-event.entity';

/** Revenue overview for the admin dashboard. */
export interface RevenueAnalytics {
  totalRevenue: number;
  last30dRevenue: number;
  refunded: number;
  paymentsCount: number;
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
  totalCreditsConsumed: number;
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
    @InjectRepository(CreditTransaction)
    private readonly ledger: Repository<CreditTransaction>,
  ) {}

  async revenue(): Promise<RevenueAnalytics> {
    const since = this.daysAgo(30);
    const [total, recent, refunded, count] = await Promise.all([
      this.sumPayments(PaymentStatus.Succeeded, null),
      this.sumPayments(PaymentStatus.Succeeded, since),
      this.sumPayments(PaymentStatus.Refunded, null),
      this.payments.count({ where: { status: PaymentStatus.Succeeded } }),
    ]);
    return {
      totalRevenue: total,
      last30dRevenue: recent,
      refunded: Math.abs(refunded),
      paymentsCount: count,
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

  async usage(): Promise<UsageAnalytics> {
    const totals = await this.ledger
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.tokens), 0)', 'tokens')
      .addSelect('COALESCE(SUM(CASE WHEN t.type = :debit THEN -t.delta ELSE 0 END), 0)', 'credits')
      .addSelect('COALESCE(SUM(t.cost_usd), 0)', 'cost')
      .where('t.reason = :reason', { reason: CreditReason.AiUsage })
      .setParameter('debit', 'debit')
      .getRawOne<{ tokens: string; credits: string; cost: string }>();
    const recent = await this.ledger
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.cost_usd), 0)', 'cost')
      .where('t.reason = :reason', { reason: CreditReason.AiUsage })
      .andWhere('t.created_at >= :since', { since: this.daysAgo(30) })
      .getRawOne<{ cost: string }>();
    const byFeature = await this.ledger
      .createQueryBuilder('t')
      .select('t.feature', 'feature')
      .addSelect('COALESCE(SUM(t.tokens), 0)', 'tokens')
      .addSelect('COALESCE(SUM(t.cost_usd), 0)', 'cost')
      .where('t.reason = :reason', { reason: CreditReason.AiUsage })
      .andWhere('t.feature IS NOT NULL')
      .groupBy('t.feature')
      .getRawMany<{ feature: string; tokens: string; cost: string }>();
    return {
      totalTokens: Number(totals?.tokens ?? 0),
      totalCreditsConsumed: Number(totals?.credits ?? 0),
      totalCostUsd: Number(totals?.cost ?? 0),
      last30dCostUsd: Number(recent?.cost ?? 0),
      byFeature: byFeature.map((r) => ({
        feature: r.feature,
        tokens: Number(r.tokens),
        costUsd: Number(r.cost),
      })),
    };
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
