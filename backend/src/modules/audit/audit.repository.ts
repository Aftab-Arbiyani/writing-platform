import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';

import { AuditLog } from './entities/audit-log.entity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Filters for the global admin audit-log browser (E12.7). */
export interface AuditAdminFilters {
  action?: string;
  /** Action prefix before the first dot, e.g. `user`, `report`, `content`. */
  module?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  sort?: string;
  offset: number;
  limit: number;
}

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

  // ── Global admin audit browser (E12.7) ────────────────────────────────────────

  /** Builds the filtered (unsorted, unpaged) audit query — shared by list + export. */
  private adminQuery(filters: AuditAdminFilters): SelectQueryBuilder<AuditLog> {
    const qb = this.repo().createQueryBuilder('a');
    if (filters.action) qb.andWhere('a.action = :action', { action: filters.action });
    if (filters.module) qb.andWhere('a.action LIKE :mod', { mod: `${filters.module}.%` });
    if (filters.actorId) qb.andWhere('a.actor_id = :actorId', { actorId: filters.actorId });
    if (filters.targetType) qb.andWhere('a.target_type = :tt', { tt: filters.targetType });
    if (filters.targetId) qb.andWhere('a.target_id = :ti', { ti: filters.targetId });
    if (filters.dateFrom) qb.andWhere('a.created_at >= :from', { from: filters.dateFrom });
    if (filters.dateTo) qb.andWhere('a.created_at <= :to', { to: filters.dateTo });
    if (filters.q) {
      if (UUID_RE.test(filters.q)) {
        qb.andWhere('(a.actor_id = :q OR a.target_id = :q)', { q: filters.q });
      } else {
        qb.andWhere('a.action ILIKE :like', { like: `%${filters.q}%` });
      }
    }
    return qb;
  }

  /** Offset-paginated, filtered audit list, newest first (or by action). */
  adminList(filters: AuditAdminFilters): Promise<[AuditLog[], number]> {
    const qb = this.adminQuery(filters);
    const token = filters.sort ?? '-createdAt';
    const desc = token.startsWith('-');
    const field = desc ? token.slice(1) : token;
    const column = field === 'action' ? 'a.action' : 'a.created_at';
    return qb
      .orderBy(column, desc ? 'DESC' : 'ASC')
      .addOrderBy('a.id', 'DESC')
      .skip(filters.offset)
      .take(filters.limit)
      .getManyAndCount();
  }

  findById(id: string): Promise<AuditLog | null> {
    return this.repo().findOne({ where: { id } });
  }

  /** Streams the FILTERED audit set in batches for export (no pager). */
  async *stream(filters: AuditAdminFilters, batchSize: number): AsyncGenerator<AuditLog[]> {
    let offset = 0;
    for (;;) {
      const rows = await this.adminQuery(filters)
        .orderBy('a.created_at', 'DESC')
        .addOrderBy('a.id', 'DESC')
        .skip(offset)
        .take(batchSize)
        .getMany();
      if (rows.length === 0) {
        break;
      }
      yield rows;
      if (rows.length < batchSize) {
        break;
      }
      offset += batchSize;
    }
  }

  /** Count of entries at/after a timestamp (statistics: actions today/week/month). */
  countSince(since: Date): Promise<number> {
    return this.repo()
      .createQueryBuilder('a')
      .where('a.created_at >= :since', { since })
      .getCount();
  }

  /** Top action codes since a timestamp (statistics). */
  async topActions(since: Date, limit: number): Promise<Array<{ action: string; count: number }>> {
    const rows = await this.repo()
      .createQueryBuilder('a')
      .select('a.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('a.created_at >= :since', { since })
      .groupBy('a.action')
      .orderBy('COUNT(*)', 'DESC')
      .take(limit)
      .getRawMany<{ action: string; count: string }>();
    return rows.map((row) => ({ action: row.action, count: Number(row.count) }));
  }

  /** Most active actors since a timestamp (statistics: most active moderators). */
  async topActors(since: Date, limit: number): Promise<Array<{ actorId: string; count: number }>> {
    const rows = await this.repo()
      .createQueryBuilder('a')
      .select('a.actor_id', 'actorId')
      .addSelect('COUNT(*)', 'count')
      .where('a.created_at >= :since', { since })
      .andWhere('a.actor_id IS NOT NULL')
      .groupBy('a.actor_id')
      .orderBy('COUNT(*)', 'DESC')
      .take(limit)
      .getRawMany<{ actorId: string; count: string }>();
    return rows.map((row) => ({ actorId: row.actorId, count: Number(row.count) }));
  }
}
