import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_CATALOGUE, PERMISSIONS } from '@qalam/shared';

import type { PermissionRepository } from './permission.repository';
import type { PermissionResolver } from './permission.resolver';
import { PermissionsService } from './permissions.service';

function build(grantedCodes: string[]) {
  const repo = {
    upsertPermission: jest.fn().mockResolvedValue(undefined),
    countRolePermissions: jest.fn().mockResolvedValue(grantedCodes.length),
    grantedPermissionCodes: jest.fn().mockResolvedValue(grantedCodes),
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

/** Every default code, so a test can simulate "this database is already fully granted". */
const ALL_DEFAULT_CODES = Object.values(DEFAULT_ROLE_PERMISSIONS).flat();

describe('PermissionsService.seed', () => {
  it('upserts the whole catalogue and seeds role mappings on an empty database', async () => {
    const { service, repo, resolver } = build([]);
    await service.seed();
    expect(repo.upsertPermission).toHaveBeenCalledTimes(PERMISSION_CATALOGUE.length);
    expect(repo.insertRolePermission).toHaveBeenCalledTimes(DEFAULT_GRANT_COUNT);
    expect(resolver.invalidate).toHaveBeenCalled();
  });

  it('leaves already-granted codes alone, so operator customizations survive', async () => {
    const { service, repo } = build(ALL_DEFAULT_CODES);
    await service.seed();
    expect(repo.upsertPermission).toHaveBeenCalledTimes(PERMISSION_CATALOGUE.length);
    // Nothing is new, so nothing is inserted — a re-pointed or revoked grant is not resurrected.
    expect(repo.insertRolePermission).not.toHaveBeenCalled();
  });

  it('grants a permission introduced AFTER the database was first seeded', async () => {
    // The regression that motivated per-code reconciliation: a populated `role_permissions` used to
    // skip the whole block, so `collaboration.use` (AF6) never reached `user` on any pre-AF6
    // database and every collaboration request 403'd — including a story owner's own roster read.
    const withoutLaterEpics = ALL_DEFAULT_CODES.filter(
      (code) =>
        code !== PERMISSIONS.CollaborationUse &&
        code !== PERMISSIONS.AiUse &&
        code !== PERMISSIONS.BillingUse,
    );
    const { service, repo } = build(withoutLaterEpics);

    await service.seed();

    const granted = repo.insertRolePermission.mock.calls.map(([, code]: [string, string]) => code);
    expect(granted).toContain(PERMISSIONS.CollaborationUse);
    expect(granted).toContain(PERMISSIONS.AiUse);
    expect(granted).toContain(PERMISSIONS.BillingUse);
    // ONLY the new codes — the pre-existing ones are still untouched.
    expect(new Set(granted)).toEqual(
      new Set([PERMISSIONS.CollaborationUse, PERMISSIONS.AiUse, PERMISSIONS.BillingUse]),
    );
  });
});
