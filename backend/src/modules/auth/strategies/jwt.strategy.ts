import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { jwtConfig } from '../../../config/jwt.config';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Verifies the `Authorization: Bearer <jwt>` access token's signature and
 * expiry against `JWT_ACCESS_SECRET` (ADR §3, 15-min access tokens). Passport
 * attaches the returned value to `request.user`.
 *
 * Foundation scope: signature/expiry only. Epic 1 will extend `validate` to
 * reject suspended/deleted users (a `users`-service lookup) and surface the
 * precise `AUTH_TOKEN_*` codes — the token store does not exist yet.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(jwtConfig.KEY) config: ConfigType<typeof jwtConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.accessSecret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    // TODO(aftab): reject suspended/deleted users via UsersService (Epic 1).
    return { id: payload.sub };
  }
}
