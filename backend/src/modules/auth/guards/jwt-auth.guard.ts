import { Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';

import { IS_PUBLIC_KEY } from '../../../common/constants/metadata.constants';

/**
 * Protects routes with the `jwt` strategy, skipping any route marked `@Public()`.
 *
 * Provided for opt-in use (`@UseGuards(JwtAuthGuard)`); it is deliberately NOT
 * registered as a global `APP_GUARD` in the foundation, since no protected
 * routes exist yet and a global guard would force `@Public()` onto health/auth.
 * Epic 1 can promote it to global once protected routes land.
 *
 * On failure Passport throws `UnauthorizedException` (401) → the exception
 * filter emits the `UNAUTHORIZED` envelope. Epic 1 will override `handleRequest`
 * to distinguish `AUTH_TOKEN_EXPIRED` vs `AUTH_TOKEN_INVALID` (docs 05 §3).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }
    return super.canActivate(context);
  }
}
