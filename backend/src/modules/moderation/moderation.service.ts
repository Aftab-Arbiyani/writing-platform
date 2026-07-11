import { Injectable } from '@nestjs/common';
import {
  ReportEntityType,
  ReportResolution,
  ReportStatus,
  ROLE_RANK,
  UserStatus,
  type Role,
} from '@qalam/shared';

import { buildOffsetMeta } from '../../common/pagination/pagination.helper';
import type { OffsetPage } from '../../common/types/paginated-result';
import { AuditService } from '../audit/audit.service';
import { CommentsService } from '../engagement/comments.service';
import { PiecesService } from '../pieces/pieces.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';

import type { CreateReportDto } from './dto/create-report.dto';
import type { ReportFilterDto } from './dto/report-filter.dto';
import type {
  AddNoteDto,
  AssignModeratorDto,
  BulkReportActionDto,
  ResolveReportDto,
  UpdatePriorityDto,
} from './dto/report-action.dto';
import type { WarnUserDto } from './dto/warn-user.dto';
import type {
  BulkReportResultDto,
  ReportDetailDto,
  ReportDto,
  ReportNoteDto,
  WarningDto,
} from './dto/moderation-response.dto';
import type {
  ReportStatisticsDto,
  ReportTimelineEntryDto,
  ReportTrendsDto,
} from './dto/report-stats.dto';
import type { Report } from './entities/report.entity';
import {
  MODERATION_ACTIONS,
  MODERATION_HISTORY_LIMIT,
  MODERATION_TARGET,
} from './moderation.constants';
import {
  ModerationForbiddenException,
  ReportAlreadyResolvedException,
  ReportDuplicateException,
  ReportInvalidResolutionException,
  ReportNotFoundException,
  ReportSelfException,
  ReportTargetNotFoundException,
} from './moderation.exceptions';
import { toReportDto, toReportNoteDto, toWarningDto } from './moderation.mappers';
import { ModerationRepository } from './moderation.repository';

