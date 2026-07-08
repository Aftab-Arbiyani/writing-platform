import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Per-reader aggregated metrics (E10) — satellite of the reader's user id,
 * maintained on `ReadCompleted`. `piecesRead` is DISTINCT pieces (incremented
 * only on a reader's first read of a piece); `reads` counts sessions. Reading
 * streak is recomputed per read from `lastReadOn`. Favorite genres/languages are
 * derived at query time from `read_event` (bounded by the reader's reads).
 */
@Entity('reader_analytics')
export class ReaderAnalytics {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'bigint', default: 0 })
  piecesRead!: string;

  @Column({ type: 'bigint', default: 0 })
  reads!: string;

  @Column({ type: 'bigint', default: 0 })
  totalReadSeconds!: string;

  @Column({ type: 'bigint', default: 0 })
  completedReads!: string;

  @Column({ type: 'date', nullable: true })
  lastReadOn!: string | null;

  @Column({ type: 'integer', default: 0 })
  currentStreak!: number;

  @Column({ type: 'integer', default: 0 })
  longestStreak!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
