import { Role } from '@qalam/shared';

import type { RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';

function serviceWith(repo: Partial<RolesRepository>): {
  service: RolesService;
  repo: jest.Mocked<RolesRepository>;
} {
  const mock = {
    findGrantedRoleNames: jest.fn().mockResolvedValue([]),
    revokeAll: jest.fn().mockResolvedValue(undefined),
    findByName: jest.fn(),
    grant: jest.fn().mockResolvedValue(undefined),
    ...repo,
  } as unknown as jest.Mocked<RolesRepository>;
  return { service: new RolesService(mock), repo: mock };
}

describe('RolesService.setRole', () => {
  it('clears prior grants then grants the target elevated role', async () => {
    const { service, repo } = serviceWith({
      findGrantedRoleNames: jest.fn().mockResolvedValue([]),
      findByName: jest.fn().mockResolvedValue({ id: 'role-admin', name: 'admin' }),
    });
    await expect(service.setRole('u1', Role.Admin, 'admin1')).resolves.toEqual({
      before: Role.User,
      after: Role.Admin,
    });
    expect(repo.revokeAll).toHaveBeenCalledWith('u1', undefined);
    expect(repo.grant).toHaveBeenCalledWith('u1', 'role-admin', 'admin1', undefined);
  });

  it('demotes to the implicit user role by clearing grants without granting', async () => {
    const { service, repo } = serviceWith({
      findGrantedRoleNames: jest.fn().mockResolvedValue(['admin']),
    });
    await expect(service.setRole('u1', Role.User, 'admin1')).resolves.toEqual({
      before: Role.Admin,
      after: Role.User,
    });
    expect(repo.revokeAll).toHaveBeenCalledWith('u1', undefined);
    expect(repo.findByName).not.toHaveBeenCalled();
    expect(repo.grant).not.toHaveBeenCalled();
  });
});
