import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Per-piece aggregated metrics (E10) — a satellite of `pieces` (PK = piece id),
 * maintained by the analytics event listener (never written by business modules).
 * Holds ONLY analytics-owned data: view/read metrics + share-channel breakdown.
 * Engagement counts (claps/comments/bookmarks/responses) are NOT duplicated here —
 * the piece-analytics API reads those from `piece_stats` (docs: "do not duplicate
 * existing data"). Rows are created lazily (upsert) so pre-existing pieces work.
 */
@Entity('piece_analytics')
@Index('idx_piece_analytics_author', ['authorId'])
export class PieceAnalytics {
  @PrimaryColumn({ type: 'uuid' })
  pieceId!: string;

  /** Denormalized for writer roll-ups + "most popular piece" without a join. */
  @Column({ type: 'uuid' })
  authorId!: string;

  @Column({ type: 'bigint', default: 0 })
  views!: string;

  @Column({ type: 'bigint', default: 0 })
  uniqueViews!: string;

  @Column({ type: 'bigint', default: 0 })
  reads!: string;

  @Column({ type: 'bigint', default: 0 })
  totalReadSeconds!: string;

  @Column({ type: 'bigint', default: 0 })
  completedReads!: string;

  @Column({ type: 'integer', default: 0 })
  sharesInternal!: number;

  @Column({ type: 'integer', default: 0 })
  sharesExternal!: number;

  @Column({ type: 'integer', default: 0 })
  sharesCopyLink!: number;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
