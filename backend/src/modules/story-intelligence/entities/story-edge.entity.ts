import type { StoryEdgeType } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';
import type { StoryEvidenceRef } from '../story.types';

/**
 * An edge in the story knowledge graph (AF3) — a typed link between two nodes
 * (relationship / mention / appears-in / occurs-at / involves / precedes / …).
 * `type` is an OPEN varchar keyed to the `@qalam/shared` catalogue. Upserts dedupe on
 * `(graphId, sourceId, targetId, type)`. `sourceId`/`targetId` are plain uuid columns
 * (node ids), no relation decorators (module isolation).
 */
@Entity('story_edges')
@Index('idx_story_edges_graph', ['graphId'])
@Index('idx_story_edges_source', ['sourceId'])
@Index('uq_story_edges_graph_src_tgt_type', ['graphId', 'sourceId', 'targetId', 'type'], {
  unique: true,
})
export class StoryEdge extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  graphId!: string;

  @Column({ type: 'uuid' })
  sourceId!: string;

  @Column({ type: 'uuid' })
  targetId!: string;

  @Column({ type: 'varchar', length: 40 })
  type!: StoryEdgeType;

  @Column({ type: 'varchar', length: 300, default: '' })
  label!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  data!: Record<string, unknown>;

  @Column({ type: 'real', default: 0 })
  confidence!: number;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  evidence!: StoryEvidenceRef[];
}
