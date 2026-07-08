import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import { v7 as uuidv7 } from 'uuid';

import { authConfig } from '../../../config/auth.config';
import { RedisService } from '../../../redis/redis.service';
import { RolesService } from '../../users/roles.service';
import { AuthEventLogger } from './auth-event.logger';
import {
  RefreshReusedException,
  SessionRevokedException,
  TokenInvalidException,
} from '../exceptions/auth.exceptions';
import type { AccessTokenPayload, RefreshTokenPayload } from '../interfaces/jwt-payload.interface';

/**
 * JWT `expiresIn` type. Our TTLs are Zod-validated duration strings
 * (env.schema.ts), but @nestjs/jwt types `expiresIn` as the `ms` library's
 * branded `StringValue`; this precise alias lets a validated `"15m"`/`"30d"`
 * satisfy it without an unsafe cast.
 */
type JwtExpiresIn = `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`;

/** Returned to the caller; the controller decides cookie (web) vs body (mobile). */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Login/rotation context recorded on the token family for auditing. */
export interface TokenContext {
  ip: string;
  device: string;
}

interface FamilyRecord {
  userId: string;
  createdAt: string;
  device: string;
  ip: string;
  revoked: boolean;
}
interface RefreshRecord {
  familyId: string;
  status: 'live' | 'used';
}

/**
 * Access + rotating-refresh tokens with reuse detection (docs 13 §3.2).
 *
 * Access tokens are stateless (verified by `JwtStrategy`, never hit Redis on the
 * hot path). Refresh tokens are stateful in **Redis DB 3** as token families:
 *
 *   auth:family:{familyId}          { userId, createdAt, device, ip, revoked }   TTL 30d
 *   auth:rt:{jti}                   { familyId, status: live|used }              TTL 30d
 *   auth:user:{userId}:families     SET of familyIds                             TTL 30d
 *   auth:user:{userId}:sv           session version integer                      no TTL
 *
 * Rotation: a live token is marked used and a successor minted in the same
 * family. Presenting a *used* token = theft → the whole family is revoked (loud
 * failure over silent compromise).
 */
@Injectable()
export class TokenService {
  private readonly redis: Redis;
  private readonly refreshTtlSeconds: number;

  constructor(
    @Inject(authConfig.KEY) private readonly config: ConfigType<typeof authConfig>,
    private readonly jwtService: JwtService,
    private readonly rolesService: RolesService,
    private readonly redisService: RedisService,
    private readonly authEvents: AuthEventLogger,
  ) {
    this.redis = this.redisService.getClient('auth');
    this.refreshTtlSeconds = parseDurationToSeconds(this.config.jwt.refreshTtl);
  }

  /** Issues a new token family (login, register, OAuth). */
  async issuePair(userId: string, ctx: TokenContext): Promise<TokenPair> {
    const familyId = uuidv7();
    const sv = await this.getOrInitSessionVersion(userId);

    const family: FamilyRecord = {
      userId,
      createdAt: new Date().toISOString(),
      device: ctx.device,
      ip: ctx.ip,
      revoked: false,
    };
    await this.redis.set(
      this.familyKey(familyId),
      JSON.stringify(family),
      'EX',
      this.refreshTtlSeconds,
    );
    await this.redis.sadd(this.userFamiliesKey(userId), familyId);
    await this.redis.expire(this.userFamiliesKey(userId), this.refreshTtlSeconds);

    return this.mintPair(userId, familyId, sv);
  }

