import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserPermission } from './entities/user-permission.entity';
import { PermissionFactory } from './permission.factory';
import { PermissionGuard } from './permission.guard';
import { PermissionRepository } from './permission.repository';
import { PermissionResolver } from './permission.resolver';
import { PermissionsService } from './permissions.service';

/**
 * Permission-Based Access Control (PBAC). `@Global` so `PermissionGuard` (applied
 * across modules by the `@Permissions` decorator) and its collaborators resolve
 * everywhere without repeated imports — mirroring how `CommonModule` exports
 * `RateLimitGuard`. Owns the three PBAC tables; seeds them on boot. Authorization
 * only — authentication (JWT/OAuth/refresh) is untouched in `AuthModule`.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Permission, RolePermission, UserPermission])],
  providers: [
    PermissionRepository,
    PermissionFactory,
    PermissionResolver,
    PermissionGuard,
    PermissionsService,
  ],
  exports: [PermissionGuard, PermissionResolver, PermissionFactory, PermissionsService],
})
export class PermissionsModule {}
