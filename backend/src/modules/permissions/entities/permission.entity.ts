import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * The catalogue of concrete permissions (PBAC). One row per capability
 * (`module.action`); wildcards are NEVER catalogue rows — they only appear as
 * grants in `role_permissions`/`user_permissions`. Seeded from
 * `PERMISSION_CATALOGUE` (`@qalam/shared`) — this table is reference/documentation
 * (admin UI, introspection); authorization decisions read the grant tables.
 */
@Entity('permissions')
export class Permission extends QalamBaseEntity {
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Index('uq_permissions_code', { unique: true })
  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 50 })
  module!: string;
}
