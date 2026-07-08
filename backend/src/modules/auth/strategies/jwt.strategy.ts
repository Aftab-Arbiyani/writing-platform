import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { authConfig } from '../../../config/auth.config';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import type { AccessTokenPayload } from '../interfaces/jwt-payload.interface';

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
  constructor(@Inject(authConfig.KEY) config: ConfigType<typeof authConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
      issuer: config.jwt.issuer,
    });
  }

  /**
   * Runs after signature + expiry verification. Stateless (docs 13 §3.2): no DB
   * hit on the hot path — the principal is built from claims. Status/verification
   * are enforced where it matters (login/refresh issuance; `VerifiedUserGuard`),
   * and suspension takes effect within one access-token TTL (docs 13 §3.6).
   */
  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return { id: payload.sub, role: payload.role, sessionVersion: payload.sv };
  }
}
