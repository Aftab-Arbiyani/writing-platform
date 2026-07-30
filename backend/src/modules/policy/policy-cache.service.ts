import { Injectable } from '@nestjs/common';
import { POLICY_DECISION_CACHE_TTL_SECONDS, type PolicyDecision } from '@qalam/shared';

interface CacheEntry {
  decision: PolicyDecision;
  expiresAt: number;
}

/**
 * In-memory, short-TTL cache for resolved policy decisions. Correctness beats
 * hit rate on the authorization path: the TTL is small and any change to a
 * user's standing (restriction applied, membership changed, role updated) MUST
 * call {@link invalidateUser} so a stale `allow` can never outlive the change.
 *
 * Keyed per user so invalidation is O(1) on the security-critical path. A
 * Redis-backed shared cache is a drop-in replacement behind this same surface
 * for multi-instance deployments (Phase 7).
 */
@Injectable()
export class PolicyCacheService {
  private readonly store = new Map<string, Map<string, CacheEntry>>();

  get(userId: string, key: string): PolicyDecision | null {
    const userEntries = this.store.get(userId);
    const entry = userEntries?.get(key);
    if (entry === undefined) {
      return null;
    }
    if (entry.expiresAt <= this.now()) {
      userEntries?.delete(key);
      return null;
    }
    return entry.decision;
  }

  set(userId: string, key: string, decision: PolicyDecision): void {
    const ttlSeconds = decision.ttlSeconds ?? POLICY_DECISION_CACHE_TTL_SECONDS;
    let userEntries = this.store.get(userId);
    if (userEntries === undefined) {
      userEntries = new Map<string, CacheEntry>();
      this.store.set(userId, userEntries);
    }
    userEntries.set(key, { decision, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  /** Clears every cached decision for a user — call after any standing change. */
  invalidateUser(userId: string): void {
    this.store.delete(userId);
  }

  /** Clears the whole cache (e.g. after a policy-config change). */
  invalidateAll(): void {
    this.store.clear();
  }

  private now(): number {
    return Date.now();
  }
}
