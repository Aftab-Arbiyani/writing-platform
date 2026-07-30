import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { Redis } from 'ioredis';

import { RedisService } from '../../../redis/redis.service';
import { operationsConfig } from '../../../config/operations.config';
import { OPS_REDIS } from '../operations.constants';
import type { Incident } from '../operations.types';

/**
 * Durable incident store (P7.4). Incidents are operational RECORDS that must
 * survive a cache flush and a restart, so they live in the AOF-backed durable
 * Redis DB (`getClient('auth')`) — the SAME migration-free durable-state pattern
 * the Privacy module uses for consent/DSR. No new table, no migration. The
 * immutable `audit_logs` trail (written by the Incident Service) remains the
 * permanent legal record; this store is the fast, queryable working set.
 */
@Injectable()
export class IncidentStore {
  private readonly redis: Redis;

  constructor(
    redisService: RedisService,
    @Inject(operationsConfig.KEY)
    private readonly config: ConfigType<typeof operationsConfig>,
  ) {
    this.redis = redisService.getClient('auth');
  }

  private key(id: string): string {
    return `${OPS_REDIS.incidentPrefix}${id}`;
  }

  /** Persist (create/update) an incident and index it. */
  async save(incident: Incident): Promise<void> {
    await this.redis.set(this.key(incident.id), JSON.stringify(incident));
    await this.redis.sadd(OPS_REDIS.incidentIndex, incident.id);
    // Expire resolved incidents after the retention window (index self-prunes on read).
    if (incident.status === 'resolved') {
      await this.redis.expire(this.key(incident.id), this.config.incidents.retentionSeconds);
    }
  }

  /** One incident by id (null when absent / expired). */
  async get(id: string): Promise<Incident | null> {
    const raw = await this.redis.get(this.key(id));
    if (raw === null) {
      await this.redis.srem(OPS_REDIS.incidentIndex, id);
      return null;
    }
    try {
      return JSON.parse(raw) as Incident;
    } catch {
      return null;
    }
  }

  /** All incidents, newest first (prunes index entries whose record expired). */
  async list(): Promise<Incident[]> {
    const ids = await this.redis.smembers(OPS_REDIS.incidentIndex);
    const incidents: Incident[] = [];
    for (const id of ids) {
      const incident = await this.get(id);
      if (incident !== null) {
        incidents.push(incident);
      }
    }
    return incidents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Open (unresolved) incidents. */
  async listOpen(): Promise<Incident[]> {
    return (await this.list()).filter((i) => i.status !== 'resolved');
  }

  /** First open incident sourced from a given alert (dedup for auto-escalation). */
  async findOpenBySourceAlert(alertId: string): Promise<Incident | null> {
    const open = await this.listOpen();
    return open.find((i) => i.sourceAlertId === alertId) ?? null;
  }
}
