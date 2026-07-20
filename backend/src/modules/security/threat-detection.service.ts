import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { RedisService } from '../../redis/redis.service';
import { SecurityAuditService } from './security-audit.service';
import {
  SECURITY_ACTIONS,
  SECURITY_EVENT_TYPE,
  SECURITY_METRICS,
  SECURITY_REDIS,
  THREAT_LEVEL,
  THREAT_LEVEL_WEIGHT,
  THREAT_SCORE_WINDOW_SECONDS,
} from './security.constants';
import type { SecurityEventType, ThreatLevel } from './security.constants';
import { SecurityPolicyService } from './security-policy.service';

/** Context for a login-outcome recording (ip is the anti-abuse anchor). */
export interface LoginContext {
  ip: string;
  email?: string;
  userId?: string | null;
  device?: string | null;
  requestId?: string | null;
}

export interface LockoutState {
  locked: boolean;
  retryAfterSeconds: number;
}

/**
 * Threat Detection Service (P7.2). Redis-backed (DB 3 "auth", alongside the
 * refresh families + rate limiter) detection + scoring that turns raw auth
 * signals into classified, immutably-audited security events:
 *   - failed-login counting → account lockout (source-scoped: ip+email, so a
 *     third party cannot lock a victim's account — honoring docs/13 §8's
 *     "rate-limit over lockout, no victim DoS" stance while still enforcing a
 *     lockout rule);
 *   - credential-stuffing detection (one IP failing against many accounts);
 *   - brute-force detection (many failures against one credential);
 *   - suspicious-login detection (new device/IP for a known user);
 *   - a rolling per-subject threat score (level-weighted, windowed).
 *
 * Ephemeral state lives in Redis (TTL'd); the durable record of every detection
 * is an immutable `audit_logs` row via {@link SecurityAuditService}. This is the
 * single source of security-signal truth — nothing detects abuse ad hoc.
 */
@Injectable()
export class ThreatDetectionService {
  private readonly logger = new Logger(ThreatDetectionService.name);
  private readonly redis: Redis;

  constructor(
    redisService: RedisService,
    private readonly policy: SecurityPolicyService,
    private readonly securityAudit: SecurityAuditService,
  ) {
    this.redis = redisService.getClient('auth');
  }

  /** Stable, non-reversible key part for an email (never store raw email in a key). */
  private hashPart(value: string): string {
    return createHash('sha256').update(value.toLowerCase()).digest('hex').slice(0, 16);
  }

  /** Source-scoped subject key for lockout/failure counting. */
  private loginKey(ctx: LoginContext): string {
    const email = ctx.email !== undefined ? this.hashPart(ctx.email) : 'anon';
    return `${ctx.ip}:${email}`;
  }

  /** Is this login source currently locked out? Call BEFORE verifying the password. */
  async lockoutState(ctx: LoginContext): Promise<LockoutState> {
    const policy = await this.policy.lockoutPolicy();
    if (!policy.enabled) return { locked: false, retryAfterSeconds: 0 };
    const key = `${SECURITY_REDIS.lockoutPrefix}${this.loginKey(ctx)}`;
    const ttl = await this.redis.ttl(key);
    return ttl > 0
      ? { locked: true, retryAfterSeconds: ttl }
      : { locked: false, retryAfterSeconds: 0 };
  }

  /**
   * Record a failed login. Increments the source failure counter, updates the
   * credential-stuffing set, and — on reaching the configured threshold — sets a
   * lockout and records the classified security events. Returns the current
   * failure count + whether the source is now locked. Never throws into login.
   */
  async recordLoginFailure(ctx: LoginContext): Promise<{ failureCount: number; locked: boolean }> {
    try {
      const policy = await this.policy.lockoutPolicy();
      const thresholds = this.policy.threatThresholds();
      const subject = this.loginKey(ctx);
      const failKey = `${SECURITY_REDIS.loginFailPrefix}${subject}`;
      const windowSec = policy.lockoutMinutes * 60;

      const count = await this.redis.incr(failKey);
      if (count === 1) await this.redis.expire(failKey, windowSec);

      // Credential-stuffing: distinct accounts a single IP has failed against.
      if (ctx.email !== undefined) {
        const stuffKey = `${SECURITY_REDIS.stuffingPrefix}${ctx.ip}`;
        await this.redis.sadd(stuffKey, this.hashPart(ctx.email));
        await this.redis.expire(stuffKey, THREAT_SCORE_WINDOW_SECONDS);
        const distinct = await this.redis.scard(stuffKey);
        if (distinct >= thresholds.stuffingDistinctAccounts) {
          await this.emit(SECURITY_EVENT_TYPE.CredentialStuffing, THREAT_LEVEL.High, {
            action: SECURITY_ACTIONS.CredentialStuffing,
            subjectKey: subject,
            ctx,
            metadata: { distinctAccounts: distinct, ip: ctx.ip },
            metric: SECURITY_METRICS.threatEvents,
          });
        }
      }

      // Always record the auth failure signal (feeds the admin failed-login view).
      await this.emit(SECURITY_EVENT_TYPE.AuthFailure, THREAT_LEVEL.Low, {
        action: SECURITY_ACTIONS.LoginFailed,
        subjectKey: subject,
        ctx,
        metadata: { failureCount: count, ip: ctx.ip },
        metric: SECURITY_METRICS.authFailures,
      });

      // Brute-force signal.
      if (count >= thresholds.bruteForceAttempts) {
        await this.emit(SECURITY_EVENT_TYPE.BruteForce, THREAT_LEVEL.Medium, {
          action: SECURITY_ACTIONS.ThreatDetected,
          subjectKey: subject,
          ctx,
          metadata: { failureCount: count, ip: ctx.ip },
        });
      }

      // Lockout on threshold.
      let locked = false;
      if (policy.enabled && count >= policy.maxAttempts) {
        const lockKey = `${SECURITY_REDIS.lockoutPrefix}${subject}`;
        await this.redis.set(lockKey, '1', 'EX', windowSec);
        locked = true;
        await this.securityAudit.record({
          action: SECURITY_ACTIONS.AccountLocked,
          level: THREAT_LEVEL.High,
          eventType: SECURITY_EVENT_TYPE.BruteForce,
          actorId: ctx.userId ?? null,
          targetType: 'auth',
          metadata: {
            subject,
            failureCount: count,
            lockoutMinutes: policy.lockoutMinutes,
            ip: ctx.ip,
          },
          context: { ip: ctx.ip, requestId: ctx.requestId },
          metric: SECURITY_METRICS.accountLockouts,
        });
      }
      return { failureCount: count, locked };
    } catch (error) {
      this.logger.warn(`recordLoginFailure failed (non-fatal): ${(error as Error).message}`);
      return { failureCount: 0, locked: false };
    }
  }

