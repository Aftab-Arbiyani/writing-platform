import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { AuditLog } from './entities/audit-log.entity';

/** A new audit row (ids/timestamps assigned by the entity). */
export interface NewAuditEntry {
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

/** Filters for a target's audit history (already validated by the DTO). */
export interface AuditListFilters {
  actions?: string[];
  offset: number;
  limit: number;
}

/** Per-action tally for a target (audit summary). */
export interface AuditActionTally {
  action: string;
  count: number;
}

/**
 * Data access for the append-only `audit_logs` table (docs 16 §3.3 — only
 * repositories touch query builders). Writes are inserts; reads are offset-
 * paginated staff queries (docs 05 §5.2) backed by `idx_audit_logs_target`.
 */
@Injectable()
export class AuditRepository {
  constructor(private readonly dataSource: DataSource) {}

  private repo(manager?: EntityManager): Repository<AuditLog> {
    return (manager ?? this.dataSource.manager).getRepository(AuditLog);
  }

  /** Appends one immutable audit entry. */
  record(entry: NewAuditEntry, manager?: EntityManager): Promise<AuditLog> {
    const repo = this.repo(manager);
    return repo.save(repo.create(entry));
  }

  /** A target's audit trail, newest first, offset-paginated with a total count. */
  listForTarget(
    targetType: string,
    targetId: string,
    filters: AuditListFilters,
  ): Promise<[AuditLog[], number]> {
    const qb = this.repo()
      .createQueryBuilder('a')
      .where('a.target_type = :targetType', { targetType })
      .andWhere('a.target_id = :targetId', { targetId });

    if (filters.actions !== undefined && filters.actions.length > 0) {
      qb.andWhere('a.action IN (:...actions)', { actions: filters.actions });
    }

    return qb
      .orderBy('a.created_at', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .skip(filters.offset)
      .take(filters.limit)
      .getManyAndCount();
  }

  /** Per-action counts for a target (drives the audit summary). */
  async tallyByAction(targetType: string, targetId: string): Promise<AuditActionTally[]> {
    const rows = await this.repo()
      .createQueryBuilder('a')
      .select('a.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('a.target_type = :targetType', { targetType })
      .andWhere('a.target_id = :targetId', { targetId })
      .groupBy('a.action')
      .getRawMany<{ action: string; count: string }>();
    return rows.map((row) => ({ action: row.action, count: Number(row.count) }));
  }

  /** Most recent entries for a target (activity feed), capped. */
  recentForTarget(targetType: string, targetId: string, limit: number): Promise<AuditLog[]> {
    return this.repo()
      .createQueryBuilder('a')
      .where('a.target_type = :targetType', { targetType })
      .andWhere('a.target_id = :targetId', { targetId })
      .orderBy('a.created_at', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .take(limit)
      .getMany();
  }
}
