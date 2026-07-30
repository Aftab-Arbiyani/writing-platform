import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { operationsConfig } from '../../../config/operations.config';
import { PerformancePlatformService } from '../../performance/performance-platform.service';
import { COST_CATEGORY } from '../operations.constants';
import type { CostLine, CostReport } from '../operations.types';
import { nowIso, round2 } from '../operations.util';

/** Cache key for the previous cost estimate (used only to derive the trend). */
const COST_PREV_KEY = 'ops:cost:prev-daily-usd';

/**
 * Cost Observability Service (P7.4) — an internal cost ESTIMATE (never a bill of
 * record), derived from the P7.3 capacity forecasts (AI tokens, storage,
 * bandwidth, DB/Redis/queue utilization) and configured unit rates. It REUSES
 * the capacity plan the Performance Platform already produces — it does not
 * re-measure resource usage — and exposes the estimate for the Cost dashboard +
 * the cost alert. Real billing (Stripe/Apple/Google invoices, cloud bills) plugs
 * in behind this surface later without changing consumers.
 */
@Injectable()
export class CostObservabilityService {
  constructor(
    private readonly performance: PerformancePlatformService,
    private readonly cache: CacheService,
    @Inject(operationsConfig.KEY)
    private readonly config: ConfigType<typeof operationsConfig>,
  ) {}

  /** Build the cost report from the capacity plan + configured rates. */
  async estimate(): Promise<CostReport> {
    const plan = await this.performance.capacity.plan();
    const used = (resource: string): number =>
      plan.forecasts.find((f) => f.resource === resource)?.used ?? 0;

    const rates = this.config.cost;
    const aiTokensDaily = used('ai.tokens_daily');
    const storageBytes = used('storage.objects');
    const storageGib = storageBytes / 1_073_741_824;

    const lines: CostLine[] = [
      {
        category: COST_CATEGORY.Ai,
        label: 'AI tokens',
        dailyUsd: round2((aiTokensDaily / 1_000_000) * rates.aiPerMillionTokensUsd),
        monthlyUsd: round2((aiTokensDaily / 1_000_000) * rates.aiPerMillionTokensUsd * 30),
        basis: 'capacity forecast ai.tokens_daily × configured $/Mtok',
      },
      {
        category: COST_CATEGORY.Storage,
        label: 'Object storage',
        dailyUsd: round2((storageGib * rates.storagePerGibMonthUsd) / 30),
        monthlyUsd: round2(storageGib * rates.storagePerGibMonthUsd),
        basis: 'capacity forecast storage.objects × configured $/GiB-month',
      },
      {
        category: COST_CATEGORY.Infrastructure,
        label: 'Infrastructure baseline',
        dailyUsd: round2(rates.infraMonthlyBaselineUsd / 30),
        monthlyUsd: round2(rates.infraMonthlyBaselineUsd),
        basis: 'configured flat monthly baseline (VM + Redis + Postgres)',
      },
      // Bandwidth / DB / Redis / queue / API / third-party are modeled as part of
      // the infra baseline until a real usage feed is plugged in (documented seam).
      ...this.zeroLines(),
    ];

    const dailyUsd = round2(lines.reduce((sum, l) => sum + l.dailyUsd, 0));
    const monthlyUsd = round2(lines.reduce((sum, l) => sum + l.monthlyUsd, 0));

    return {
      generatedAt: nowIso(),
      currency: 'USD',
      dailyUsd,
      monthlyUsd,
      lines,
      trend: await this.trend(dailyUsd),
    };
  }

  /** The estimated daily cost (used by the cost alert). */
  async dailyUsd(): Promise<number> {
    return (await this.estimate()).dailyUsd;
  }

  /** Compare against the previous persisted estimate to derive a trend. */
  private async trend(dailyUsd: number): Promise<CostReport['trend']> {
    const prev = await this.cache.get<number>(COST_PREV_KEY);
    await this.cache.set(COST_PREV_KEY, dailyUsd, 7 * 24 * 3600);
    if (prev === null) {
      return 'unknown';
    }
    if (dailyUsd > prev * 1.1) {
      return 'rising';
    }
    if (dailyUsd < prev * 0.9) {
      return 'falling';
    }
    return 'stable';
  }

  /** The categories tracked-but-folded-into-baseline (transparency in the report). */
  private zeroLines(): CostLine[] {
    const folded: {
      category: (typeof COST_CATEGORY)[keyof typeof COST_CATEGORY];
      label: string;
    }[] = [
      { category: COST_CATEGORY.Bandwidth, label: 'Bandwidth (egress)' },
      { category: COST_CATEGORY.Database, label: 'Database' },
      { category: COST_CATEGORY.Redis, label: 'Redis' },
      { category: COST_CATEGORY.Queue, label: 'Queue' },
      { category: COST_CATEGORY.Api, label: 'API compute' },
      { category: COST_CATEGORY.ThirdParty, label: 'Third-party services' },
    ];
    return folded.map((f) => ({
      category: f.category,
      label: f.label,
      dailyUsd: 0,
      monthlyUsd: 0,
      basis: 'folded into infrastructure baseline until a metered usage feed is attached',
    }));
  }
}
