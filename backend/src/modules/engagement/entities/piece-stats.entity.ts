import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Denormalized engagement counters for a piece — 1:1 satellite whose PK IS the
 * parent's id (`piece_id`), so a second surrogate identifier would buy nothing
 * (docs 04 §1.3, §3.14). `COUNT(*)` is banned on hot paths (§7); every counter
 * here is bumped in the SAME transaction as its engagement write (§7 layer 1).
 *
 * Rows are created lazily by the engagement counter service (an upsert on first
 * engagement) because the E4 pieces predate this table — from E7 on, a fresh
 * piece could get its stats row at publish time. `comments_count` is the E7
 * comments addition (docs 04 records it); the other columns mirror §3.14 (the
 * `views/reads/reposts/trending` columns are seeded here for schema fidelity and
 * filled by later epics — analytics E5, reposts/trending E6).
 *
 * FK `piece_id` → pieces **ON DELETE CASCADE** lives in the migration (§10).
 */
@Entity('piece_stats')
@Index('idx_piece_stats_trending', ['trendingScore'])
export class PieceStats {
  @PrimaryColumn({ type: 'uuid' })
  pieceId!: string;

  @Column({ type: 'bigint', default: 0 })
  viewsCount!: string;

  @Column({ type: 'bigint', default: 0 })
  readsCount!: string;

  @Column({ type: 'integer', default: 0 })
  likesCount!: number;

  /** Sum of `claps.count` across users (each ≤ 50). */
  @Column({ type: 'integer', default: 0 })
  clapsCount!: number;

  @Column({ type: 'integer', default: 0 })
  bookmarksCount!: number;

  /** Comment nodes on the piece (net-new in E7; soft-deleted tombstones still count). */
  @Column({ type: 'integer', default: 0 })
  commentsCount!: number;

  @Column({ type: 'integer', default: 0 })
  responsesCount!: number;

  @Column({ type: 'integer', default: 0 })
  sharesCount!: number;

  /** reposts + quotes — filled by E6; kept for §3.14 schema fidelity. */
  @Column({ type: 'integer', default: 0 })
  repostsCount!: number;

  @Column({ type: 'double precision', default: 0 })
  trendingScore!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
