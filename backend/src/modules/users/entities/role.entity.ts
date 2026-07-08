import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * Seeded RBAC role (docs 04 §3.8): `user(0) < moderator(50) < admin(80) <
 * super_admin(100)`. Guards compare **ranks, not names**, so `admin` satisfies
 * `@Roles(Role.Moderator)`. Seeded idempotently by natural key `name` (§9).
 */
@Entity('roles')
export class Role extends QalamBaseEntity {
  @Index('uq_roles_name', { unique: true })
  @Column({ type: 'citext' })
  name!: string;

  @Index('uq_roles_rank', { unique: true })
  @Column({ type: 'smallint' })
  rank!: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description!: string | null;
}