  /**
   * Record a successful login. Clears the failure counter + lockout, and flags a
   * suspicious login when the device/IP is new for this user (new-device baseline
   * in Redis). Never throws into login.
   */
  async recordLoginSuccess(ctx: LoginContext): Promise<{ suspicious: boolean }> {
    try {
      const subject = this.loginKey(ctx);
      await this.redis.del(
        `${SECURITY_REDIS.loginFailPrefix}${subject}`,
        `${SECURITY_REDIS.lockoutPrefix}${subject}`,
      );
      if (ctx.userId === undefined || ctx.userId === null) return { suspicious: false };

      const fingerprint = this.hashPart(`${ctx.device ?? 'unknown'}|${ctx.ip}`);
      const devicesKey = `${SECURITY_REDIS.knownDevicePrefix}${ctx.userId}`;
      const isNew = (await this.redis.sismember(devicesKey, fingerprint)) === 0;
      const known = await this.redis.scard(devicesKey);
      await this.redis.sadd(devicesKey, fingerprint);
      await this.redis.expire(devicesKey, 90 * 86_400); // 90-day rolling device memory

      // First-ever login (empty baseline) is not "suspicious" — only a new
      // device once a baseline exists.
      const suspicious = isNew && known > 0;
      if (suspicious) {
        await this.securityAudit.record({
          action: SECURITY_ACTIONS.SuspiciousLogin,
          level: THREAT_LEVEL.Medium,
          eventType: SECURITY_EVENT_TYPE.SuspiciousLogin,
          actorId: ctx.userId,
          targetType: 'auth',
          targetId: ctx.userId,
          metadata: { newDevice: true, ip: ctx.ip },
          context: { ip: ctx.ip, requestId: ctx.requestId },
        });
      }
      return { suspicious };
    } catch (error) {
      this.logger.warn(`recordLoginSuccess failed (non-fatal): ${(error as Error).message}`);
      return { suspicious: false };
    }
  }

  /** Current failure count for a login source (feeds the admin failed-login view). */
  async failedLoginCount(ctx: LoginContext): Promise<number> {
    const n = await this.redis.get(`${SECURITY_REDIS.loginFailPrefix}${this.loginKey(ctx)}`);
    return n === null ? 0 : Number(n);
  }

  /** Rolling threat score for a subject key (0 = clean). */
  async threatScore(subjectKey: string): Promise<number> {
    const n = await this.redis.get(`${SECURITY_REDIS.threatScorePrefix}${subjectKey}`);
    return n === null ? 0 : Number(n);
  }

  /**
   * Generic security-event entry point for other subsystems (authz denials,
   * rate-limit breaches, replay blocks). Bumps the subject's rolling threat
   * score and records the immutable event.
   */
  async report(input: {
    eventType: SecurityEventType;
    level: ThreatLevel;
    action: (typeof SECURITY_ACTIONS)[keyof typeof SECURITY_ACTIONS];
    subjectKey: string;
    actorId?: string | null;
    ip?: string | null;
    requestId?: string | null;
    metadata?: Record<string, unknown>;
    metric?: string;
  }): Promise<void> {
    await this.emit(input.eventType, input.level, {
      action: input.action,
      subjectKey: input.subjectKey,
      ctx: { ip: input.ip ?? 'unknown', userId: input.actorId, requestId: input.requestId },
      metadata: input.metadata ?? {},
      metric: input.metric,
    });
  }

  /** Bumps the rolling threat score and records the classified event. */
  private async emit(
    eventType: SecurityEventType,
    level: ThreatLevel,
    opts: {
      action: (typeof SECURITY_ACTIONS)[keyof typeof SECURITY_ACTIONS];
      subjectKey: string;
      ctx: LoginContext;
      metadata: Record<string, unknown>;
      metric?: string;
    },
  ): Promise<void> {
    const scoreKey = `${SECURITY_REDIS.threatScorePrefix}${opts.subjectKey}`;
    const weight = THREAT_LEVEL_WEIGHT[level];
    if (weight > 0) {
      const score = await this.redis.incrby(scoreKey, weight);
      if (score === weight) await this.redis.expire(scoreKey, THREAT_SCORE_WINDOW_SECONDS);
    }
    await this.securityAudit.record({
      action: opts.action,
      level,
      eventType,
      actorId: opts.ctx.userId ?? null,
      targetType: 'auth',
      metadata: { ...opts.metadata, subject: opts.subjectKey },
      context: { ip: opts.ctx.ip, requestId: opts.ctx.requestId },
      metric: opts.metric,
    });
  }
}
