import { DEFAULT_ROLE_PERMISSIONS, Role } from '@qalam/shared';

import type { PermissionRepository } from './permission.repository';
import { PermissionResolver } from './permission.resolver';

function build(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const repo = {
    rolePermissionCodes: jest.fn().mockResolvedValue([]),
    userPermissionCodes: jest.fn().mockResolvedValue([]),
    countUserPermissions: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
  const resolver = new PermissionResolver(repo as unknown as PermissionRepository);
  return { resolver, repo };
}

describe('PermissionResolver', () => {
  it('stacks a role’s grants with every lower-ranked role (rank inheritance)', async () => {
    const { resolver } = build({
      rolePermissionCodes: jest
        .fn()
        .mockImplementation((role: string) =>
          Promise.resolve(
            role === Role.User
              ? ['piece.create']
              : role === Role.Moderator
                ? ['report.review']
                : [],
          ),
        ),
    });
    const granted = await resolver.resolve(Role.Moderator, 'u1');
    expect(granted.has('piece.create')).toBe(true); // inherited from user
    expect(granted.has('report.review')).toBe(true); // own
  });

  it('gives super_admin the global wildcard', async () => {
    const { resolver } = build({
      rolePermissionCodes: jest
        .fn()
        .mockImplementation((role: string) =>
          Promise.resolve(role === Role.SuperAdmin ? ['*'] : []),
        ),
    });
    const granted = await resolver.resolve(Role.SuperAdmin, 'u1');
    expect(granted.has('*')).toBe(true);
  });

  it('falls back to DEFAULT_ROLE_PERMISSIONS when the DB has no rows for a role', async () => {
    const { resolver } = build(); // rolePermissionCodes → [] for all
    const granted = await resolver.resolve(Role.User, 'u1');
    for (const code of DEFAULT_ROLE_PERMISSIONS[Role.User]) {
      expect(granted.has(code)).toBe(true);
    }
  });

  it('unions direct user permissions when the table is non-empty', async () => {
    const { resolver, repo } = build({
      countUserPermissions: jest.fn().mockResolvedValue(1),
      userPermissionCodes: jest.fn().mockResolvedValue(['system.manage']),
    });
    const granted = await resolver.resolve(Role.User, 'u1');
    expect(granted.has('system.manage')).toBe(true);
    expect(repo.userPermissionCodes).toHaveBeenCalledWith('u1');
  });

  it('skips the user-permission query when the table is empty (hot-path optimization)', async () => {
    const { resolver, repo } = build();
    await resolver.resolve(Role.User, 'u1');
    expect(repo.userPermissionCodes).not.toHaveBeenCalled();
  });

  it('caches role grants (one DB read per role across calls)', async () => {
    const { resolver, repo } = build();
    await resolver.resolve(Role.User, 'u1');
    await resolver.resolve(Role.User, 'u2');
    // user rank → only the "user" role is applicable, read once then cached.
    expect(repo.rolePermissionCodes).toHaveBeenCalledTimes(1);
  });
});
