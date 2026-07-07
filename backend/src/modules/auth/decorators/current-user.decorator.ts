import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Injects the authenticated principal that `JwtStrategy` attached to the
 * request, on routes protected by `JwtAuthGuard`.
 *
 * ```ts
 * @Get('me')
 * me(@CurrentUser() user: AuthenticatedUser) { … }
 * ```
 *
 * Returns `undefined` on unprotected routes (no guard ran) — callers on
 * guarded routes can treat it as present.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    return request.user;
  },
);
