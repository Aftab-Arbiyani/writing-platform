import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A unique piece view (E10) — one row per (piece, viewer) so `unique_views` is
 * detected via `INSERT ... ON CONFLICT DO NOTHING` (inserted ⇒ first-ever view).
 * `viewer_key` is `u:<userId>` (authenticated) or `a:<hash>` (anonymous). Total
 * (non-unique) views are gated by a Redis cooldown, not this table, so it stays
 * bounded by distinct-viewer cardinality. Also the recent-views signal for
 * trending (via `created_at`). No FK (analytics ingest hot path, docs 04 §3.9).
 */
@Entity('view_event')
@Index('uq_view_event_piece_viewer', ['pieceId', 'viewerKey'], { unique: true })
@Index('idx_view_event_recent', ['createdAt'])
@Index('idx_view_event_piece', ['pieceId'])
export class ViewEvent extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  pieceId!: string;

  @Column({ type: 'varchar', length: 80 })
  viewerKey!: string;

  @Column({ type: 'uuid', nullable: true })
  viewerId!: string | null;

  @Column({ type: 'boolean', default: false })
  isAuthenticated!: boolean;
}
