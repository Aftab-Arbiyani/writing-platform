import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AuthProvider } from '@qalam/shared';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import type { Redis } from 'ioredis';
import { randomBytes } from 'node:crypto';
import type { EntityManager } from 'typeorm';

import { authConfig } from '../../../config/auth.config';
import { RedisService } from '../../../redis/redis.service';
import { UsersService } from '../../users/users.service';
import { AuthIdentityRepository } from '../auth-identity.repository';
import { OAuthFailedException, OAuthStateInvalidException } from '../exceptions/auth.exceptions';

/** Verified profile extracted from a Google id_token. */
export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
}

/** Result of resolving a Google profile to a Qalam account. */
export interface GoogleResolution {
  userId: string;
  /** True when an existing password account was auto-linked (docs 13 §3.5). */
  linked: boolean;
}

/**
 * Google OAuth — authorization code + PKCE + `state` (docs 13 §3.4) and account
 * linking (§3.5). `state`/`code_verifier` live in Redis (10 min TTL); DB writes
 * (user + identity) run in a transaction; token issuance happens after commit.
 *
 * `verifyProfile` is isolated so the linking logic (`resolveOrCreate`) is unit
 * testable without live Google — the transport (`getToken`/`verifyIdToken`) is
 * the only part that needs real credentials.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly redis: Redis;
  private readonly client: OAuth2Client;

  constructor(
    @Inject(authConfig.KEY) private readonly config: ConfigType<typeof authConfig>,
    private readonly redisService: RedisService,
    private readonly usersService: UsersService,
    private readonly authIdentities: AuthIdentityRepository,
  ) {
    this.redis = this.redisService.getClient('auth');
    this.client = new OAuth2Client({
      clientId: this.config.google.clientId,
      clientSecret: this.config.google.clientSecret,
      redirectUri: this.config.google.callbackUrl,
    });
  }

  /** Builds the Google consent URL, stashing `state` + PKCE verifier in Redis. */
  async buildAuthorizationUrl(): Promise<string> {
    if (this.config.google.clientId === '') {
      throw new OAuthFailedException('Google sign-in is not configured.');
    }
    const state = randomBytes(24).toString('base64url');
    const { codeVerifier, codeChallenge } = await this.client.generateCodeVerifierAsync();

    await this.redis.set(
      this.stateKey(state),
      codeVerifier,
      'EX',
      this.config.oauthStateTtlSeconds,
    );

    return this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: codeChallenge,
    });
  }

  /** Verifies `state`, exchanges the code with PKCE, and returns the Google profile. */
  async verifyProfile(code: string, state: string): Promise<GoogleProfile> {
    const codeVerifier = await this.redis.get(this.stateKey(state));
    if (codeVerifier === null) {
      throw new OAuthStateInvalidException();
    }
    await this.redis.del(this.stateKey(state)); // single-use

    try {
      const { tokens } = await this.client.getToken({ code, codeVerifier });
      if (tokens.id_token === undefined || tokens.id_token === null) {
        throw new OAuthFailedException();
      }
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.config.google.clientId,
      });
      const payload = ticket.getPayload();
      if (payload?.email === undefined || payload.email === null) {
        throw new OAuthFailedException();
      }
      return {
        sub: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
      };
    } catch (error) {
      if (error instanceof OAuthFailedException) {
        throw error;
      }
      throw new OAuthFailedException();
    }
  }

  /**
   * Find-or-link-or-create per docs 13 §3.5. Runs inside the caller's
   * transaction (`manager`). Google's own email must be verified to be trusted.
   */
  async resolveOrCreate(profile: GoogleProfile, manager: EntityManager): Promise<GoogleResolution> {
    if (!profile.emailVerified) {
      throw new OAuthFailedException('Your Google email is not verified.');
    }

    const identity = await this.authIdentities.findByProviderSubject(
      AuthProvider.Google,
      profile.sub,
      manager,
    );
    if (identity !== null) {
      return { userId: identity.userId, linked: false };
    }

    const existing = await this.usersService.findByEmail(profile.email, manager);
    if (existing !== null) {
      // Auto-link only to a VERIFIED account — else this is a takeover vector (§3.5).
      if (existing.emailVerifiedAt === null) {
        throw new OAuthFailedException(
          'An unverified account exists for this email. Verify it or reset your password first.',
        );
      }
      await this.authIdentities.create(
        {
          userId: existing.id,
          provider: AuthProvider.Google,
          providerUserId: profile.sub,
          email: profile.email,
        },
        manager,
      );
      return { userId: existing.id, linked: true };
    }

    const username = await this.usersService.generateUniqueUsername(
      profile.email.split('@')[0] ?? 'writer',
      manager,
    );
    const created = await this.usersService.createVerifiedOAuthUser(
      { email: profile.email, username },
      manager,
    );
    await this.authIdentities.create(
      {
        userId: created.id,
        provider: AuthProvider.Google,
        providerUserId: profile.sub,
        email: profile.email,
      },
      manager,
    );
    return { userId: created.id, linked: false };
  }

  /** Stores an access token under a one-time code for the post-redirect exchange (§3.4). */
  async stashOneTimeCode(accessToken: string): Promise<string> {
    const code = randomBytes(24).toString('base64url');
    await this.redis.set(this.codeKey(code), accessToken, 'EX', 60);
    return code;
  }

  /** Redeems a one-time code for its access token (single-use). */
  async redeemOneTimeCode(code: string): Promise<string> {
    const key = this.codeKey(code);
    const accessToken = await this.redis.get(key);
    if (accessToken === null) {
      throw new OAuthStateInvalidException();
    }
    await this.redis.del(key);
    return accessToken;
  }

  private stateKey(state: string): string {
    return `oauth:state:${state}`;
  }
  private codeKey(code: string): string {
    return `oauth:code:${code}`;
  }
}
