import { Column, Entity, Index } from 'typeorm';
import type { AiFeature, AiProvider } from '@qalam/shared';

import { QalamAppendOnlyEntity } from '../../../../common/base/append-only.entity';

/**
 * One AI call's token accounting row (AF1) — append-only (never mutated): every
 * completed generation records exactly one. Powers per-user and per-feature usage
 * history + the daily/monthly limit checks. `costUsd` is the estimated USD cost
 * from the model's rates at call time.
 */
@Entity('ai_usage_logs')
@Index('idx_ai_usage_user_created', ['userId', 'createdAt'])
@Index('idx_ai_usage_feature', ['feature'])
export class AiUsageLog extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 40 })
  feature!: AiFeature;

  @Column({ type: 'varchar', length: 40 })
  provider!: AiProvider;

  @Column({ type: 'varchar', length: 120 })
  model!: string;

  @Column({ type: 'int', default: 0 })
  inputTokens!: number;

  @Column({ type: 'int', default: 0 })
  outputTokens!: number;

  @Column({ type: 'int', default: 0 })
  totalTokens!: number;

  @Column({ type: 'double precision', default: 0 })
  costUsd!: number;

  /** The conversation this call belonged to, if any. */
  @Column({ type: 'uuid', nullable: true })
  conversationId!: string | null;

  /** Correlation id of the originating request (ADR §9). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  requestId!: string | null;
}
