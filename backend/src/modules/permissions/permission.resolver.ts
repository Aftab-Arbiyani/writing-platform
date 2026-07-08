import { Injectable } from '@nestjs/common';
import { DEFAULT_ROLE_PERMISSIONS, Role, ROLE_RANK } from '@qalam/shared';

import { PermissionRepository } from './permission.repository';

/**
 * Resolves a request's EFFECTIVE permission set from its role + user id (PBAC
 * resolution order: super-admin wildcard → direct user permission → role
 * permission → deny). Backward-compatible: reads the role from the JWT claim, so
 * no token change is needed and existing users automatically gain permissions.
 *
 * Rank inheritance: a role's grants STACK with every lower-ranked role's, so a
 * moderator/admin retains a user's capabilities (preserving RBAC semantics).
 *
 * Caching: role→grants is cached in-memory (grants are static, seeded once); the
 * DB is the source of truth, with a static `DEFAULT_ROLE_PERMISSIONS` fallback so
 * authorization works even before the seeder runs. Direct user permissions are a
 * future feature (no writer this epic) — a cached "table is empty" flag keeps the
 * hot path DB-free until they exist.
 */
@Injectable()
export class PermissionResolver {
  private readonly roleGrants = new Map<string, string[]>();
  private userGrantsPossible: boolean | undefined;

  constructor(private readonly repo: PermissionRepository) {}

  /** The effective granted permission set for a principal. */
  async resolve(role: Role, userId: string): Promise<Set<string>> {
    const granted = new Set<string>();
    for (const applicable of this.rolesUpTo(role)) {
      for (const code of await this.grantsForRole(applicable)) {
        granted.add(code);
      }
    }
    if (await this.userGrantsMightExist()) {
      for (const code of await this.repo.userPermissionCodes(userId)) {
        granted.add(code);
      }
    }
    return granted;
  }

  /** Clears caches — call after seeding or any grant change. */
  invalidate(): void {
    this.roleGrants.clear();
    this.userGrantsPossible = undefined;
  }

  /** Roles whose grants a given role inherits (its rank and below). */
  private rolesUpTo(role: Role): Role[] {
    const rank = ROLE_RANK[role];
    return Object.values(Role).filter((candidate) => ROLE_RANK[candidate] <= rank);
  }

  private async grantsForRole(role: Role): Promise<string[]> {
    const cached = this.roleGrants.get(role);
    if (cached !== undefined) {
      return cached;
    }
    const fromDb = await this.repo.rolePermissionCodes(role);
    const grants = fromDb.length > 0 ? fromDb : [...DEFAULT_ROLE_PERMISSIONS[role]];
    this.roleGrants.set(role, grants);
    return grants;
  }

  private async userGrantsMightExist(): Promise<boolean> {
    if (this.userGrantsPossible === undefined) {
      this.userGrantsPossible = (await this.repo.countUserPermissions()) > 0;
    }
    return this.userGrantsPossible;
  }
}
