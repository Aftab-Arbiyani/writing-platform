import { Column, Entity, Index } from 'typeorm';
import type { SnapshotReason } from '@qalam/shared';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * An immutable, read-only content version of a story (AF6). Captured on publish
 * (`reason=publish`), before a destructive edit, at review time, on manual
 * request, or on restore — so a writer can revert to an earlier version.
 *
 * Append-only: a snapshot is INSERTed once and only ever pruned (never UPDATEd),
 * so it extends {@link QalamAppendOnlyEntity} (id/created_at, no updated_at).
 * `version` is a per-story monotonically increasing counter assigned in the
 * service. `publish`/`review` snapshots are kept forever; oldest manual ones are
 * pruned past `MAX_SNAPSHOTS_PER_STORY`.
 */
@Entity('story_snapshots')
@Index('idx_story_snapshot_story_version', ['storyId', 'version'])
export class StorySnapshot extends QalamAppendOnlyEntity {
  /** The story (piece) this snapshot belongs to — `story_id === piece_id`. */
  @Column({ type: 'uuid' })
  storyId!: string;

  /** Per-story version number (1-based, increments on each capture). */
  @Column({ type: 'int' })
  version!: number;

  /** The story title at capture time. */
  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** The full TipTap/ProseMirror content document at capture time. */
  @Column({ type: 'jsonb' })
  content!: Record<string, unknown>;

  /** Derived word count at capture time. */
  @Column({ type: 'int', default: 0 })
  wordCount!: number;

  /** Why the snapshot was taken (see `SnapshotReason`). */
  @Column({ type: 'varchar', length: 20 })
  reason!: SnapshotReason;

  /** The user who triggered the capture. */
  @Column({ type: 'uuid' })
  createdById!: string;
}
