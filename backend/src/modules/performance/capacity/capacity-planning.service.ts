import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { databaseConfig } from '../../../config/database.config';
import { performanceConfig } from '../../../config/performance.config';
import { QUEUE_NAMES } from '../../../common/queue/queue.constants';
import { workerConcurrency } from '../../../infrastructure/queue/worker-concurrency';
import { QueueMonitorService } from '../../../infrastructure/monitoring/queue-monitor.service';
import { RedisService } from '../../../redis/redis.service';
import { CAPACITY_MODELS, type CapacityModel } from '../performance.constants';
import { ThroughputAnalysisService } from '../analysis/throughput-analysis.service';
import { nowIso } from '../performance.util';
import type { CapacityForecast, CapacityPlan } from '../performance.types';

/**
 * Capacity Planning Service (P7.3) — forecasts each resource against its ceiling
 * and recommends a scaling lever when utilization crosses the threshold. It
 * COMPOSES existing seams to read live utilization (throughput → API rps, the
 * queue monitor → active workers/backlog, Redis INFO → memory, the pool config +
 * `pg_stat_activity` → DB connections) rather than owning any new counters.
 * Limits come from {@link CAPACITY_MODELS}, overridable per deployment via
 * {@link performanceConfig}. Everything is best-effort: an unreachable dependency
 * yields a model-only ceiling, never an error.
 */
@Injectable()
export class CapacityPlanningService {
  private readonly logger = new Logger(CapacityPlanningService.name);

  constructor(
    private readonly throughput: ThroughputAnalysisService,
    private readonly queues: QueueMonitorService,
    private readonly redis: RedisService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(databaseConfig.KEY) private readonly db: ConfigType<typeof databaseConfig>,
    @Inject(performanceConfig.KEY) private readonly config: ConfigType<typeof performanceConfig>,
  ) {}

  async plan(): Promise<CapacityPlan> {
    const forecasts = await Promise.all(CAPACITY_MODELS.map((m) => this.forecast(m)));
    const scalingRecommendations = forecasts
      .filter((f) => f.shouldScale)
      .map((f) => `${f.label} at ${f.utilizationPercent}% → ${f.scaleLever}`);
    return { generatedAt: nowIso(), forecasts, scalingRecommendations };
  }

  private async forecast(model: CapacityModel): Promise<CapacityForecast> {
    const limit = this.effectiveLimit(model);
    const used = await this.usedFor(model);
    const utilizationPercent = limit <= 0 ? 0 : round2((used / limit) * 100);
    return {
      resource: model.resource,
      label: model.label,
      unit: model.unit,
      limit,
      used: round2(used),
      utilizationPercent,
      scaleAtPercent: model.scaleAtPct,
      shouldScale: utilizationPercent >= model.scaleAtPct,
      scaleLever: model.scaleLever,
      headroom: round2(Math.max(0, limit - used)),
    };
  }

  /** Apply per-deployment overrides (0 = keep the model default). */
  private effectiveLimit(model: CapacityModel): number {
    switch (model.resource) {
      case 'db.connections':
        return this.db.pool.max;
      case 'workers':
        return this.aggregateWorkerConcurrency();
      case 'api.rps':
        return this.config.capacity.apiRps || model.limit;
      case 'redis.memory':
        return this.config.capacity.redisMemoryBytes || model.limit;
      case 'ai.tokens_daily':
        return this.config.capacity.aiTokensDaily || model.limit;
      default:
        return model.limit;
    }
  }

  private aggregateWorkerConcurrency(): number {
    return QUEUE_NAMES.reduce((sum, q) => sum + workerConcurrency(q), 0);
  }

  private async usedFor(model: CapacityModel): Promise<number> {
    try {
      switch (model.resource) {
        case 'api.rps':
          return this.throughput.analyze().byKind.http?.rps ?? 0;
        case 'workers':
          return await this.activeJobCount();
        case 'db.connections':
          return await this.activeDbConnections();
        case 'redis.memory':
          return await this.redisUsedMemoryBytes();
        default:
          // storage.objects / ai.tokens_daily — no cheap live gauge here; the
          // model ceiling is reported for planning (documented in docs 43).
          return 0;
      }
    } catch (error) {
      this.logger.warn(
        `capacity signal unavailable for ${model.resource}: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  private async activeJobCount(): Promise<number> {
    const queues = await this.queues.listQueues();
    return queues.reduce((sum, q) => sum + (q.counts.active ?? 0), 0);
  }

  private async activeDbConnections(): Promise<number> {
    const rows = (await this.dataSource.query(
      'SELECT count(*)::int AS c FROM pg_stat_activity WHERE datname = current_database()',
    )) as Array<{ c: number }>;
    return rows[0]?.c ?? 0;
  }

  private async redisUsedMemoryBytes(): Promise<number> {
    const info = await this.redis.getClient('cache').info('memory');
    const match = /used_memory:(\d+)/.exec(info);
    return match ? Number(match[1]) : 0;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
