import { Injectable } from '@nestjs/common';
import {
  AppealStatus,
  ReportEntityType,
  ReportResolution,
  ReportStatus,
  UserStatus,
} from '@qalam/shared';

import { buildOffsetMeta } from '../../common/pagination/pagination.helper';
import type { OffsetPage } from '../../common/types/paginated-result';
import { AuditService } from '../audit/audit.service';
import { CommentsService } from '../engagement/comments.service';
import { PiecesService } from '../pieces/pieces.service';
import { UsersService } from '../users/users.service';

import type { AppealFilterDto, CreateAppealDto, ReviewAppealDto } from './dto/appeal.dto';
import type { AppealDetailDto, AppealDto } from './dto/moderation-response.dto';
import type { Appeal } from './entities/appeal.entity';
import type { Report } from './entities/report.entity';
import {
  MODERATION_ACTIONS,
  MODERATION_HISTORY_LIMIT,
  MODERATION_TARGET,
} from './moderation.constants';
import {
  AppealAlreadyExistsException,
  AppealAlreadyReviewedException,
  AppealNotAllowedException,
  AppealNotFoundException,
  ReportNotFoundException,
} from './moderation.exceptions';
import { toAppealDto, toReportDto } from './moderation.mappers';
import { ModerationRepository } from './moderation.repository';
import type { ModerationActor } from './moderation.service';

/** Resolutions that impose something worth appealing. */
const PUNITIVE: ReadonlySet<ReportResolution> = new Set([
  ReportResolution.ContentHidden,
  ReportResolution.ContentRemoved,
  ReportResolution.UserWarned,
  ReportResolution.UserSuspended,
  ReportResolution.UserBanned,
]);

/**
 * Appeals against moderation decisions (A5). Users file an appeal against a
 * resolved report; a moderator/admin approves (restoring content/user via the
 * existing lifecycle) or rejects. Every review is recorded through `AuditService`.
 */
@Injectable()
export class AppealsService {
  constructor(
    private readonly repository: ModerationRepository,
    private readonly audit: AuditService,
    private readonly pieces: PiecesService,
    private readonly comments: CommentsService,
    private readonly users: UsersService,
  ) {}

  /** `POST /reports/:id/appeal` — the moderated subject contests the decision. */
  async createAppeal(
    reportId: string,
    appellantId: string,
    dto: CreateAppealDto,
  ): Promise<AppealDto> {
    const report = await this.loadReport(reportId);
    if (report.resolution === null || !PUNITIVE.has(report.resolution)) {
      throw new AppealNotAllowedException('There is no decision to appeal.');
    }
    if (report.reportedUserId !== appellantId) {
      throw new AppealNotAllowedException();
    }
    const existing = await this.repository.findAppealByReport(reportId);
    if (existing !== null) {
      throw new AppealAlreadyExistsException();
    }
    const appeal = await this.repository.createAppeal(reportId, appellantId, dto.reason);
    report.status = ReportStatus.Appealed;
    await this.repository.saveReport(report);
    return toAppealDto(appeal);
  }

  async listAppeals(filter: AppealFilterDto): Promise<OffsetPage<AppealDto>> {
    const { items, total } = await this.repository.listAppeals(filter);
    return {
      items: items.map(toAppealDto),
      meta: buildOffsetMeta(filter.page, filter.limit, total),
    };
  }

  async getAppeal(id: string): Promise<AppealDetailDto> {
    const appeal = await this.loadAppeal(id);
    const report = await this.loadReport(appeal.reportId);
    const [reportHistory, appealHistory] = await Promise.all([
      this.audit.recentForTarget(MODERATION_TARGET.Report, report.id, MODERATION_HISTORY_LIMIT),
      this.audit.recentForTarget(MODERATION_TARGET.Appeal, id, MODERATION_HISTORY_LIMIT),
    ]);
    const timeline = [...reportHistory, ...appealHistory].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return { ...toAppealDto(appeal), report: toReportDto(report, true), timeline };
  }

  async approve(id: string, dto: ReviewAppealDto, actor: ModerationActor): Promise<AppealDto> {
    const appeal = await this.reviewable(id);
    const report = await this.loadReport(appeal.reportId);
    await this.restoreForReport(report);

    report.status = ReportStatus.Resolved;
    await this.repository.saveReport(report);
    const saved = await this.finishReview(appeal, AppealStatus.Approved, dto.notes ?? null, actor);
    await this.record(actor, MODERATION_ACTIONS.AppealApprove, id, { reportId: report.id });
    return toAppealDto(saved);
  }

  async reject(id: string, dto: ReviewAppealDto, actor: ModerationActor): Promise<AppealDto> {
    const appeal = await this.reviewable(id);
    const report = await this.loadReport(appeal.reportId);
    report.status = ReportStatus.Resolved;
    await this.repository.saveReport(report);
    const saved = await this.finishReview(appeal, AppealStatus.Rejected, dto.notes ?? null, actor);
    await this.record(actor, MODERATION_ACTIONS.AppealReject, id, { reportId: report.id });
    return toAppealDto(saved);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async restoreForReport(report: Report): Promise<void> {
    const resolution = report.resolution;
    if (
      resolution === ReportResolution.ContentHidden ||
      resolution === ReportResolution.ContentRemoved
    ) {
      const isPieceLike =
        report.entityType === ReportEntityType.Piece ||
        report.entityType === ReportEntityType.Response;
      if (isPieceLike) await this.pieces.moderateRestore(report.entityId);
      else if (report.entityType === ReportEntityType.Comment)
        await this.comments.moderateRestore(report.entityId);
    } else if (
      (resolution === ReportResolution.UserSuspended ||
        resolution === ReportResolution.UserBanned) &&
      report.reportedUserId !== null
    ) {
      const user = await this.users.findById(report.reportedUserId);
      if (user !== null && user.status === UserStatus.Suspended) {
        await this.users.setStatus(report.reportedUserId, UserStatus.Active);
      }
    }
  }

  private async finishReview(
    appeal: Appeal,
    status: AppealStatus,
    notes: string | null,
    actor: ModerationActor,
  ): Promise<Appeal> {
    appeal.status = status;
    appeal.reviewedById = actor.id;
    appeal.reviewedAt = new Date();
    appeal.reviewNotes = notes;
    return this.repository.saveAppeal(appeal);
  }

  private async reviewable(id: string): Promise<Appeal> {
    const appeal = await this.loadAppeal(id);
    if (appeal.status !== AppealStatus.Pending) {
      throw new AppealAlreadyReviewedException();
    }
    return appeal;
  }

  private async loadAppeal(id: string): Promise<Appeal> {
    const appeal = await this.repository.findAppealById(id);
    if (appeal === null) {
      throw new AppealNotFoundException();
    }
    return appeal;
  }

  private async loadReport(id: string): Promise<Report> {
    const report = await this.repository.findReportById(id);
    if (report === null) {
      throw new ReportNotFoundException();
    }
    return report;
  }

  private async record(
    actor: ModerationActor,
    action: string,
    appealId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action,
      targetId: appealId,
      targetType: MODERATION_TARGET.Appeal,
      metadata,
      context: { ip: actor.ip, userAgent: actor.userAgent, requestId: actor.requestId },
    });
  }
}
