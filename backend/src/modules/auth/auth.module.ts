import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { jwtConfig } from '../../config/jwt.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Authentication module (Epic 1: E1). Foundation wiring only — no login/signup
 * logic (see `AuthService`).
 *
 * - `PassportModule` + `JwtStrategy` — access-token verification is functional
 *   now (any valid signed token authenticates).
 * - `JwtModule` — configured with the access secret + TTL so token *issuance*
 *   (`JwtService`) is ready for Epic 1's login/refresh flows.
 * - Exports `AuthService` so other modules integrate via the service, never the
 *   (future) repositories (docs 16 §3.1 module boundaries).
 *
 * `GoogleStrategy` is a documented placeholder (Epic 1 t6) and intentionally not
 * registered here.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [jwtConfig.KEY],
      // Secret only. Access and refresh tokens have different TTLs (15m vs 30d,
      // ADR §3), so `expiresIn` is passed per-sign in Epic 1's token service
      // rather than fixed here.
      useFactory: (config: ConfigType<typeof jwtConfig>) => ({
        secret: config.accessSecret,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
