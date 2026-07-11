import type {
  AppealDto,
  ReportDto,
  ReportNoteDto,
  WarningDto,
} from './dto/moderation-response.dto';
import type { Appeal } from './entities/appeal.entity';
import type { ReportNote } from './entities/report-note.entity';
import type { Report } from './entities/report.entity';
import type { UserWarning } from './entities/user-warning.entity';

/** Maps a report row to its wire shape (never returns the entity raw). */
export function toReportDto(report: Report, hasAppeal: boolean): ReportDto {
  return {
    id: report.id,
    entityType: report.entityType,
    entityId: report.entityId,
    reportedUserId: report.reportedUserId,
    reporterId: report.reporterId,
    reason: report.reason,
    description: report.description,
    status: report.status,
    priority: report.priority,
    severity: report.severity,
    assignedModeratorId: report.assignedModeratorId,
    resolution: report.resolution,
    resolutionReason: report.resolutionReason,
    resolvedById: report.resolvedById,
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
    hasAppeal,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

export function toReportNoteDto(note: ReportNote): ReportNoteDto {
  return {
    id: note.id,
    reportId: note.reportId,
    authorId: note.authorId,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
  };
}

export function toAppealDto(appeal: Appeal): AppealDto {
  return {
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
  };
}

export function toWarningDto(warning: UserWarning): WarningDto {
  return {
    id: warning.id,
    userId: warning.userId,
    moderatorId: warning.moderatorId,
    reportId: warning.reportId,
    reason: warning.reason,
    severity: warning.severity,
    createdAt: warning.createdAt.toISOString(),
  };
}