  /**
   * Rotation protocol (docs 13 §3.2). Verifies + rotates a refresh token, or
   * detects reuse and revokes the family.
   */
  async rotate(rawRefreshToken: string, ctx: TokenContext): Promise<TokenPair> {
    const payload = await this.verifyRefresh(rawRefreshToken);

    const rtRaw = await this.redis.get(this.rtKey(payload.jti));
    if (rtRaw === null) {
      throw new TokenInvalidException(); // unknown or expired
    }
    const rt = JSON.parse(rtRaw) as RefreshRecord;

    const familyRaw = await this.redis.get(this.familyKey(payload.familyId));
    if (familyRaw === null) {
      throw new SessionRevokedException(); // family gone (logged out / expired)
    }
    const family = JSON.parse(familyRaw) as FamilyRecord;
    if (family.revoked) {
      throw new SessionRevokedException();
    }

    if (rt.status === 'used') {
      // Reuse detected — revoke the family and alert (docs 13 §3.2).
      await this.revokeFamily(payload.familyId, payload.sub);
      this.authEvents.refreshReuseDetected(payload.sub, payload.familyId, ctx.ip);
      throw new RefreshReusedException();
    }

    // Consume this token; mint its successor in the same family.
    await this.redis.set(
      this.rtKey(payload.jti),
      JSON.stringify({ ...rt, status: 'used' }),
      'KEEPTTL',
    );
    const sv = await this.getOrInitSessionVersion(payload.sub);
    return this.mintPair(payload.sub, payload.familyId, sv);
  }

  /** Single logout — revoke the presented token's family. Idempotent. */
  async revokeByRefreshToken(rawRefreshToken: string): Promise<void> {
    try {
      const payload = await this.verifyRefresh(rawRefreshToken);
      await this.revokeFamily(payload.familyId, payload.sub);
    } catch {
      // Invalid/absent token → nothing to revoke; logout stays idempotent.
    }
  }

  /** "Log out everywhere" — delete every family and bump the session version. */
  async revokeAllForUser(userId: string): Promise<void> {
    const familyIds = await this.redis.smembers(this.userFamiliesKey(userId));
    if (familyIds.length > 0) {
      await this.redis.del(...familyIds.map((id) => this.familyKey(id)));
    }
    await this.redis.del(this.userFamiliesKey(userId));
    await this.redis.incr(this.sessionVersionKey(userId));
  }

  private async mintPair(userId: string, familyId: string, sv: number): Promise<TokenPair> {
    const role = await this.rolesService.getEffectiveRole(userId);
    const accessPayload: AccessTokenPayload = { sub: userId, role, sv, jti: uuidv7() };
    const refreshJti = uuidv7();
    const refreshPayload: RefreshTokenPayload = { sub: userId, jti: refreshJti, familyId };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: this.config.jwt.accessTtl as JwtExpiresIn,
      issuer: this.config.jwt.issuer,
    });
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.config.jwt.refreshSecret,
      expiresIn: this.config.jwt.refreshTtl as JwtExpiresIn,
      issuer: this.config.jwt.issuer,
    });

    await this.redis.set(
      this.rtKey(refreshJti),
      JSON.stringify({ familyId, status: 'live' } satisfies RefreshRecord),
      'EX',
      this.refreshTtlSeconds,
    );

    return { accessToken, refreshToken };
  }

  private async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.jwt.refreshSecret,
        issuer: this.config.jwt.issuer,
      });
    } catch {
      throw new TokenInvalidException();
    }
  }

  private async revokeFamily(familyId: string, userId: string): Promise<void> {
    await this.redis.del(this.familyKey(familyId));
    await this.redis.srem(this.userFamiliesKey(userId), familyId);
  }

  private async getOrInitSessionVersion(userId: string): Promise<number> {
    const key = this.sessionVersionKey(userId);
    const current = await this.redis.get(key);
    if (current === null) {
      await this.redis.set(key, '0');
      return 0;
    }
    return Number.parseInt(current, 10);
  }

  private familyKey(familyId: string): string {
    return `auth:family:${familyId}`;
  }
  private rtKey(jti: string): string {
    return `auth:rt:${jti}`;
  }
  private userFamiliesKey(userId: string): string {
    return `auth:user:${userId}:families`;
  }
  private sessionVersionKey(userId: string): string {
    return `auth:user:${userId}:sv`;
  }
}

/** Parses a JWT duration string ("15m", "30d", "900s") into seconds. */
function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration);
  if (match === null) {
    throw new Error(`Invalid duration: ${duration}`);
  }
  const value = Number.parseInt(match[1] ?? '0', 10);
  const unitSeconds: Record<string, number> = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400 };
  return Math.round(value * (unitSeconds[match[2] ?? 's'] ?? 1));
}
