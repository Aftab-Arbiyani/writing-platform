import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A feature flag (E12.8) — the richer, per-flag rollout model that complements
 * the boolean toggles in `settings`. Future platform capabilities (AI, Payments,
 * Mobile, Creator Economy) are represented as flags keyed `feature.<name>.enabled`
 * so they can be dark-launched and gradually rolled out without a schema change.
 *
 * `rollout_percentage` (0–100) enables staged exposure; `environment` scopes a
 * flag to `all`/`production`/`staging`/`development`. No FK on `updated_by`
 * (cf. `Setting`), no soft-delete (flags are hard-deleted).
 */
@Entity('feature_flags')
@Index('idx_feature_flags_enabled', ['enabled'])
export class FeatureFlag extends QalamBaseEntity {
  /** Dot-cased flag key, e.g. `feature.ai.enabled`. */
  @Column({ type: 'varchar', length: 120, unique: true })
  key!: string;

  /** Master on/off switch. */
  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  /** Staged-rollout share, 0–100 (only meaningful when `enabled`). */
  @Column({ type: 'int', default: 0 })
  rolloutPercentage!: number;

  /** Scope: `all` | `production` | `staging` | `development`. */
  @Column({ type: 'varchar', length: 20, default: 'all' })
  environment!: string;

  /** Human-readable description of what the flag gates. */
  @Column({ type: 'text', default: '' })
  description!: string;

  /** The admin who last changed it; null on the seeded default. */
  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
