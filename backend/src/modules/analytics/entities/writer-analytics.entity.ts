import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Per-writer aggregated metrics (E10) — a satellite of the author's user id,
 * rolled up by the analytics listener across all their pieces' view/read events
 * plus follow events. Engagement RECEIVED (comments/claps/bookmarks/responses) is
 * computed at query time by summing the writer's pieces' `piece_stats` (bounded,
 * indexed) rather than duplicated here. Upserted lazily.
 */
@Entity('writer_analytics')
export class WriterAnalytics {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

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
  followersGained!: number;

  @Column({ type: 'integer', default: 0 })
  piecesPublished!: number;

  @Column({ type: 'integer', default: 0 })
  piecesArchived!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
