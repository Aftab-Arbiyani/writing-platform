import { Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { RedisService } from '../../redis/redis.service';
import type { AuditContext } from '../audit/audit.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { SECURITY_ACTIONS, THREAT_LEVEL } from '../security/security.constants';
import {
  ALL_CONSENT_PURPOSES,
  CONSENT_STATE,
  PRIVACY_REDIS,
  type ConsentPurpose,
  type ConsentState,
} from './privacy.constants';
import type { ConsentEntry } from './privacy.types';

/**
 * Consent tracking (P7.2, GDPR-aligned). Current consent state is durable Redis
 * (AOF) keyed per user; every grant/withdrawal is also written IMMUTABLY to
 * `audit_logs` via {@link SecurityAuditService} — that append-only trail is the
 * legal proof-of-consent record (7-year retention). Default is opt-in: an unset
 * purpose reads as withdrawn, so we never assume consent.
 */
@Injectable()
export class ConsentService {
  private readonly redis: Redis;

  constructor(
    redisService: RedisService,
    private readonly securityAudit: SecurityAuditService,
  ) {
    this.redis = redisService.getClient('auth');
  }

  private key(userId: string): string {
    return `${PRIVACY_REDIS.consentPrefix}${userId}`;
  }

  /** Current consent for every known purpose (unset → withdrawn). */
  async getConsent(userId: string): Promise<ConsentEntry[]> {
    const stored = await this.redis.hgetall(this.key(userId));
    return ALL_CONSENT_PURPOSES.map((purpose) => {
      const raw = stored[purpose];
      if (raw === undefined) {
        return { purpose, state: CONSENT_STATE.Unset, updatedAt: null };
      }
      const [state, at] = raw.split('|');
      return {
        purpose,
        state: (state as ConsentState) ?? CONSENT_STATE.Unset,
        updatedAt: at ?? null,
      };
    });
  }

  /** True only when the user has explicitly granted `purpose`. */
  async hasConsent(userId: string, purpose: ConsentPurpose): Promise<boolean> {
    const raw = await this.redis.hget(this.key(userId), purpose);
    return raw !== null && raw.startsWith(CONSENT_STATE.Granted);
  }

  /** Grant or withdraw a purpose; records the immutable consent event. */
  async setConsent(
    userId: string,
    purpose: ConsentPurpose,
    granted: boolean,
    ctx?: AuditContext,
  ): Promise<void> {
    const state = granted ? CONSENT_STATE.Granted : CONSENT_STATE.Withdrawn;
    const now = new Date().toISOString();
    await this.redis.hset(this.key(userId), purpose, `${state}|${now}`);
    await this.securityAudit.record({
      action: granted ? SECURITY_ACTIONS.ConsentGranted : SECURITY_ACTIONS.ConsentWithdrawn,
      level: THREAT_LEVEL.Info,
      actorId: userId,
      actorRole: 'user',
      targetType: 'privacy_consent',
      targetId: userId,
      metadata: { purpose, state },
      context: ctx,
    });
  }
}
