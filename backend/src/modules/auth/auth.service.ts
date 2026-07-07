import { Injectable, NotImplementedException } from '@nestjs/common';

import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RefreshDto } from './dto/refresh.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { AuthTokens } from './interfaces/auth-tokens.interface';

/**
 * Authentication business logic — SKELETON (Epic 1: E1 in docs 18).
 *
 * Every method throws `NotImplementedException` (501) deliberately: the
 * foundation ships the module shape, contracts, guards, and strategy wiring
 * without any login/signup logic, per the phase scope.
 *
 * When implemented (Epic 1) this service will inject: `JwtService` (sign
 * access/refresh, provided by `AuthModule`'s `JwtModule`), `RedisService`
 * (refresh rotation + reuse-detection denylist, Redis DB 3), `UsersService`
 * (find/create accounts — the `users` module), and an Argon2id hashing service.
 * Multi-write flows (register + identity row) run in a transaction (docs 16 §3.5).
 */
@Injectable()
export class AuthService {
  /** Register a new account, claim the permanent username, send verification (E1 t1–t3). */
  register(_dto: RegisterDto): Promise<AuthTokens> {
    throw new NotImplementedException('auth.register is implemented in Epic 1 (E1).');
  }

  /** Validate credentials (Argon2id) and issue an access/refresh pair (E1 t3–t4). */
  login(_dto: LoginDto): Promise<AuthTokens> {
    throw new NotImplementedException('auth.login is implemented in Epic 1 (E1).');
  }

  /** Rotate the refresh token with reuse detection; issue a fresh pair (E1 t5). */
  refresh(_dto: RefreshDto): Promise<AuthTokens> {
    throw new NotImplementedException('auth.refresh is implemented in Epic 1 (E1).');
  }

  /** Revoke the current session's refresh token (E1 t4). */
  logout(_userId: string): Promise<void> {
    throw new NotImplementedException('auth.logout is implemented in Epic 1 (E1).');
  }

  /** Revoke every session for the user ("log out everywhere", E1 t4). */
  logoutAll(_userId: string): Promise<void> {
    throw new NotImplementedException('auth.logoutAll is implemented in Epic 1 (E1).');
  }

  /** Queue a reset email if the account exists (no enumeration, E1 t9). */
  forgotPassword(_dto: ForgotPasswordDto): Promise<void> {
    throw new NotImplementedException('auth.forgotPassword is implemented in Epic 1 (E1).');
  }

  /** Consume a reset token and set a new Argon2id-hashed password (E1 t9). */
  resetPassword(_dto: ResetPasswordDto): Promise<void> {
    throw new NotImplementedException('auth.resetPassword is implemented in Epic 1 (E1).');
  }
}
