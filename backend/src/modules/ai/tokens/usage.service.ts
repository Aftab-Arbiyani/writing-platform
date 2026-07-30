import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { AiUsageWindow } from '@qalam/shared';
import type { AiFeature, AiProvider, AiTokenUsage } from '@qalam/shared';
import { Repository } from 'typeorm';

import { aiConfig } from '../../../config/ai.config';
import { AiUsageLimitExceededException } from '../ai.exceptions';
import { AiUsageLog } from './entities/ai-usage-log.entity';

/** A usage roll-up over one window. */
export interface AiUsageWindowSummary {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  estimatedCostUsd: number;
  tokenLimit: number | null;
  usedFraction: number | null;
}

/** The full usage picture for a user. */
export interface AiUsageSummary {
  daily: AiUsageWindowSummary;
  monthly: AiUsageWindowSummary;
  total: AiUsageWindowSummary;
  byFeature: Array<{ feature: AiFeature; totalTokens: number; requests: number }>;
}

/** A row to record after a completed call. */
export interface RecordUsageInput {
  userId: string;
  feature: AiFeature;
  provider: AiProvider;
  model: string;
  usage: AiTokenUsage;
  costUsd: number;
  conversationId?: string | null;
  requestId?: string | null;
}

/**
 * Token accounting (AF1): records per-call usage, aggregates it per user / per
 * feature over daily / monthly / lifetime windows, and enforces the per-user
 * daily + monthly token caps (org defaults from `aiConfig`; 0 = unlimited).
 * Centralized so no feature re-implements token counting or limit logic.
 */
@Injectable()
export class UsageService {
  constructor(
    @Inject(aiConfig.KEY) private readonly cfg: ConfigType<typeof aiConfig>,
    @InjectRepository(AiUsageLog) private readonly repo: Repository<AiUsageLog>,
  ) {}

  /** Record one completed call's usage. */
  async record(input: RecordUsageInput): Promise<void> {
    await this.repo.save(
      this.repo.create({
        userId: input.userId,
        feature: input.feature,
        provider: input.provider,
        model: input.model,
        inputTokens: input.usage.inputTokens,
        outputTokens: input.usage.outputTokens,
        totalTokens: input.usage.totalTokens,
        costUsd: input.costUsd,
        conversationId: input.conversationId ?? null,
        requestId: input.requestId ?? null,
      }),
    );
  }

  /**
   * Throws `AI_USAGE_LIMIT_EXCEEDED` if the user has already reached the daily or
   * monthly token cap. Called BEFORE a generation (the caller may slightly exceed
   * on the final call — caps bound sustained use, they are not hard byte gates).
   */
  async assertWithinLimits(userId: string): Promise<void> {
    if (this.cfg.dailyTokenLimit > 0) {
      const daily = await this.sumTokensSince(userId, this.startOfDayUtc());
      if (daily >= this.cfg.dailyTokenLimit) {
        throw new AiUsageLimitExceededException(AiUsageWindow.Daily);
      }
    }
    if (this.cfg.monthlyTokenLimit > 0) {
      const monthly = await this.sumTokensSince(userId, this.startOfMonthUtc());
      if (monthly >= this.cfg.monthlyTokenLimit) {
        throw new AiUsageLimitExceededException(AiUsageWindow.Monthly);
      }
    }
  }

  /** The caller's full usage summary (daily / monthly / lifetime + per feature). */
  async getSummary(userId: string): Promise<AiUsageSummary> {
    const [daily, monthly, total, byFeature] = await Promise.all([
      this.windowSummary(userId, this.startOfDayUtc(), this.cfg.dailyTokenLimit),
      this.windowSummary(userId, this.startOfMonthUtc(), this.cfg.monthlyTokenLimit),
      this.windowSummary(userId, null, 0),
      this.featureBreakdown(userId),
    ]);
    return { daily, monthly, total, byFeature };
  }

  private async windowSummary(
    userId: string,
    since: Date | null,
    limit: number,
  ): Promise<AiUsageWindowSummary> {
    const qb = this.repo
      .createQueryBuilder('u')
      .select('COALESCE(SUM(u.input_tokens), 0)', 'input')
      .addSelect('COALESCE(SUM(u.output_tokens), 0)', 'output')
      .addSelect('COALESCE(SUM(u.total_tokens), 0)', 'total')
      .addSelect('COALESCE(SUM(u.cost_usd), 0)', 'cost')
      .addSelect('COUNT(*)', 'requests')
      .where('u.user_id = :userId', { userId });
    if (since !== null) {
      qb.andWhere('u.created_at >= :since', { since });
    }
    const row = await qb.getRawOne<{
      input: string;
      output: string;
      total: string;
      cost: string;
      requests: string;
    }>();
    const totalTokens = Number(row?.total ?? 0);
    const tokenLimit = limit > 0 ? limit : null;
    return {
      inputTokens: Number(row?.input ?? 0),
      outputTokens: Number(row?.output ?? 0),
      totalTokens,
      requests: Number(row?.requests ?? 0),
      estimatedCostUsd: Number(row?.cost ?? 0),
      tokenLimit,
      usedFraction: tokenLimit !== null ? Math.min(1, totalTokens / tokenLimit) : null,
    };
  }

  private async featureBreakdown(
    userId: string,
  ): Promise<Array<{ feature: AiFeature; totalTokens: number; requests: number }>> {
    const rows = await this.repo
      .createQueryBuilder('u')
      .select('u.feature', 'feature')
      .addSelect('COALESCE(SUM(u.total_tokens), 0)', 'total')
      .addSelect('COUNT(*)', 'requests')
      .where('u.user_id = :userId', { userId })
      .groupBy('u.feature')
      .getRawMany<{ feature: AiFeature; total: string; requests: string }>();
    return rows.map((r) => ({
      feature: r.feature,
      totalTokens: Number(r.total),
      requests: Number(r.requests),
    }));
  }

  private async sumTokensSince(userId: string, since: Date): Promise<number> {
    const row = await this.repo
      .createQueryBuilder('u')
      .select('COALESCE(SUM(u.total_tokens), 0)', 'total')
      .where('u.user_id = :userId', { userId })
      .andWhere('u.created_at >= :since', { since })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
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
