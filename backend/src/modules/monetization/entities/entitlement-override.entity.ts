import { Column, Entity, Index } from 'typeorm';
import type { OverrideEffect, PremiumFeature } from '@qalam/shared';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A per-user entitlement override (AF5) — mutable (an admin can deactivate one). Backs
 * three brief requirements at once: **Administrative Overrides** (admin grants/denies a
 * feature), **Temporary Access** and **Promotional Access** (a time-bounded `expiresAt`
 * grant). The Entitlement service layers active, unexpired overrides ON TOP of the
 * plan-derived decision — an `allow` grants a feature the plan lacks; a `deny` revokes
 * one the plan includes; `limited` caps it. This is the ONLY sanctioned way to grant
 * premium access outside a subscription, so access logic stays centralized.
 */
@Entity('entitlement_overrides')
@Index('idx_entitlement_override_user_feature', ['userId', 'feature'])
@Index('idx_entitlement_override_active', ['active'])
export class EntitlementOverride extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 40 })
  feature!: PremiumFeature;

  @Column({ type: 'varchar', length: 20 })
  effect!: OverrideEffect;

  /** Quota for a `limited` effect (null = unbounded within the grant). */
  @Column({ type: 'int', nullable: true })
  limit!: number | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  /** When the override lapses (temporary/promotional). Null = until deactivated. */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  /** Admin/user id that created the override (audit provenance). */
  @Column({ type: 'uuid', nullable: true })
  grantedBy!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  source!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
