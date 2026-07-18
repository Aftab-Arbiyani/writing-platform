import type { StoryAnalysisKind, StoryAnalysisScope, StoryAnalysisStatus } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';
import type { StoryEvidenceRef } from '../story.types';

/**
 * One analysis run (AF3) — the append-only record of a single structured analysis and
 * the "Analysis History" + "Analysis Results" surface. Holds the structured payload
 * (`structured`), the derived prose (`summary`/`recommendations`), grounding
 * (`evidence`, `affectedChapters`/`affectedCharacters`), the confidence score, and the
 * usage/cost/provenance. `rawOutput` is kept only when the structured parse failed or
 * was partial — never plain text as the primary representation. Every run also upserts
 * nodes/edges into the graph (the single source of truth).
 */
@Entity('story_analyses')
@Index('idx_story_analyses_graph_created', ['graphId', 'createdAt'])
@Index('idx_story_analyses_user_created', ['userId', 'createdAt'])
export class StoryAnalysis extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid' })
  graphId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  kind!: StoryAnalysisKind;

  @Column({ type: 'varchar', length: 20 })
  scope!: StoryAnalysisScope;

  @Column({ type: 'varchar', length: 20 })
  status!: StoryAnalysisStatus;

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  recommendations!: string[];

  @Column({ type: 'real', default: 0 })
  confidenceScore!: number;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  evidence!: StoryEvidenceRef[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  affectedChapters!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  affectedCharacters!: string[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  structured!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  rawOutput!: string | null;

  @Column({ type: 'varchar', length: 40, default: '' })
  provider!: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  model!: string;

  @Column({ type: 'int', default: 0 })
  inputTokens!: number;

  @Column({ type: 'int', default: 0 })
  outputTokens!: number;

  @Column({ type: 'int', default: 0 })
  totalTokens!: number;

  @Column({ type: 'real', default: 0 })
  costUsd!: number;
}
