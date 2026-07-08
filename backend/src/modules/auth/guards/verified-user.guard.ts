import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { UsersService } from '../../users/users.service';
import { EmailUnverifiedException } from '../exceptions/auth.exceptions';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Blocks routes that require a verified email until `email_verified_at` is set
 * (docs: "users cannot access protected APIs until verified"). The access token
 * carries no verification claim (docs 13 §3.2 forbids extra claims), so this
 * loads the user — acceptable, since it only runs on the (protected, non-hot)
 * routes that opt in via `@Verified()`. Runs after `JwtAuthGuard`.
 */
@Injectable()
export class VerifiedUserGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const principal = request.user;
    if (principal === undefined) {
      throw new EmailUnverifiedException();
    }
    const user = await this.users.findById(principal.id);
    if (user === null || user.emailVerifiedAt === null) {
      throw new EmailUnverifiedException();
    }
    return true;
  }
}