/** The moderator/admin performing an action, plus request context for the audit trail. */
export interface ModerationActor {
  id: string;
  role: Role;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

type ContentAction = 'hide' | 'remove' | 'restore';

/**
 * Content Moderation (A5). Thin over existing domain services: take-down reuses
 * the piece/comment lifecycle, user actions reuse `UsersService`/`AuthService`,
 * and every moderation action is recorded through the shared `AuditService`
 * (never a second audit path). Owns only its four tables via the repository.
 */
@Injectable()
export class ModerationService {
  constructor(
    private readonly repository: ModerationRepository,
    private readonly audit: AuditService,
    private readonly pieces: PiecesService,
    private readonly comments: CommentsService,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  // ── User-facing report creation ──────────────────────────────────────────────

  /** `POST /reports` — an authenticated user reports content or a user. */
  async createReport(reporterId: string, dto: CreateReportDto): Promise<ReportDto> {
    const reportedUserId = await this.resolveReportedUser(dto.entityType, dto.entityId);
    if (reportedUserId === null) {
      throw new ReportTargetNotFoundException();
    }
    if (reportedUserId === reporterId) {
      throw new ReportSelfException();
    }
    const existing = await this.repository.findOpenReport(reporterId, dto.entityType, dto.entityId);
    if (existing !== null) {
      throw new ReportDuplicateException();
    }
    const report = await this.repository.createReport({
      reporterId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      reportedUserId,
      reason: dto.reason,
      description: dto.description ?? null,
    });
    return toReportDto(report, false);
  }

  // ── Admin queue + detail ─────────────────────────────────────────────────────

  async listReports(filter: ReportFilterDto): Promise<OffsetPage<ReportDto>> {
    const { items, total } = await this.repository.listReports(filter);
    return {
      items: items.map((report) => toReportDto(report, report.status === ReportStatus.Appealed)),
      meta: buildOffsetMeta(filter.page, filter.limit, total),
    };
  }

  async getReport(id: string): Promise<ReportDetailDto> {
    const report = await this.loadReport(id);
    const [notes, appeal, history, entity] = await Promise.all([
      this.repository.listNotes(id),
      this.repository.findAppealByReport(id),
      this.audit.recentForTarget(MODERATION_TARGET.Report, id, MODERATION_HISTORY_LIMIT),
      this.snapshot(report),
    ]);
    return {
      ...toReportDto(report, appeal !== null),
      entity,
      notes: notes.map(toReportNoteDto),
      appeal:
        appeal === null
          ? null
          : {
              id: appeal.id,
              reportId: appeal.reportId,
              appellantId: appeal.appellantId,
              reason: appeal.reason,
              status: appeal.status,
              reviewedById: appeal.reviewedById,
              reviewedAt: appeal.reviewedAt?.toISOString() ?? null,
              reviewNotes: appeal.reviewNotes,
              createdAt: appeal.createdAt.toISOString(),
              updatedAt: appeal.updatedAt.toISOString(),
            },
      history,
    };
  }

  // ── Triage actions ───────────────────────────────────────────────────────────

  async assign(id: string, dto: AssignModeratorDto, actor: ModerationActor): Promise<ReportDto> {
    const report = await this.loadReport(id);
    report.assignedModeratorId = dto.moderatorId;
    if (report.status === ReportStatus.Pending) {
      report.status = ReportStatus.Reviewing;
    }
    const saved = await this.repository.saveReport(report);
    await this.record(actor, MODERATION_ACTIONS.ReportAssign, id, {
      moderatorId: dto.moderatorId,
    });
    return toReportDto(saved, false);
  }

  async setPriority(
    id: string,
    dto: UpdatePriorityDto,
    actor: ModerationActor,
  ): Promise<ReportDto> {
    const report = await this.loadReport(id);
    const previous = report.priority;
    report.priority = dto.priority;
    const saved = await this.repository.saveReport(report);
    await this.record(actor, MODERATION_ACTIONS.ReportPriority, id, {
      previous,
      current: dto.priority,
    });
    return toReportDto(saved, false);
  }

  async escalate(id: string, actor: ModerationActor): Promise<ReportDto> {
    const report = await this.loadReport(id);
    report.priority = 'urgent';
    if (report.status === ReportStatus.Pending) {
      report.status = ReportStatus.Reviewing;
    }
    const saved = await this.repository.saveReport(report);
    await this.record(actor, MODERATION_ACTIONS.ReportEscalate, id, {});
    return toReportDto(saved, false);
  }

  async addNote(id: string, dto: AddNoteDto, actor: ModerationActor): Promise<ReportNoteDto> {
    await this.loadReport(id);
    const note = await this.repository.addNote(id, actor.id, dto.body);
    await this.record(actor, MODERATION_ACTIONS.ReportNote, id, {});
    return toReportNoteDto(note);
  }

  // ── Resolution (drives content/user action) ──────────────────────────────────

  async resolve(id: string, dto: ResolveReportDto, actor: ModerationActor): Promise<ReportDto> {
    const report = await this.loadReport(id);
    if (
      report.status === ReportStatus.Resolved ||
      report.status === ReportStatus.Dismissed ||
      report.status === ReportStatus.Appealed
    ) {
      // An appealed report moves only via the appeal approve/reject flow.
      throw new ReportAlreadyResolvedException();
    }
    await this.applyResolution(report, dto.resolution, dto.reason, actor);

    report.status =
      dto.resolution === ReportResolution.Dismissed
        ? ReportStatus.Dismissed
        : ReportStatus.Resolved;
    report.resolution = dto.resolution;
    report.resolutionReason = dto.reason ?? null;
    report.resolvedById = actor.id;
    report.resolvedAt = new Date();
    if (dto.severity !== undefined) {
      report.severity = dto.severity;
    }
    const saved = await this.repository.saveReport(report);
    await this.record(actor, MODERATION_ACTIONS.ReportResolve, id, {
      resolution: dto.resolution,
      reason: dto.reason ?? null,
    });
    return toReportDto(saved, false);
  }

  private async applyResolution(
    report: Report,
    resolution: ReportResolution,
    reason: string | undefined,
    actor: ModerationActor,
  ): Promise<void> {
    switch (resolution) {
      case ReportResolution.NoAction:
      case ReportResolution.Dismissed:
        return;
      case ReportResolution.ContentHidden:
        await this.applyContentAction(report, 'hide', actor);
        return;
      case ReportResolution.ContentRemoved:
        await this.applyContentAction(report, 'remove', actor);
        return;
      case ReportResolution.UserWarned:
        await this.issueWarning(
          this.requireReportedUser(report),
          actor,
          reason ?? 'Policy violation.',
          report.id,
        );
        return;
      case ReportResolution.UserSuspended:
        this.assertCanSuspend(actor);
        await this.suspendUser(this.requireReportedUser(report), actor);
        return;
      case ReportResolution.UserBanned:
        this.assertCanSuspend(actor);
        await this.suspendUser(this.requireReportedUser(report), actor, true);
        return;
      default:
        throw new ReportInvalidResolutionException();
    }
  }

  private async applyContentAction(
    report: Report,
    action: ContentAction,
    actor: ModerationActor,
  ): Promise<void> {
    const isPieceLike =
      report.entityType === ReportEntityType.Piece ||
      report.entityType === ReportEntityType.Response;
    if (isPieceLike) {
      if (action === 'hide') await this.pieces.moderateHide(report.entityId);
      else if (action === 'remove') await this.pieces.moderateRemove(report.entityId);
      else await this.pieces.moderateRestore(report.entityId);
    } else if (report.entityType === ReportEntityType.Comment) {
      if (action === 'restore') await this.comments.moderateRestore(report.entityId);
      else await this.comments.delete(report.entityId, actor.id, actor.role);
    } else {
      throw new ReportInvalidResolutionException('Content actions do not apply to a user report.');
    }
    const auditAction =
      action === 'hide'
        ? MODERATION_ACTIONS.ContentHide
        : action === 'remove'
          ? MODERATION_ACTIONS.ContentRemove
          : MODERATION_ACTIONS.ContentRestore;
    await this.record(
      actor,
      auditAction,
      report.entityId,
      { reportId: report.id, entityType: report.entityType },
      report.entityType,
    );
  }

  private async suspendUser(
    userId: string,
    actor: ModerationActor,
    permanent = false,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new ReportTargetNotFoundException();
    }
    if (user.status !== UserStatus.Suspended) {
      await this.users.setStatus(userId, UserStatus.Suspended);
    }
    await this.auth.logoutAll(userId, { ip: actor.ip ?? '', device: 'moderation' });
    await this.record(
      actor,
      permanent ? MODERATION_ACTIONS.UserBan : MODERATION_ACTIONS.UserSuspend,
      userId,
      { permanent },
    );
  }

