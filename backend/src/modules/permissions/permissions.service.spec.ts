import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_CATALOGUE } from '@qalam/shared';

import type { PermissionRepository } from './permission.repository';
import type { PermissionResolver } from './permission.resolver';
import { PermissionsService } from './permissions.service';

function build(roleCount: number) {
  const repo = {
    upsertPermission: jest.fn().mockResolvedValue(undefined),
    countRolePermissions: jest.fn().mockResolvedValue(roleCount),
    insertRolePermission: jest.fn().mockResolvedValue(undefined),
  };
  const resolver = { invalidate: jest.fn() };
  const service = new PermissionsService(
    repo as unknown as PermissionRepository,
    resolver as unknown as PermissionResolver,
  );
  return { service, repo, resolver };
}

const DEFAULT_GRANT_COUNT = Object.values(DEFAULT_ROLE_PERMISSIONS).reduce(
  (sum, codes) => sum + codes.length,
  0,
);

describe('PermissionsService.seed', () => {
  it('upserts the whole catalogue and seeds role mappings when empty', async () => {
    const { service, repo, resolver } = build(0);
    await service.seed();
    expect(repo.upsertPermission).toHaveBeenCalledTimes(PERMISSION_CATALOGUE.length);
    expect(repo.insertRolePermission).toHaveBeenCalledTimes(DEFAULT_GRANT_COUNT);
    expect(resolver.invalidate).toHaveBeenCalled();
  });

  it('upserts the catalogue but does NOT reseed role mappings when already present', async () => {
    const { service, repo } = build(5);
    await service.seed();
    expect(repo.upsertPermission).toHaveBeenCalledTimes(PERMISSION_CATALOGUE.length);
    expect(repo.insertRolePermission).not.toHaveBeenCalled();
  });
});
