import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReportStatus } from '@qalam/shared';
import type { ReportEntityType, ReportReason } from '@qalam/shared';
import { In, Repository } from 'typeorm';
import type { SelectQueryBuilder } from 'typeorm';

import type { AppealFilterDto } from './dto/appeal.dto';
import type { ReportFilterDto } from './dto/report-filter.dto';
import { Appeal } from './entities/appeal.entity';
import { ReportNote } from './entities/report-note.entity';
import { Report } from './entities/report.entity';
import { UserWarning } from './entities/user-warning.entity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Semantic ordering for the enum-ish columns (alpha order would be wrong). */
const PRIORITY_ORDER =
  "CASE report.priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 WHEN 'low' THEN 1 ELSE 0 END";
const SEVERITY_ORDER =
  "CASE report.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END";

const REPORT_SORT: Record<string, string> = {
  createdAt: 'report.created_at',
  updatedAt: 'report.updated_at',
  status: 'report.status',
  priority: PRIORITY_ORDER,
  severity: SEVERITY_ORDER,
};

export interface NewReport {
  reporterId: string;
  entityType: ReportEntityType;
  entityId: string;
  reportedUserId: string | null;
  reason: ReportReason;
  description: string | null;
}

/**
 * Persistence for the Moderation module's aggregates (`reports`, `report_notes`,
 * `appeals`, `user_warnings`). The only layer that builds query builders (docs 16
 * §3.3). Offset pagination for the admin queues (docs 05 §5.2). No cross-module
 * entity access — content/user data is fetched by the service via exported services.
 */
