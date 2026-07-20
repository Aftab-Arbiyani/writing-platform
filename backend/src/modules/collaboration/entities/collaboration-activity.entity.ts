import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * One event in a story's collaboration activity feed (AF6). Append-only in feel
 * (inserted once, never updated) though it extends {@link QalamBaseEntity} for a
 * time-ordered UUIDv7 id and `created_at`. `type` is an open catalogue string
 * (`CollaborationActivity` in @qalam/shared) so new event kinds land without a
 * migration; `metadata` carries per-event context (role changed to, comment id,
 * etc.). `storyId` / `actorId` are plain uuids (no FK — module isolation).
 */
@Entity('collaboration_activities')
@Index('idx_collab_activity_story', ['storyId', 'createdAt'])
export class CollaborationActivity extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  storyId!: string;

  @Column({ type: 'uuid' })
  actorId!: string;

  @Column({ type: 'varchar', length: 40 })
  type!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
