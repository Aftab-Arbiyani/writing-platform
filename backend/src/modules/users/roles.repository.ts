import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';

import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';

/**
 * Data access for RBAC tables (`roles`, `user_roles`). Only repositories touch
 * query builders (docs 16 §3.3).
 */
@Injectable()
export class RolesRepository {
  constructor(private readonly dataSource: DataSource) {}

  private manager(manager?: EntityManager): EntityManager {
    return manager ?? this.dataSource.manager;
  }

  findByName(name: string, manager?: EntityManager): Promise<Role | null> {
    return this.manager(manager).getRepository(Role).findOne({ where: { name } });
  }

  /** Idempotent insert-if-missing by natural key `name` (seed, docs 04 §9). */
  async upsertRole(
    name: string,
    rank: number,
    description: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.manager(manager).getRepository(Role);
    const existing = await repo.findOne({ where: { name } });
    if (existing === null) {
      await repo.save(repo.create({ name, rank, description }));
    }
  }

  /** Elevated role names granted to a user (the base `user` role is implicit). */
  async findGrantedRoleNames(userId: string, manager?: EntityManager): Promise<string[]> {
    const rows = await this.manager(manager)
      .getRepository(UserRole)
      .createQueryBuilder('ur')
      .innerJoin(Role, 'r', 'r.id = ur.role_id')
      .where('ur.user_id = :userId', { userId })
      .select('r.name', 'name')
      .getRawMany<{ name: string }>();
    return rows.map((row) => row.name);
  }

  async grant(
    userId: string,
    roleId: string,
    grantedBy: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.manager(manager).getRepository(UserRole);
    const existing = await repo.findOne({ where: { userId, roleId } });
    if (existing === null) {
      await repo.save(repo.create({ userId, roleId, grantedBy }));
    }
  }

  /** Revokes a single elevated grant (idempotent — missing row is a no-op). */
  async revoke(userId: string, roleId: string, manager?: EntityManager): Promise<void> {
    await this.manager(manager).getRepository(UserRole).delete({ userId, roleId });
  }

  /** Revokes ALL elevated grants for a user (demote to the implicit `user`). */
  async revokeAll(userId: string, manager?: EntityManager): Promise<void> {
    await this.manager(manager).getRepository(UserRole).delete({ userId });
  }
}
