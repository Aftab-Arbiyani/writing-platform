import { Injectable } from '@nestjs/common';

import type { OffsetPage } from '../../common/types/paginated-result';
import { buildOffsetMeta } from '../../common/pagination/pagination.helper';
import { AUDIT_TARGET, auditCategoryOf } from './audit.constants';
import { AuditRepository } from './audit.repository';
import type { AuditAdminFilters } from './audit.repository';
import type { AuditLog } from './entities/audit-log.entity';
import { AuditLogDto, AuditStatisticsDto, AuditSummaryDto } from './dto/audit-log.dto';

/** Context resolved from the originating HTTP request (best-effort). */
export interface AuditContext {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/** Everything needed to persist one admin action. */
export interface RecordAuditInput {
  actorId: string;
  actorRole: string;
  action: string;
  targetId: string | null;
  targetType?: string;
  metadata?: Record<string, unknown>;
  context?: AuditContext;
}

/**
 * The shared audit trail service (docs 13 §11). It is intentionally **not** an
 * admin service — it lives in its own module and is exported so any privileged
 * surface can `record(...)` and read a subject's history. E12.5's admin
 * controllers orchestrate it; they never write `audit_logs` directly.
 */
@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  /** Appends one immutable audit entry (call AFTER the mutation commits). */
  async record(input: RecordAuditInput): Promise<void> {
    await this.repository.record({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      targetType: input.targetType ?? AUDIT_TARGET.User,
      targetId: input.targetId,
      metadata: input.metadata ?? {},
      ip: input.context?.ip ?? null,
      userAgent: input.context?.userAgent ?? null,
      requestId: input.context?.requestId ?? null,
    });
  }

  /** Offset-paginated audit trail for a user, optionally filtered by action. */
  async listForUser(
    userId: string,
    options: { actions?: string[]; page: number; limit: number; offset: number },
  ): Promise<OffsetPage<AuditLogDto>> {
    const [rows, total] = await this.repository.listForTarget(AUDIT_TARGET.User, userId, {
      actions: options.actions,
      offset: options.offset,
      limit: options.limit,
    });
    return {
      items: rows.map(toAuditLogDto),
      meta: buildOffsetMeta(options.page, options.limit, total),
    };
  }

  /** Aggregate summary of a user's trail (counts by action + category). */
  async summaryForUser(userId: string): Promise<AuditSummaryDto> {
    const tallies = await this.repository.tallyByAction(AUDIT_TARGET.User, userId);
    const recent = await this.repository.recentForTarget(AUDIT_TARGET.User, userId, 1);

    const byAction: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalEvents = 0;
    for (const tally of tallies) {
      byAction[tally.action] = tally.count;
      const category = auditCategoryOf(tally.action);
      byCategory[category] = (byCategory[category] ?? 0) + tally.count;
      totalEvents += tally.count;
    }

    return {
      totalEvents,
      byAction,
      byCategory,
      lastActionAt: recent[0]?.createdAt.toISOString() ?? null,
    };
  }

  /** Most recent audit entries for a user (feeds the activity view). */
  async recentForUser(userId: string, limit: number): Promise<AuditLogDto[]> {
    const rows = await this.repository.recentForTarget(AUDIT_TARGET.User, userId, limit);
    return rows.map(toAuditLogDto);
  }

  /**
   * Most recent audit entries for any target type/id — used by the Moderation
   * module for a report's action history and an appeal's timeline (docs A5).
   */
  async recentForTarget(
    targetType: string,
    targetId: string,
    limit: number,
  ): Promise<AuditLogDto[]> {
    const rows = await this.repository.recentForTarget(targetType, targetId, limit);
    return rows.map(toAuditLogDto);
  }

  // ── Global admin audit browser (E12.7) ────────────────────────────────────────

  /** Filtered, offset-paginated global audit list (admin browser). */
  async adminList(filters: AuditAdminFilters, page: number): Promise<OffsetPage<AuditLogDto>> {
    const [rows, total] = await this.repository.adminList(filters);
    return { items: rows.map(toAuditLogDto), meta: buildOffsetMeta(page, filters.limit, total) };
  }

  /** One audit entry by id (null when absent). */
  async getById(id: string): Promise<AuditLogDto | null> {
    const row = await this.repository.findById(id);
    return row === null ? null : toAuditLogDto(row);
  }

  /** Global audit statistics — actions per window + top actions/actors. */
  async statistics(): Promise<AuditStatisticsDto> {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
    const [today, thisWeek, thisMonth, topActions, mostActiveActors] = await Promise.all([
      this.repository.countSince(startOfToday),
      this.repository.countSince(weekAgo),
      this.repository.countSince(monthAgo),
      this.repository.topActions(monthAgo, 10),
      this.repository.topActors(monthAgo, 10),
    ]);
    return { today, thisWeek, thisMonth, topActions, mostActiveActors };
  }

  /** Streams filtered audit rows in DTO batches for export. */
  async *exportStream(
    filters: AuditAdminFilters,
    batchSize: number,
  ): AsyncGenerator<AuditLogDto[]> {
    for await (const batch of this.repository.stream(filters, batchSize)) {
      yield batch.map(toAuditLogDto);
    }
  }
}

/** Maps a persisted row to its wire shape (never returns the entity raw). */
function toAuditLogDto(row: AuditLog): AuditLogDto {
  return {
    id: row.id,
    action: row.action,
    category: auditCategoryOf(row.action),
    actorId: row.actorId,
    actorRole: row.actorRole,
    targetId: row.targetId,
    targetType: row.targetType,
    metadata: row.metadata,
    ip: row.ip,
    requestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  };
}
