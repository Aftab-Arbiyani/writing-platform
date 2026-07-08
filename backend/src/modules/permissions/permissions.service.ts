import { Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_CATALOGUE } from '@qalam/shared';

import type { Permission } from './entities/permission.entity';
import { PermissionRepository } from './permission.repository';
import { PermissionResolver } from './permission.resolver';

/**
 * Seeds + exposes the PBAC catalogue. Seeding runs automatically on boot
 * (idempotent, best-effort so a not-yet-migrated DB never crashes startup) and
 * is also invoked by the deploy seeder (`run-seeds`). The catalogue is upserted
 * every time (code-defined); role→permission mappings are seeded only when the
 * table is empty, so a future admin's customizations are never overwritten.
 */
@Injectable()
export class PermissionsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly repo: PermissionRepository,
    private readonly resolver: PermissionResolver,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seed();
    } catch (error) {
      // DB may not be migrated yet in some dev flows; the resolver falls back to
      // DEFAULT_ROLE_PERMISSIONS, so authorization still works.
      this.logger.warn(`permission seeding skipped: ${(error as Error).message}`);
    }
  }

  /** Idempotent seed of the permission catalogue + default role mappings. */
  async seed(): Promise<void> {
    for (const def of PERMISSION_CATALOGUE) {
      await this.repo.upsertPermission(def);
    }
    if ((await this.repo.countRolePermissions()) === 0) {
      for (const [roleName, codes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        for (const code of codes) {
          await this.repo.insertRolePermission(roleName, code);
        }
      }
      this.logger.log('Role permissions seeded from defaults.');
    }
    this.resolver.invalidate();
  }

  /** The full catalogue (for admin/introspection). */
  listPermissions(): Promise<Permission[]> {
    return this.repo.listPermissions();
  }
}
