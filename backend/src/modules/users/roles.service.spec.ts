import { Role } from '@qalam/shared';

import type { RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';

describe('RolesService.getEffectiveRole', () => {
  function serviceWith(grantedNames: string[]): RolesService {
    const repo = {
      findGrantedRoleNames: jest.fn().mockResolvedValue(grantedNames),
    } as unknown as RolesRepository;
    return new RolesService(repo);
  }

  it('defaults to the implicit user role when there are no grants', async () => {
    await expect(serviceWith([]).getEffectiveRole('u1')).resolves.toBe(Role.User);
  });

  it('returns the single granted role', async () => {
    await expect(serviceWith(['moderator']).getEffectiveRole('u1')).resolves.toBe(Role.Moderator);
  });

  it('returns the highest-ranked role when several are granted', async () => {
    await expect(serviceWith(['moderator', 'admin']).getEffectiveRole('u1')).resolves.toBe(
      Role.Admin,
    );
  });
});