  // ── Warnings ───────────────────────────────────────────────────────────────

  /** `POST /admin/users/:id/warn`. */
  async warnUser(userId: string, dto: WarnUserDto, actor: ModerationActor): Promise<WarningDto> {
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new ReportTargetNotFoundException();
    }
    return this.issueWarning(userId, actor, dto.reason, dto.reportId ?? null, dto.severity);
  }

  async listWarnings(userId: string): Promise<WarningDto[]> {
    const warnings = await this.repository.listWarnings(userId);
    return warnings.map(toWarningDto);
  }

  private async issueWarning(
    userId: string,
    actor: ModerationActor,
    reason: string,
    reportId: string | null,
    severity: WarnUserDto['severity'] = 'low',
  ): Promise<WarningDto> {
    const warning = await this.repository.createWarning({
      userId,
      moderatorId: actor.id,
      reportId,
      reason,
      severity: severity ?? 'low',
    });
    await this.record(actor, MODERATION_ACTIONS.UserWarn, userId, { reportId, severity });
    return toWarningDto(warning);
  }

  // ── Bulk ───────────────────────────────────────────────────────────────────

  async bulk(dto: BulkReportActionDto, actor: ModerationActor): Promise<BulkReportResultDto> {
    const reports = await this.repository.findReportsByIds(dto.reportIds);
    const found = new Map(reports.map((report) => [report.id, report]));
    const succeeded: string[] = [];
    const failed: { id: string; message: string }[] = [];

    for (const id of dto.reportIds) {
      const report = found.get(id);
      if (report === undefined) {
        failed.push({ id, message: 'Report not found.' });
        continue;
      }
      try {
        await this.applyBulk(report, dto, actor);
        succeeded.push(id);
      } catch (error) {
        failed.push({ id, message: error instanceof Error ? error.message : 'Failed.' });
      }
    }
    await this.record(actor, MODERATION_ACTIONS.ReportBulk, null, {
      action: dto.action,
      requested: dto.reportIds.length,
      succeeded: succeeded.length,
      failed: failed.length,
    });
    return { action: dto.action, requested: dto.reportIds.length, succeeded, failed };
  }

