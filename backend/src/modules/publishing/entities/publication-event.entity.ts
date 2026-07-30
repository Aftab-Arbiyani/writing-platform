import { Column, Entity, Index } from 'typeorm';
import type { PublicationEvent as PublicationEventType } from '@qalam/shared';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * One entry of a story's publishing history (AF6) — the immutable audit trail of
 * its publication lifecycle (submitted / approved / published / scheduled /
 * unpublished / visibility_changed / snapshot_created / reverted, …).
 *
 * Append-only: inserted once, never mutated, so it extends
 * {@link QalamAppendOnlyEntity} (id/created_at). `story_id` / `actor_id` are
 * plain uuids with NO SQL FK — the history survives independently of the
 * `pieces`/`users` lifecycles (docs 04 §1.4). `type` is an OPEN `varchar`
 * catalogue (see `PublicationEvent`) so a new event kind needs no migration.
 */
@Entity('publication_events')
@Index('idx_publication_event_story_created', ['storyId', 'createdAt'])
export class PublicationEvent extends QalamAppendOnlyEntity {
  /** The story (piece) this event belongs to — `story_id === piece_id`. */
  @Column({ type: 'uuid' })
  storyId!: string;

  /** The user who caused the event. */
  @Column({ type: 'uuid' })
  actorId!: string;

  /** The event kind (dot-free open catalogue — see `PublicationEvent`). */
  @Column({ type: 'varchar', length: 40 })
  type!: PublicationEventType;

  /** Structured context for the event (scheduled time, snapshot version, …). */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
