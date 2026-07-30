/**
 * Public surface of the auth module (docs 16 §5.2 — one barrel per backend
 * module). Feature modules import auth integration points from here.
 */
export { AuthModule } from './auth.module';
export { AuthService } from './auth.service';
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { RolesGuard } from './guards/roles.guard';
export { OptionalAuthGuard } from './guards/optional-auth.guard';
export { VerifiedUserGuard } from './guards/verified-user.guard';
export { CurrentUser } from './decorators/current-user.decorator';
export { Public } from './decorators/public.decorator';
export { Roles } from './decorators/roles.decorator';
export { Verified } from './decorators/verified.decorator';
export type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
export type { AccessTokenPayload, RefreshTokenPayload } from './interfaces/jwt-payload.interface';
