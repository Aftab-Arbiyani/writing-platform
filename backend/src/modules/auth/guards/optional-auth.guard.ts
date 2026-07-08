import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attaches the authenticated user when a valid bearer token is present, but
 * never rejects when it is absent/invalid — for public routes whose response
 * varies by viewer (e.g. a piece read showing "you liked this", docs 13 §4.3).
 *
 * Use alongside `@Public()` so the global `JwtAuthGuard` steps aside and this
 * guard performs the optional attach: `@Public() @UseGuards(OptionalAuthGuard)`.
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  // Passport throws on missing/invalid tokens by default; swallow that and
  // resolve to `undefined` so the request proceeds unauthenticated.
  handleRequest<TUser = unknown>(_err: unknown, user: TUser | false): TUser | undefined {
    return user === false ? undefined : user;
  }
}
