import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * Point-in-time metric snapshots (E10) powering "growth over time" / "growth
 * trends". One row per (scope, subject, period, period_start); the `metrics`
 * jsonb holds the captured counters, so new metrics need no migration.
 * Generated on demand (a service method / admin endpoint) — NOT a background job
 * (out of scope). Growth APIs read these; they never recompute history.
 */
@Entity('analytics_snapshot')
@Index('uq_analytics_snapshot', ['scope', 'subjectId', 'period', 'periodStart'], { unique: true })
@Index('idx_analytics_snapshot_lookup', ['scope', 'subjectId', 'period', 'periodStart'])
export class AnalyticsSnapshot extends QalamBaseEntity {
  /** `platform` | `writer` | `piece` (AnalyticsScope). */
  @Column({ type: 'varchar', length: 20 })
  scope!: string;

  /** The subject key: a user/piece id, or `global` for platform. */
  @Column({ type: 'varchar', length: 64 })
  subjectId!: string;

  /** `daily` | `weekly` | `monthly` (AnalyticsPeriod). */
  @Column({ type: 'varchar', length: 10 })
  period!: string;

  /** The start date of the period this snapshot represents. */
  @Column({ type: 'date' })
  periodStart!: string;

  /** Captured counters (shape depends on scope). */
  @Column({ type: 'jsonb', default: {} })
  metrics!: Record<string, number>;
}
