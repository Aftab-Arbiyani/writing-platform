import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { PERMISSIONS_KEY } from '../../common/constants/metadata.constants';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PermissionFactory } from './permission.factory';
import { PermissionResolver } from './permission.resolver';
import { PermissionDeniedException } from './permission.exceptions';

/**
 * Enforces `@Permissions(...)` (PBAC, docs 13 §4). Runs after the global
 * `JwtAuthGuard` (via `@UseGuards` applied by the decorator), so `request.user`
 * is present. Resolves the principal's effective permissions from its role claim
 * and requires ALL declared permissions (AND semantics). No metadata → pass
 * through (mirrors `RolesGuard`), so it's inert on unannotated routes.
 *
 * Data-aware checks (ownership/visibility) stay in services (docs 13 §4.3) — this
 * guard answers only "does this principal hold these capabilities?".
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: PermissionResolver,
    private readonly factory: PermissionFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (user === undefined) {
      throw new PermissionDeniedException(required);
    }

    const granted = await this.resolver.resolve(user.role, user.id);
    const missing = this.factory.missing(granted, required);
    if (missing.length > 0) {
      throw new PermissionDeniedException(missing);
    }
    return true;
  }
}
