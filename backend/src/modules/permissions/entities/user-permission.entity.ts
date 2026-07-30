import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A permission granted DIRECTLY to a user (PBAC), overriding/augmenting their
 * role grants — resolution step 2 (docs: "Direct User Permission (future)").
 * Future-ready: no API writes it in this epic, so the table stays empty and the
 * resolver skips it on the hot path. `permission_code` may be a wildcard.
 *
 * FK `user_id` → users ON DELETE CASCADE (migration).
 */
@Entity('user_permissions')
@Index('uq_user_permissions', ['userId', 'permissionCode'], { unique: true })
@Index('idx_user_permissions_user', ['userId'])
export class UserPermission extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 100 })
  permissionCode!: string;
}
