import { Injectable } from '@nestjs/common';
import { UserStatus } from '@qalam/shared';
import { QueryFailedError } from 'typeorm';

import { TransactionRunner } from '../../common/database/transaction-runner';
import { MailService } from '../../mail/mail.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import {
  AccountSuspendedException,
  CurrentPasswordInvalidException,
  EmailAlreadyVerifiedException,
  EmailTakenException,
  InvalidCredentialsException,
  UsernameTakenException,
} from './exceptions/auth.exceptions';
import { AuthEventLogger } from './services/auth-event.logger';
import { GoogleOAuthService } from './services/google-oauth.service';
import { PasswordResetService } from './services/password-reset.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import type { TokenContext, TokenPair } from './services/token.service';
import { VerificationService } from './services/verification.service';

/** Public-safe view of a user returned by auth flows (never leaks the hash). */
export interface UserSummary {
  id: string;
  email: string;
  username: string;
  isEmailVerified: boolean;
}

/** Standard authenticated result: the user + a fresh token pair. */
export interface AuthResult {
  user: UserSummary;
  tokens: TokenPair;
}

/**
 * Orchestrates the auth flows (E1). Thin coordinator over focused services
 * (SOLID): hashing, tokens, verification, reset, OAuth, and event logging each
 * live in their own service. Multi-write flows run in a transaction (docs 16
 * §3.5); side effects (email, token issuance) happen after commit.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly verification: VerificationService,
    private readonly passwordReset: PasswordResetService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly mail: MailService,
    private readonly events: AuthEventLogger,
    private readonly transactions: TransactionRunner,
  ) {}

  async register(
    input: { email: string; username: string; password: string },
    ctx: TokenContext,
  ): Promise<AuthResult> {
    this.passwords.assertStrong(input.password);

    if (await this.users.isEmailTaken(input.email)) {
      throw new EmailTakenException();
    }
    if (await this.users.isUsernameTaken(input.username)) {
      throw new UsernameTakenException();
    }

    const passwordHash = await this.passwords.hash(input.password);

    // User + verification token in one transaction; the raw token escapes for email.
    const { user, rawToken } = await this.transactions
      .run(async (manager) => {
        const created = await this.users.createLocalUser(
          { email: input.email, username: input.username, passwordHash },
          manager,
        );
        const token = await this.verification.issue(created.id, manager);
        return { user: created, rawToken: token };
      })
      .catch((error: unknown) => {
        throw this.translateUniqueViolation(error);
      });

    // Side effects after commit (docs 16 §3.5): email is fire-and-forget.
    void this.mail.sendVerificationEmail(user.email, rawToken);
    this.events.register(user.id, ctx.ip);

    const tokens = await this.tokens.issuePair(user.id, ctx);
    return { user: toUserSummary(user), tokens };
  }

  async login(input: { email: string; password: string }, ctx: TokenContext): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    const valid = await this.passwords.verifyConstantTime(
      user?.passwordHash ?? null,
      input.password,
    );

    if (user === null || !valid) {
      this.events.loginFailure(ctx.ip);
      throw new InvalidCredentialsException();
    }
    if (user.status === UserStatus.Suspended) {
      throw new AccountSuspendedException();
    }
    if (user.status === UserStatus.Deactivated) {
      // Deactivated accounts are indistinguishable from wrong credentials.
      throw new InvalidCredentialsException();
    }

    await this.users.recordLogin(user.id);
    const tokens = await this.tokens.issuePair(user.id, ctx);
    this.events.loginSuccess(user.id, ctx.ip);
    return { user: toUserSummary(user), tokens };
  }

  refresh(rawRefreshToken: string, ctx: TokenContext): Promise<TokenPair> {
    return this.tokens.rotate(rawRefreshToken, ctx);
  }

  async logout(
    rawRefreshToken: string | undefined,
    userId: string,
    ctx: TokenContext,
  ): Promise<void> {
    if (rawRefreshToken !== undefined) {
      await this.tokens.revokeByRefreshToken(rawRefreshToken);
    }
    this.events.logout(userId, ctx.ip);
  }

  async logoutAll(userId: string, ctx: TokenContext): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
    this.events.logoutAll(userId, ctx.ip);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const userId = await this.verification.consume(rawToken);
    this.events.emailVerified(userId);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new InvalidCredentialsException();
    }
    if (user.emailVerifiedAt !== null) {
      throw new EmailAlreadyVerifiedException();
    }
    const rawToken = await this.verification.issue(userId);
    void this.mail.sendVerificationEmail(user.email, rawToken);
  }

  /** Always behaves identically whether or not the email exists (no enumeration). */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (user === null) {
      return;
    }
    const rawToken = await this.passwordReset.issue(user.id);
    void this.mail.sendPasswordResetEmail(user.email, rawToken);
  }

  async resetPassword(rawToken: string, newPassword: string, ctx: TokenContext): Promise<void> {
    this.passwords.assertStrong(newPassword);
    const passwordHash = await this.passwords.hash(newPassword);

    let userId = '';
    await this.passwordReset.consume(rawToken, async (id, manager) => {
      userId = id;
      await this.users.updatePasswordHash(id, passwordHash, manager);
    });

    // A reset ends every existing session (docs 13 §3.6).
    await this.tokens.revokeAllForUser(userId);
    this.events.passwordReset(userId, ctx.ip);
  }

  async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string },
    ctx: TokenContext,
  ): Promise<TokenPair> {
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new InvalidCredentialsException();
    }
    const valid = await this.passwords.verifyConstantTime(user.passwordHash, input.currentPassword);
    if (!valid) {
      throw new CurrentPasswordInvalidException();
    }
    this.passwords.assertStrong(input.newPassword);

    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.users.updatePasswordHash(userId, passwordHash);

    // Revoke all sessions, then re-issue for the current caller (stay signed in).
    await this.tokens.revokeAllForUser(userId);
    const tokens = await this.tokens.issuePair(userId, ctx);
    this.events.passwordChanged(userId, ctx.ip);
    return tokens;
  }

  /** Builds the Google consent URL (docs 13 §3.4). */
  buildGoogleAuthUrl(): Promise<string> {
    return this.googleOAuth.buildAuthorizationUrl();
  }

  /**
   * Completes the Google callback: verify → resolve/link/create (in a
   * transaction) → issue tokens after commit → return a one-time code (for the
   * app to exchange) plus the refresh token (for the cookie) and access token.
   */
  async handleGoogleCallback(
    code: string,
    state: string,
    ctx: TokenContext,
  ): Promise<{ oneTimeCode: string; tokens: TokenPair }> {
    const profile = await this.googleOAuth.verifyProfile(code, state);
    const resolution = await this.transactions.run((manager) =>
      this.googleOAuth.resolveOrCreate(profile, manager),
    );

    await this.users.recordLogin(resolution.userId);
    const tokens = await this.tokens.issuePair(resolution.userId, ctx);
    this.events.googleLogin(resolution.userId, ctx.ip, resolution.linked);

    const oneTimeCode = await this.googleOAuth.stashOneTimeCode(tokens.accessToken);
    return { oneTimeCode, tokens };
  }

  exchangeGoogleCode(code: string): Promise<string> {
    return this.googleOAuth.redeemOneTimeCode(code);
  }

  private translateUniqueViolation(error: unknown): Error {
    if (error instanceof QueryFailedError) {
      const constraint = (error.driverError as { constraint?: string }).constraint;
      if (constraint === 'uq_users_email') {
        return new EmailTakenException();
      }
      if (constraint === 'uq_users_username') {
        return new UsernameTakenException();
      }
    }
    return error instanceof Error ? error : new Error('Registration failed');
  }
}

function toUserSummary(user: User): UserSummary {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    isEmailVerified: user.emailVerifiedAt !== null,
  };
}
