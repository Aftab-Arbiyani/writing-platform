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
 * every time (code-defined); role→permission mappings are reconciled **per
 * permission code**, so an operator's customizations survive while permissions
 * introduced by later epics still reach their default roles (see `seed`).
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

  /**
   * Idempotent seed of the permission catalogue + default role mappings.
   *
   * Mappings are reconciled **per permission code**, not all-or-nothing.
   *
   * The previous rule — seed the defaults only when `role_permissions` is entirely empty — meant a
   * permission introduced after a database was first seeded could never reach its default roles:
   * the table was non-empty, so the whole block was skipped forever. Every environment seeded
   * before AF1/AF5/AF6 therefore silently lacked `ai.use`, `billing.use`, and `collaboration.use`,
   * which made those features 403 for ordinary users on every client (found while running the W3a
   * E2E — the collaborators read returned `AUTH_PERMISSION_DENIED` for a story's own owner).
   *
   * The intent behind that guard is still honored: a code that is **already granted to some role**
   * is left completely alone, so revoking or re-pointing an existing grant is not undone on the
   * next boot. Only codes with no grant rows at all — i.e. genuinely new ones — get their defaults.
   * The one accepted consequence: revoking a code from *every* role makes it look new again, so its
   * defaults return. Rare, and far better than a feature that can never be granted.
   */
  async seed(): Promise<void> {
    for (const def of PERMISSION_CATALOGUE) {
      await this.repo.upsertPermission(def);
    }

    const alreadyGranted = new Set(await this.repo.grantedPermissionCodes());
    const applied: string[] = [];

    for (const [roleName, codes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const code of codes) {
        if (alreadyGranted.has(code)) continue;
        await this.repo.insertRolePermission(roleName, code);
        applied.push(`${roleName}:${code}`);
      }
    }

    if (applied.length > 0) {
      this.logger.log(`Role permissions reconciled from defaults: ${applied.join(', ')}`);
    }
    this.resolver.invalidate();
  }

  /** The full catalogue (for admin/introspection). */
  listPermissions(): Promise<Permission[]> {
    return this.repo.listPermissions();
  }
}
