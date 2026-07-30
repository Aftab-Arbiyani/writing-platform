import { TRUST_SCORE_DEFAULT, TrustLevel } from '@qalam/shared';
import type { TrustLevel as TrustLevelType } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * One reputation row per user (Trust & Safety, AF6). `score` is the reputation
 * band (0–100); `level` is the tier derived from it (kept in sync on every
 * standing change so reads are index-free); `activeStrikeWeight` denormalizes the
 * summed weight of currently-active strikes so escalation thresholds are a single
 * column read. No SQL FK to `users` — integrity is enforced in the service (the
 * trail must outlive a hard-deleted account).
 */
@Entity('trust_profiles')
@Index('uq_trust_profiles_user', ['userId'], { unique: true })
export class TrustProfile extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'int', default: TRUST_SCORE_DEFAULT })
  score!: number;

  @Column({ type: 'varchar', length: 20, default: TrustLevel.Member })
  level!: TrustLevelType;

  @Column({ type: 'int', default: 0 })
  activeStrikeWeight!: number;
}