  private async applyBulk(
    report: Report,
    dto: BulkReportActionDto,
    actor: ModerationActor,
  ): Promise<void> {
    switch (dto.action) {
      case 'assign':
        if (dto.moderatorId === undefined) {
          throw new ReportInvalidResolutionException('assign requires a moderatorId.');
        }
        await this.assign(report.id, { moderatorId: dto.moderatorId }, actor);
        return;
      case 'hide':
        await this.resolve(
          report.id,
          { resolution: ReportResolution.ContentHidden, reason: dto.reason },
          actor,
        );
        return;
      case 'restore':
        await this.applyContentAction(report, 'restore', actor);
        return;
      case 'reject':
        await this.resolve(
          report.id,
          { resolution: ReportResolution.Dismissed, reason: dto.reason },
          actor,
        );
        return;
      case 'approve':
      case 'close':
        await this.resolve(
          report.id,
          { resolution: ReportResolution.NoAction, reason: dto.reason },
          actor,
        );
        return;
      default:
        throw new ReportInvalidResolutionException('Unknown bulk action.');
    }
  }

  // ── Report actions: reopen + note edit/delete (E12.7) ─────────────────────────

  /** Reopens a resolved/dismissed report for re-review (clears the resolution). */
  async reopenReport(id: string, actor: ModerationActor): Promise<ReportDto> {
    const report = await this.loadReport(id);
    if (report.status !== ReportStatus.Resolved && report.status !== ReportStatus.Dismissed) {
      throw new ReportInvalidResolutionException(
        'Only a resolved or dismissed report can be reopened.',
      );
    }
    report.status = ReportStatus.Reviewing;
    report.resolution = null;
    report.resolutionReason = null;
    report.resolvedById = null;
    report.resolvedAt = null;
    const saved = await this.repository.saveReport(report);
    await this.record(actor, MODERATION_ACTIONS.ReportReopen, id, {});
    return toReportDto(saved, false);
  }

  async updateNote(
    reportId: string,
    noteId: string,
    body: string,
    actor: ModerationActor,
  ): Promise<ReportNoteDto> {
    const note = await this.loadNote(reportId, noteId);
    await this.repository.updateNote(noteId, body);
    await this.record(actor, MODERATION_ACTIONS.ReportNote, reportId, { noteId, updated: true });
    note.body = body;
    return toReportNoteDto(note);
  }

  async deleteNote(reportId: string, noteId: string, actor: ModerationActor): Promise<void> {
    await this.loadNote(reportId, noteId);
    await this.repository.deleteNote(noteId);
    await this.record(actor, MODERATION_ACTIONS.ReportNote, reportId, { noteId, deleted: true });
  }

  // ── Reporting: timeline + statistics + trends + export (E12.7) ─────────────────

  /** Chronological timeline (moderation actions + appeal events + notes), newest first. */
  async getTimeline(id: string): Promise<ReportTimelineEntryDto[]> {
    await this.loadReport(id); // 404 if the report doesn't exist
    const [reportHistory, notes, appeal] = await Promise.all([
      this.audit.recentForTarget(MODERATION_TARGET.Report, id, 100),
      this.repository.listNotes(id),
      this.repository.findAppealByReport(id),
    ]);
    const appealHistory =
      appeal === null
        ? []
        : await this.audit.recentForTarget(MODERATION_TARGET.Appeal, appeal.id, 100);

    const entries: ReportTimelineEntryDto[] = [];
    for (const event of [...reportHistory, ...appealHistory]) {
      entries.push({
        kind: 'action',
        at: event.createdAt,
        action: event.action,
        category: event.category,
        actorId: event.actorId,
        actorRole: event.actorRole,
        body: null,
        auditRef: event.id,
        metadata: event.metadata,
      });
    }
    for (const note of notes) {
      entries.push({
        kind: 'note',
        at: note.createdAt.toISOString(),
        action: null,
        category: null,
        actorId: note.authorId,
        actorRole: null,
        body: note.body,
        auditRef: null,
        metadata: {},
      });
    }
    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }

