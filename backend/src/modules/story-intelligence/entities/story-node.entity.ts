import type { StoryNodeType } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';
import type { StoryEvidenceRef } from '../story.types';

/**
 * A node in the story knowledge graph (AF3) — a durable entity discovered by analysis
 * (character/location/organization/object/event/concept). `type` is an OPEN varchar
 * keyed to the `@qalam/shared` catalogue so a new entity kind never needs a migration.
 * `data` carries the type-specific structured fields (traits/goals/arc for characters;
 * rules/lore for concepts; chrono order/kind for events). Upserts dedupe on
 * `(graphId, type, normalizedName)` — the same character across analyses merges, not
 * duplicates. Plain `graphId` FK column, no relation decorator (module isolation).
 */
@Entity('story_nodes')
@Index('idx_story_nodes_graph_type', ['graphId', 'type'])
@Index('uq_story_nodes_graph_type_name', ['graphId', 'type', 'normalizedName'], { unique: true })
export class StoryNode extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  graphId!: string;

  @Column({ type: 'varchar', length: 40 })
  type!: StoryNodeType;

  @Column({ type: 'varchar', length: 300 })
  name!: string;

  /** Case/whitespace-folded name for idempotent upsert (normalizeStoryName). */
  @Column({ type: 'varchar', length: 300 })
  normalizedName!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  aliases!: string[];

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  data!: Record<string, unknown>;

  @Column({ type: 'real', default: 0 })
  confidence!: number;

  @Column({ type: 'int', default: 0 })
  mentionCount!: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  firstChapter!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  evidence!: StoryEvidenceRef[];
}
