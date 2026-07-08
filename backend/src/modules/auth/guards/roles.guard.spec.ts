import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@qalam/shared';

import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { RolesGuard } from './roles.guard';

function contextWith(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardRequiring(required: Role[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

const asUser = (role: Role): AuthenticatedUser => ({ id: 'u1', role, sessionVersion: 0 });

describe('RolesGuard', () => {
  it('allows any request when no roles are required', () => {
    expect(guardRequiring(undefined).canActivate(contextWith(undefined))).toBe(true);
  });

  it('allows a higher role than required (rank comparison)', () => {
    // admin (80) satisfies @Roles(Moderator) (50).
    expect(guardRequiring([Role.Moderator]).canActivate(contextWith(asUser(Role.Admin)))).toBe(
      true,
    );
  });

  it('denies a lower role than required', () => {
    expect(() => guardRequiring([Role.Admin]).canActivate(contextWith(asUser(Role.User)))).toThrow(
      ForbiddenException,
    );
  });

  it('denies when there is no authenticated user', () => {
    expect(() => guardRequiring([Role.Admin]).canActivate(contextWith(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
