import { RestrictionScope } from '@qalam/shared';
import type { RestrictionScope as RestrictionScopeType, RestrictionType } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * An active or historical restriction on a user's account (AF6). A restriction is
 * "active" while both `liftedAt IS NULL` and it hasn't expired; the Policy Engine
 * consumes the active set (via the Trust port) to resolve a user's trust status.
 * `scope` narrows the surface (`global` covers everything). Applied either
 * manually by a moderator or automatically when strike weight crosses a
 * threshold. No SQL FKs (the record is evidence).
 */
@Entity('user_restrictions')
@Index('idx_user_restrictions_user', ['userId'])
export class UserRestriction extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: RestrictionType;

  @Column({ type: 'varchar', length: 20, default: RestrictionScope.Global })
  scope!: RestrictionScopeType;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'uuid' })
  issuedById!: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  liftedAt!: Date | null;
}
