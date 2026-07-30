import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** The single row's fixed primary key. */
export const PLATFORM_ANALYTICS_ID = 'global';

/**
 * Platform-wide materialized counters (E10) — a SINGLETON row (`id = 'global'`),
 * O(1) to read (no full-table scans, docs: "materialized counters"). The listener
 * increments these on events; counters are cumulative since analytics launch.
 * Current-total metrics that have no event (total users, drafts, collections,
 * DAU/MAU, top-N) are computed + Redis-cached by the service, not stored here.
 */
@Entity('platform_analytics')
export class PlatformAnalytics {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  id!: string;

  @Column({ type: 'bigint', default: 0 })
  views!: string;

  @Column({ type: 'bigint', default: 0 })
  uniqueViews!: string;

  @Column({ type: 'bigint', default: 0 })
  reads!: string;

  @Column({ type: 'bigint', default: 0 })
  completedReads!: string;

  @Column({ type: 'bigint', default: 0 })
  publishedPieces!: string;

  @Column({ type: 'bigint', default: 0 })
  archivedPieces!: string;

  @Column({ type: 'bigint', default: 0 })
  comments!: string;

  @Column({ type: 'bigint', default: 0 })
  claps!: string;

  @Column({ type: 'bigint', default: 0 })
  bookmarks!: string;

  @Column({ type: 'bigint', default: 0 })
  responses!: string;

  @Column({ type: 'bigint', default: 0 })
  shares!: string;

  @Column({ type: 'bigint', default: 0 })
  follows!: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
