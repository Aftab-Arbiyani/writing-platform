import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthIdentityRepository } from './auth-identity.repository';
import { AuthService } from './auth.service';
import { AuthIdentity } from './entities/auth-identity.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { VerifiedUserGuard } from './guards/verified-user.guard';
import { AuthEventLogger } from './services/auth-event.logger';
import { AuthMaintenanceService } from './services/auth-maintenance.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { PasswordResetService } from './services/password-reset.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { VerificationService } from './services/verification.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Authentication & authorization (E1 — Auth & Identity, docs 18).
 *
 * - Depends on `UsersModule` (accounts + RBAC) via its exported services only
 *   (docs 16 §3.1) — never its repositories.
 * - `JwtModule.register({})` has no global secret; access and refresh are signed
 *   per-call with their separate secrets (docs 13 §3.2).
 * - Registers `JwtAuthGuard` as the global `APP_GUARD` — **default-deny**;
 *   anonymous routes opt out with `@Public()` (docs 13 §4.3).
 * - Exports the guards so feature modules compose `@UseGuards(JwtAuthGuard,
 *   RolesGuard)`, `@Verified()`, etc.
 */
@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    TypeOrmModule.forFeature([AuthIdentity, VerificationToken, PasswordResetToken]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    VerificationService,
    PasswordResetService,
    GoogleOAuthService,
    AuthEventLogger,
    AuthMaintenanceService,
    AuthIdentityRepository,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    OptionalAuthGuard,
    VerifiedUserGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [
    AuthService,
    AuthMaintenanceService,
    JwtAuthGuard,
    RolesGuard,
    OptionalAuthGuard,
    VerifiedUserGuard,
  ],
})
export class AuthModule {}
