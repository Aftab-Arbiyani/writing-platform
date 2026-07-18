import type {
  RetrievalFailureReason,
  RetrievalIntent,
  RetrievalQueryType,
  RetrievalSource,
} from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * One retrieval request's telemetry (AF4) — append-only. Backs internal observability +
 * Search Analytics + future offline evaluation datasets. Captures the pipeline's shape
 * and cost (intent, classification, sources, latencies, context size, compression, token
 * usage, cache hit, evidence coverage, confidence, failure classification). It is INTERNAL
 * telemetry — never exposed to end users. `story_id` is the caller's opaque key (nullable
 * for library-wide requests); the query text itself is NOT stored (privacy — only shape).
 */
@Entity('retrieval_query_logs')
@Index('idx_retrieval_logs_created', ['createdAt'])
@Index('idx_retrieval_logs_user_created', ['userId', 'createdAt'])
@Index('idx_retrieval_logs_intent_created', ['intent', 'createdAt'])
export class RetrievalQueryLog extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  intent!: RetrievalIntent;

  @Column({ type: 'varchar', length: 30 })
  queryType!: RetrievalQueryType;

  @Column({ type: 'varchar', length: 120, nullable: true })
  storyId!: string | null;

  /** Retrieval strategies actually executed. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  sources!: RetrievalSource[];

  @Column({ type: 'int', default: 0 })
  totalCandidates!: number;

  @Column({ type: 'int', default: 0 })
  returned!: number;

  @Column({ type: 'int', default: 0 })
  retrievalLatencyMs!: number;

  @Column({ type: 'int', default: 0 })
  rankingLatencyMs!: number;

  @Column({ type: 'int', default: 0 })
  contextAssemblyMs!: number;

  @Column({ type: 'int', default: 0 })
  llmLatencyMs!: number;

  @Column({ type: 'int', default: 0 })
  totalLatencyMs!: number;

  @Column({ type: 'int', default: 0 })
  contextTokens!: number;

  @Column({ type: 'real', default: 1 })
  compressionRatio!: number;

  /** LLM tokens consumed by a grounded synthesis (0 when no synthesis). */
  @Column({ type: 'int', default: 0 })
  tokenUsage!: number;

  @Column({ type: 'boolean', default: false })
  cacheHit!: boolean;

  @Column({ type: 'int', default: 0 })
  evidenceCount!: number;

  @Column({ type: 'real', default: 0 })
  confidence!: number;

  /** 'ok' | 'degraded' | 'no_results' | 'failed'. */
  @Column({ type: 'varchar', length: 20, default: 'ok' })
  status!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  failureReason!: RetrievalFailureReason | null;
}