@Injectable()
export class ModerationRepository {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(ReportNote) private readonly notes: Repository<ReportNote>,
    @InjectRepository(Appeal) private readonly appeals: Repository<Appeal>,
    @InjectRepository(UserWarning) private readonly warnings: Repository<UserWarning>,
  ) {}

  // ── Reports ────────────────────────────────────────────────────────────────

  createReport(input: NewReport): Promise<Report> {
    return this.reports.save(this.reports.create(input));
  }

  findReportById(id: string): Promise<Report | null> {
    return this.reports.findOne({ where: { id } });
  }

  findReportsByIds(ids: string[]): Promise<Report[]> {
    return this.reports.find({ where: { id: In(ids) } });
  }

  /** An existing non-terminal report by the same reporter for the same entity (dedup). */
  findOpenReport(
    reporterId: string,
    entityType: ReportEntityType,
    entityId: string,
  ): Promise<Report | null> {
    return this.reports.findOne({
      where: [
        { reporterId, entityType, entityId, status: ReportStatus.Pending },
        { reporterId, entityType, entityId, status: ReportStatus.Reviewing },
      ],
    });
  }

  saveReport(report: Report): Promise<Report> {
    return this.reports.save(report);
  }

  /** Builds the filtered (unsorted, unpaged) report query — shared by list + export. */
  private reportQuery(filter: ReportFilterDto): SelectQueryBuilder<Report> {
    const qb = this.reports.createQueryBuilder('report');

    if (filter.type) qb.andWhere('report.entity_type = :type', { type: filter.type });
    if (filter.status) qb.andWhere('report.status = :status', { status: filter.status });
    if (filter.priority) qb.andWhere('report.priority = :priority', { priority: filter.priority });
    if (filter.severity) qb.andWhere('report.severity = :severity', { severity: filter.severity });
    if (filter.reason) qb.andWhere('report.reason = :reason', { reason: filter.reason });
    if (filter.assignedModeratorId)
      qb.andWhere('report.assigned_moderator_id = :assignee', {
        assignee: filter.assignedModeratorId,
      });
    if (filter.reportedUserId)
      qb.andWhere('report.reported_user_id = :reportedUser', {
        reportedUser: filter.reportedUserId,
      });
    if (filter.dateFrom)
      qb.andWhere('report.created_at >= :dateFrom', { dateFrom: filter.dateFrom });
    if (filter.dateTo) qb.andWhere('report.created_at <= :dateTo', { dateTo: filter.dateTo });
    if (filter.q) {
      if (UUID_RE.test(filter.q)) {
        qb.andWhere(
          '(report.reporter_id = :q OR report.entity_id = :q OR report.reported_user_id = :q)',
          { q: filter.q },
        );
      } else {
        qb.andWhere('report.description ILIKE :like', { like: `%${filter.q}%` });
      }
    }
    return qb;
  }

  async listReports(filter: ReportFilterDto): Promise<{ items: Report[]; total: number }> {
    const qb = this.reportQuery(filter);
    this.applySort(qb, filter.sort);
    qb.skip(filter.offset).take(filter.limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /** Streams the FILTERED report set in batches for export (no pager, E12.7). */
  async *streamReports(filter: ReportFilterDto, batchSize: number): AsyncGenerator<Report[]> {
    let offset = 0;
    for (;;) {
      const qb = this.reportQuery(filter);
      this.applySort(qb, filter.sort);
      const rows = await qb.skip(offset).take(batchSize).getMany();
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

  private applySort(qb: SelectQueryBuilder<Report>, sort: string | undefined): void {
    const token = sort ?? '-createdAt';
    const desc = token.startsWith('-');
    const field = desc ? token.slice(1) : token;
    const expr = REPORT_SORT[field] ?? 'report.created_at';
    qb.orderBy(expr, desc ? 'DESC' : 'ASC').addOrderBy('report.id', 'DESC');
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  addNote(reportId: string, authorId: string, body: string): Promise<ReportNote> {
    return this.notes.save(this.notes.create({ reportId, authorId, body }));
  }

  listNotes(reportId: string): Promise<ReportNote[]> {
    return this.notes.find({ where: { reportId }, order: { createdAt: 'ASC' } });
  }

  findNote(noteId: string): Promise<ReportNote | null> {
    return this.notes.findOne({ where: { id: noteId } });
  }

  async updateNote(noteId: string, body: string): Promise<void> {
    await this.notes.update({ id: noteId }, { body });
  }

  async deleteNote(noteId: string): Promise<void> {
    await this.notes.delete({ id: noteId });
  }

  // ── Appeals ────────────────────────────────────────────────────────────────

  createAppeal(reportId: string, appellantId: string, reason: string): Promise<Appeal> {
    return this.appeals.save(this.appeals.create({ reportId, appellantId, reason }));
  }

  findAppealById(id: string): Promise<Appeal | null> {
    return this.appeals.findOne({ where: { id } });
  }

  findAppealByReport(reportId: string): Promise<Appeal | null> {
    return this.appeals.findOne({ where: { reportId } });
  }

  saveAppeal(appeal: Appeal): Promise<Appeal> {
    return this.appeals.save(appeal);
  }

  async listAppeals(filter: AppealFilterDto): Promise<{ items: Appeal[]; total: number }> {
    const qb = this.appeals.createQueryBuilder('appeal');
    if (filter.status) qb.andWhere('appeal.status = :status', { status: filter.status });
    const token = filter.sort ?? '-createdAt';
    const desc = token.startsWith('-');
    qb.orderBy('appeal.created_at', desc ? 'DESC' : 'ASC').addOrderBy('appeal.id', 'DESC');
    qb.skip(filter.offset).take(filter.limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ── Warnings ─────────────────────────────────────────────────────────────────

  createWarning(input: {
    userId: string;
    moderatorId: string;
    reportId: string | null;
    reason: string;
    severity: UserWarning['severity'];
  }): Promise<UserWarning> {
    return this.warnings.save(this.warnings.create(input));
  }

  listWarnings(userId: string): Promise<UserWarning[]> {
    return this.warnings.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  countWarnings(userId: string): Promise<number> {
    return this.warnings.count({ where: { userId } });
  }

  // ── Statistics / trends (admin reporting, E12.7) ──────────────────────────────

  /** Grouped counts over a fixed, safe column (status | severity | reason). */
  private async groupCount(
    column: 'status' | 'severity' | 'reason',
  ): Promise<Record<string, number>> {
    const rows = await this.reports
      .createQueryBuilder('report')
      .select(`report.${column}`, 'key')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`report.${column}`)
      .getRawMany<{ key: string | null; count: string }>();
    const out: Record<string, number> = {};
    for (const row of rows) {
      if (row.key !== null) {
        out[row.key] = Number(row.count);
      }
    }
    return out;
  }

  countByStatus(): Promise<Record<string, number>> {
    return this.groupCount('status');
  }
  countBySeverity(): Promise<Record<string, number>> {
    return this.groupCount('severity');
  }
  countByReason(): Promise<Record<string, number>> {
    return this.groupCount('reason');
  }

  /** Mean seconds between report creation and resolution (null when none resolved). */
  async avgResolutionSeconds(): Promise<number | null> {
    const row = await this.reports
      .createQueryBuilder('report')
      .select('AVG(EXTRACT(EPOCH FROM (report.resolved_at - report.created_at)))', 'avg')
      .where('report.resolved_at IS NOT NULL')
      .getRawOne<{ avg: string | null }>();
    return row?.avg != null ? Number(row.avg) : null;
  }

  /** Per-moderator resolved count + mean resolution time (moderator performance). */
  async moderatorPerformance(): Promise<
    Array<{ moderatorId: string; resolved: number; avgSeconds: number | null }>
  > {
    const rows = await this.reports
      .createQueryBuilder('report')
      .select('report.resolved_by_id', 'moderatorId')
      .addSelect('COUNT(*)', 'resolved')
      .addSelect('AVG(EXTRACT(EPOCH FROM (report.resolved_at - report.created_at)))', 'avgSeconds')
      .where('report.resolved_by_id IS NOT NULL')
      .groupBy('report.resolved_by_id')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<{ moderatorId: string; resolved: string; avgSeconds: string | null }>();
    return rows.map((row) => ({
      moderatorId: row.moderatorId,
      resolved: Number(row.resolved),
      avgSeconds: row.avgSeconds != null ? Number(row.avgSeconds) : null,
    }));
  }

  /** Per-day created + resolved counts over a date window (report trends). */
  async trends(
    dateFrom: string,
    dateTo: string,
  ): Promise<Array<{ date: string; created: number; resolved: number }>> {
    const created = await this.reports
      .createQueryBuilder('report')
      .select("to_char(date_trunc('day', report.created_at), 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('report.created_at >= :from AND report.created_at <= :to', {
        from: dateFrom,
        to: dateTo,
      })
      .groupBy("date_trunc('day', report.created_at)")
      .getRawMany<{ date: string; count: string }>();
    const resolved = await this.reports
      .createQueryBuilder('report')
      .select("to_char(date_trunc('day', report.resolved_at), 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('report.resolved_at >= :from AND report.resolved_at <= :to', {
        from: dateFrom,
        to: dateTo,
      })
      .groupBy("date_trunc('day', report.resolved_at)")
      .getRawMany<{ date: string; count: string }>();

    const merged = new Map<string, { created: number; resolved: number }>();
    for (const row of created) {
      merged.set(row.date, { created: Number(row.count), resolved: 0 });
    }
    for (const row of resolved) {
      const entry = merged.get(row.date) ?? { created: 0, resolved: 0 };
      entry.resolved = Number(row.count);
      merged.set(row.date, entry);
    }
    return [...merged.entries()]
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