  async getStatistics(): Promise<ReportStatisticsDto> {
    const [byStatus, byCategory, bySeverity, avgResolutionSeconds, moderatorPerformance] =
      await Promise.all([
        this.repository.countByStatus(),
        this.repository.countByReason(),
        this.repository.countBySeverity(),
        this.repository.avgResolutionSeconds(),
        this.repository.moderatorPerformance(),
      ]);
    const openReports =
      (byStatus[ReportStatus.Pending] ?? 0) +
      (byStatus[ReportStatus.Reviewing] ?? 0) +
      (byStatus[ReportStatus.Appealed] ?? 0);
    return {
      openReports,
      resolvedReports: byStatus[ReportStatus.Resolved] ?? 0,
      dismissedReports: byStatus[ReportStatus.Dismissed] ?? 0,
      avgResolutionSeconds,
      byStatus,
      byCategory,
      bySeverity,
      moderatorPerformance,
    };
  }

  async getTrends(dateFrom: string, dateTo: string): Promise<ReportTrendsDto> {
    const points = await this.repository.trends(dateFrom, dateTo);
    return { from: dateFrom, to: dateTo, points };
  }

  /** Streams the filtered report set in DTO batches for export. */
  async *streamReports(filter: ReportFilterDto, batchSize: number): AsyncGenerator<ReportDto[]> {
    for await (const batch of this.repository.streamReports(filter, batchSize)) {
      yield batch.map((report) => toReportDto(report, report.status === ReportStatus.Appealed));
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async loadNote(reportId: string, noteId: string) {
    const note = await this.repository.findNote(noteId);
    if (note === null || note.reportId !== reportId) {
      throw new ReportNotFoundException();
    }
    return note;
  }

  private async loadReport(id: string): Promise<Report> {
    const report = await this.repository.findReportById(id);
    if (report === null) {
      throw new ReportNotFoundException();
    }
    return report;
  }

  private requireReportedUser(report: Report): string {
    if (report.reportedUserId === null) {
      throw new ReportInvalidResolutionException('No offending user is attached to this report.');
    }
    return report.reportedUserId;
  }

  private assertCanSuspend(actor: ModerationActor): void {
    if (ROLE_RANK[actor.role] < ROLE_RANK.admin) {
      throw new ModerationForbiddenException(
        'Suspending or banning a user requires admin privileges.',
      );
    }
  }

  private async resolveReportedUser(
    entityType: ReportEntityType,
    entityId: string,
  ): Promise<string | null> {
    if (entityType === ReportEntityType.Piece || entityType === ReportEntityType.Response) {
      return this.pieces.findAuthorId(entityId);
    }
    if (entityType === ReportEntityType.Comment) {
      return this.comments.findAuthorId(entityId);
    }
    const user = await this.users.findById(entityId);
    return user?.id ?? null;
  }

  private async snapshot(report: Report): Promise<ReportDetailDto['entity']> {
    if (report.entityType === ReportEntityType.User) {
      const user = await this.users.findById(report.entityId);
      return {
        type: report.entityType,
        id: report.entityId,
        exists: user !== null,
        label: user?.username ?? null,
        authorId: user?.id ?? null,
      };
    }
    const authorId = await this.resolveReportedUser(report.entityType, report.entityId);
    return {
      type: report.entityType,
      id: report.entityId,
      exists: authorId !== null,
      label: null,
      authorId,
    };
  }

  private async record(
    actor: ModerationActor,
    action: string,
    targetId: string | null,
    metadata: Record<string, unknown>,
    targetType?: string,
  ): Promise<void> {
    const resolvedType =
      targetType ??
      (action.startsWith('report.') || action === MODERATION_ACTIONS.ReportBulk
        ? MODERATION_TARGET.Report
        : action.startsWith('content.')
          ? MODERATION_TARGET.Piece
          : MODERATION_TARGET.User);
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action,
      targetId,
      targetType: resolvedType,
      metadata,
      context: { ip: actor.ip, userAgent: actor.userAgent, requestId: actor.requestId },
    });
  }
}
