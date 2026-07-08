import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A permission granted to a role (PBAC). Keyed by role NAME (the value carried in
 * the JWT `role` claim) rather than a FK to `roles.id`, so the resolver needs no
 * join — it reads grants directly by role name and caches them. `permission_code`
 * may be a wildcard (`piece.*`, `*`), so this is deliberately NOT a FK to the
 * `permissions` catalogue. Seeded from `DEFAULT_ROLE_PERMISSIONS`.
 */
@Entity('role_permissions')
@Index('uq_role_permissions', ['roleName', 'permissionCode'], { unique: true })
@Index('idx_role_permissions_role', ['roleName'])
export class RolePermission extends QalamBaseEntity {
  /** Role name (e.g. `admin`) — matches the `roles.name` / `Role` enum value. */
  @Column({ type: 'varchar', length: 30 })
  roleName!: string;

  /** Granted permission code; may be a wildcard. */
  @Column({ type: 'varchar', length: 100 })
  permissionCode!: string;
}
