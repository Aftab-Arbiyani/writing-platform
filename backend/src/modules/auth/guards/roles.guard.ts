import { Injectable, ForbiddenException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_RANK, type Role } from '@qalam/shared';
import type { Request } from 'express';

import { ROLES_KEY } from '../../../common/constants/metadata.constants';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Enforces the minimum role declared by `@Roles(...)` (docs 13 §4.3). Compares
 * by **rank**, so a higher role satisfies a lower requirement. Reads the role
 * from the access-token claim (a cache); admin routes additionally re-verify
 * against the DB — that re-verification arrives with the admin module (E10).
 *
 * Guards answer "may this role reach this route?"; ownership/visibility live in
 * services (docs 13 §4.3), so this guard loads no entities.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (user === undefined) {
      throw new ForbiddenException('Authentication required.');
    }

    // @Roles states the minimum — the lowest-ranked listed role is the threshold.
    const threshold = Math.min(...required.map((role) => ROLE_RANK[role]));
    if (ROLE_RANK[user.role] < threshold) {
      throw new ForbiddenException('Insufficient role.');
    }
    return true;
  }
}
