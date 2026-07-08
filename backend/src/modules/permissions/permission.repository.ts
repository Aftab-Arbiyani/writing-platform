import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PermissionDefinition } from '@qalam/shared';
import { Repository } from 'typeorm';

import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserPermission } from './entities/user-permission.entity';

/** Data access for the PBAC tables (own entities → injected TypeORM repos). */
@Injectable()
export class PermissionRepository {
  constructor(
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissions: Repository<RolePermission>,
    @InjectRepository(UserPermission)
    private readonly userPermissions: Repository<UserPermission>,
  ) {}

  /** Grant codes for a role (may include wildcards). */
  async rolePermissionCodes(roleName: string): Promise<string[]> {
    const rows = await this.rolePermissions.find({
      where: { roleName },
      select: { permissionCode: true },
    });
    return rows.map((r) => r.permissionCode);
  }

  /** Direct grant codes for a user (future overrides). */
  async userPermissionCodes(userId: string): Promise<string[]> {
    const rows = await this.userPermissions.find({
      where: { userId },
      select: { permissionCode: true },
    });
    return rows.map((r) => r.permissionCode);
  }

  countRolePermissions(): Promise<number> {
    return this.rolePermissions.count();
  }

  countUserPermissions(): Promise<number> {
    return this.userPermissions.count();
  }

  listPermissions(): Promise<Permission[]> {
    return this.permissions.find({ order: { module: 'ASC', code: 'ASC' } });
  }

  /** Upserts a catalogue permission by `code` (idempotent — code-defined catalogue). */
  async upsertPermission(def: PermissionDefinition): Promise<void> {
    const existing = await this.permissions.findOne({ where: { code: def.code } });
    if (existing !== null) {
      existing.name = def.name;
      existing.description = def.description;
      existing.module = def.module;
      await this.permissions.save(existing);
    } else {
      await this.permissions.save(this.permissions.create(def));
    }
  }

  /** Inserts a role grant if absent (idempotent). */
  async insertRolePermission(roleName: string, permissionCode: string): Promise<void> {
    const existing = await this.rolePermissions.findOne({ where: { roleName, permissionCode } });
    if (existing === null) {
      await this.rolePermissions.save(this.rolePermissions.create({ roleName, permissionCode }));
    }
  }
}
