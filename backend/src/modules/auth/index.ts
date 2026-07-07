/**
 * Public surface of the auth module (docs 16 §5.2 — one barrel per backend
 * module). Other modules import auth integration points from here, never from
 * deep internals.
 */
export { AuthModule } from './auth.module';
export { AuthService } from './auth.service';
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { CurrentUser } from './decorators/current-user.decorator';
export { Public } from './decorators/public.decorator';
export type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
export type { JwtPayload } from './interfaces/jwt-payload.interface';
export type { AuthTokens } from './interfaces/auth-tokens.interface';
