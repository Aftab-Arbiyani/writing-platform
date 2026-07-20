import type { RedisService } from '../../redis/redis.service';
import type { SecurityAuditService } from './security-audit.service';
import type { SecurityPolicyService } from './security-policy.service';
import { ThreatDetectionService } from './threat-detection.service';

/** Minimal in-memory ioredis fake covering exactly the calls the service makes. */
class FakeRedis {
  private nums = new Map<string, number>();
  private strs = new Map<string, string>();
  private sets = new Map<string, Set<string>>();
  private ttls = new Map<string, number>();

  incr(key: string): Promise<number> {
    const v = (this.nums.get(key) ?? 0) + 1;
    this.nums.set(key, v);
    return Promise.resolve(v);
  }
  incrby(key: string, by: number): Promise<number> {
    const v = (this.nums.get(key) ?? 0) + by;
    this.nums.set(key, v);
    return Promise.resolve(v);
  }
  get(key: string): Promise<string | null> {
    if (this.nums.has(key)) return Promise.resolve(String(this.nums.get(key)));
    return Promise.resolve(this.strs.get(key) ?? null);
  }
  set(key: string, value: string, _ex?: string, seconds?: number): Promise<'OK'> {
    this.strs.set(key, value);
    if (seconds !== undefined) this.ttls.set(key, seconds);
    return Promise.resolve('OK');
  }
  expire(key: string, seconds: number): Promise<number> {
    this.ttls.set(key, seconds);
    return Promise.resolve(1);
  }
  ttl(key: string): Promise<number> {
    return Promise.resolve(this.ttls.get(key) ?? -2);
  }
  del(...keys: string[]): Promise<number> {
    for (const k of keys) {
      this.nums.delete(k);
      this.strs.delete(k);
      this.ttls.delete(k);
    }
    return Promise.resolve(keys.length);
  }
  sadd(key: string, member: string): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    const had = set.has(member);
    set.add(member);
    this.sets.set(key, set);
    return Promise.resolve(had ? 0 : 1);
  }
  scard(key: string): Promise<number> {
    return Promise.resolve(this.sets.get(key)?.size ?? 0);
  }
  sismember(key: string, member: string): Promise<number> {
    return Promise.resolve(this.sets.get(key)?.has(member) === true ? 1 : 0);
  }
}

function build(maxAttempts = 3): {
  service: ThreatDetectionService;
  audit: { record: jest.Mock };
} {
  const redis = new FakeRedis();
  const redisService = { getClient: () => redis } as unknown as RedisService;
  const policy = {
    lockoutPolicy: () => Promise.resolve({ enabled: true, maxAttempts, lockoutMinutes: 15 }),
    threatThresholds: () => ({
      stuffingDistinctAccounts: 10,
      bruteForceAttempts: 10,
      highRiskScore: 100,
    }),
  } as unknown as SecurityPolicyService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new ThreatDetectionService(
    redisService,
    policy,
    audit as unknown as SecurityAuditService,
  );
  return { service, audit };
}

describe('ThreatDetectionService', () => {
  it('locks a source out after maxAttempts failures', async () => {
    const { service, audit } = build(3);
    const ctx = { ip: '203.0.113.7', email: 'user@example.com' };

    expect((await service.lockoutState(ctx)).locked).toBe(false);
    const r1 = await service.recordLoginFailure(ctx);
    expect(r1.locked).toBe(false);
    await service.recordLoginFailure(ctx);
    const r3 = await service.recordLoginFailure(ctx);
    expect(r3.failureCount).toBe(3);
    expect(r3.locked).toBe(true);
    expect((await service.lockoutState(ctx)).locked).toBe(true);
    // An AccountLocked security event was recorded.
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.account.locked' }),
    );
  });

  it('clears failure state on success and does not flag the first device', async () => {
    const { service, audit } = build(3);
    const ctx = { ip: '203.0.113.7', email: 'user@example.com', userId: 'u1', device: 'iPhone' };
    await service.recordLoginFailure(ctx);
    const result = await service.recordLoginSuccess(ctx);
    expect(result.suspicious).toBe(false); // first device = baseline, not suspicious
    expect(await service.failedLoginCount(ctx)).toBe(0); // cleared
    // A second, different device IS suspicious.
    const suspicious = await service.recordLoginSuccess({
      ...ctx,
      device: 'AndroidTablet',
      ip: '198.51.100.9',
    });
    expect(suspicious.suspicious).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.suspicious_login' }),
    );
  });

  it('reports failed-login counts for the admin view', async () => {
    const { service } = build(5);
    const ctx = { ip: '203.0.113.7', email: 'user@example.com' };
    await service.recordLoginFailure(ctx);
    await service.recordLoginFailure(ctx);
    expect(await service.failedLoginCount(ctx)).toBe(2);
  });
});
