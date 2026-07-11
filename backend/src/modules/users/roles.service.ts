import { Injectable } from '@nestjs/common';
import { Role as RoleName, ROLE_RANK } from '@qalam/shared';
import type { EntityManager } from 'typeorm';

import { RolesRepository } from './roles.repository';

/** The four seeded roles with their ranks (docs 04 §3.8, §9). */
const SEED_ROLES: ReadonlyArray<{ name: RoleName; rank: number; description: string }> = [
  { name: RoleName.User, rank: ROLE_RANK.user, description: 'Standard account (implicit).' },
  { name: RoleName.Moderator, rank: ROLE_RANK.moderator, description: 'Content moderation.' },
  { name: RoleName.Admin, rank: ROLE_RANK.admin, description: 'Platform administration.' },
  {
    name: RoleName.SuperAdmin,
    rank: ROLE_RANK.super_admin,
    description: 'Full control; grants roles.',
  },
];

/**
 * RBAC role resolution + seeding (docs 04 §3.8). The base `user` role is
 * implicit — a user with no `user_roles` rows resolves to `user`. The effective
 * role is embedded in the access token at issuance (a cache); admin routes
 * re-verify against the DB (docs 13 §4.1) — that re-verification lands with the
 * admin module (E10).
 */
@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  /** Highest-ranked role granted to the user, or `user` when none (docs 13 §4.1). */
  async getEffectiveRole(userId: string, manager?: EntityManager): Promise<RoleName> {
    const names = await this.rolesRepository.findGrantedRoleNames(userId, manager);
    return names.reduce<RoleName>((highest, name) => {
      const candidate = name as RoleName;
      return ROLE_RANK[candidate] > ROLE_RANK[highest] ? candidate : highest;
    }, RoleName.User);
  }

  /** Idempotent seed of the four roles (deploy step after migrations, §9). */
  async seedRoles(manager?: EntityManager): Promise<void> {
    for (const role of SEED_ROLES) {
      await this.rolesRepository.upsertRole(role.name, role.rank, role.description, manager);
    }
  }

  /** Grants an elevated role by name (used by the bootstrap super-admin + E10). */
  async grantRole(
    userId: string,
    roleName: RoleName,
    grantedBy: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    const role = await this.rolesRepository.findByName(roleName, manager);
    if (role === null) {
      throw new Error(`Role "${roleName}" is not seeded — run the roles seed first.`);
    }
    await this.rolesRepository.grant(userId, role.id, grantedBy, manager);
  }

  /**
   * Sets a user's role to exactly `roleName` (admin role management, E12.5).
   * Because the effective role is the highest granted rank, "setting" a role
   * means clearing prior elevated grants first, then granting the target —
   * demoting to `user` simply clears them. Returns the effective role before
   * the change for the audit trail.
   */
  async setRole(
    userId: string,
    roleName: RoleName,
    grantedBy: string | null,
    manager?: EntityManager,
  ): Promise<{ before: RoleName; after: RoleName }> {
    const before = await this.getEffectiveRole(userId, manager);
    await this.rolesRepository.revokeAll(userId, manager);
    if (roleName !== RoleName.User) {
      const role = await this.rolesRepository.findByName(roleName, manager);
      if (role === null) {
        throw new Error(`Role "${roleName}" is not seeded — run the roles seed first.`);
      }
      await this.rolesRepository.grant(userId, role.id, grantedBy, manager);
    }
    return { before, after: roleName };
  }
}
