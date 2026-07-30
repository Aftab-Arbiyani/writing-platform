import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { Role } from '@qalam/shared';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PermissionFactory } from './permission.factory';
import { PermissionGuard } from './permission.guard';
import type { PermissionResolver } from './permission.resolver';
import { PermissionDeniedException } from './permission.exceptions';

function context(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const user = (role: Role): AuthenticatedUser => ({ id: 'u1', role, sessionVersion: 0 });

function build(required: string[] | undefined, granted: Set<string>) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) };
  const resolver = { resolve: jest.fn().mockResolvedValue(granted) };
  const guard = new PermissionGuard(
    reflector as unknown as Reflector,
    resolver as unknown as PermissionResolver,
    new PermissionFactory(),
  );
  return { guard, reflector, resolver };
}

describe('PermissionGuard', () => {
  it('passes through when no @Permissions metadata is present', async () => {
    const { guard, resolver } = build(undefined, new Set());
    await expect(guard.canActivate(context(user(Role.User)))).resolves.toBe(true);
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('allows when the principal holds the required permission', async () => {
    const { guard } = build(['piece.publish'], new Set(['piece.publish']));
    await expect(guard.canActivate(context(user(Role.User)))).resolves.toBe(true);
  });

  it('allows via a wildcard grant', async () => {
    const { guard } = build(['piece.publish'], new Set(['*']));
    await expect(guard.canActivate(context(user(Role.SuperAdmin)))).resolves.toBe(true);
  });

  it('denies (403 AUTH_PERMISSION_DENIED) when a required permission is missing', async () => {
    const { guard } = build(['notification.manage'], new Set(['piece.create']));
    await expect(guard.canActivate(context(user(Role.User)))).rejects.toBeInstanceOf(
      PermissionDeniedException,
    );
  });

  it('denies when there is no authenticated principal', async () => {
    const { guard } = build(['piece.create'], new Set(['piece.create']));
    await expect(guard.canActivate(context(undefined))).rejects.toBeInstanceOf(
      PermissionDeniedException,
    );
  });
});
