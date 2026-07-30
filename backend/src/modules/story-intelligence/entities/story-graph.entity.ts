import type { StoryAnalysisScope } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * The aggregate root of the story knowledge graph (AF3) — one per (owner, story).
 * `storyId` is the client's opaque story key (a piece id or a local draft id); the
 * module never reaches into the `pieces` tables (docs 16 §3.1 module isolation), so
 * there is no FK to pieces. Counts + `lastAnalyzedAt` are denormalized for cheap list
 * rendering and refreshed in the same transaction that upserts nodes/edges.
 */
@Entity('story_graphs')
@Index('uq_story_graphs_user_story', ['userId', 'storyId'], { unique: true })
export class StoryGraph extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 120 })
  storyId!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title!: string | null;

  @Column({ type: 'int', default: 0 })
  nodeCount!: number;

  @Column({ type: 'int', default: 0 })
  edgeCount!: number;

  @Column({ type: 'int', default: 0 })
  analysisCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastAnalyzedAt!: Date | null;

  /** Last analysis scope, purely informational for the graph header. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  lastScope!: StoryAnalysisScope | null;
}
