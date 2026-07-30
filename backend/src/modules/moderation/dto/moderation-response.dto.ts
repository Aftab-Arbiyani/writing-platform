import { ApiProperty } from '@nestjs/swagger';
import type {
  AppealStatus,
  ReportEntityType,
  ReportPriority,
  ReportReason,
  ReportResolution,
  ReportSeverity,
  ReportStatus,
} from '@qalam/shared';

import { AuditLogDto } from '../../audit/dto/audit-log.dto';

/** A minimal snapshot of the reported entity, so a moderator can triage in place. */
export class ReportedEntitySnapshotDto {
  @ApiProperty() type!: ReportEntityType;
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'False when the target has since been deleted.' })
  exists!: boolean;
  @ApiProperty({ nullable: true, description: 'Title / username / comment excerpt.' })
  label!: string | null;
  @ApiProperty({ nullable: true }) authorId!: string | null;
}

/** A report as it appears in the queue. */
export class ReportDto {
  @ApiProperty() id!: string;
  @ApiProperty() entityType!: ReportEntityType;
  @ApiProperty() entityId!: string;
  @ApiProperty({ nullable: true }) reportedUserId!: string | null;
  @ApiProperty() reporterId!: string;
  @ApiProperty() reason!: ReportReason;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() status!: ReportStatus;
  @ApiProperty() priority!: ReportPriority;
  @ApiProperty({ nullable: true }) severity!: ReportSeverity | null;
  @ApiProperty({ nullable: true }) assignedModeratorId!: string | null;
  @ApiProperty({ nullable: true }) resolution!: ReportResolution | null;
  @ApiProperty({ nullable: true }) resolutionReason!: string | null;
  @ApiProperty({ nullable: true }) resolvedById!: string | null;
  @ApiProperty({ nullable: true }) resolvedAt!: string | null;
  @ApiProperty() hasAppeal!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

/** An internal moderator note. */
export class ReportNoteDto {
  @ApiProperty() id!: string;
  @ApiProperty() reportId!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() body!: string;
  @ApiProperty() createdAt!: string;
}

/** An appeal against a moderation decision. */
export class AppealDto {
  @ApiProperty() id!: string;
  @ApiProperty() reportId!: string;
  @ApiProperty() appellantId!: string;
  @ApiProperty() reason!: string;
  @ApiProperty() status!: AppealStatus;
  @ApiProperty({ nullable: true }) reviewedById!: string | null;
  @ApiProperty({ nullable: true }) reviewedAt!: string | null;
  @ApiProperty({ nullable: true }) reviewNotes!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

/** A user warning. */
export class WarningDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() moderatorId!: string;
  @ApiProperty({ nullable: true }) reportId!: string | null;
  @ApiProperty() reason!: string;
  @ApiProperty() severity!: ReportSeverity;
  @ApiProperty() createdAt!: string;
}

/** One id that a bulk action could not be applied to. */
export class BulkReportFailureDto {
  @ApiProperty() id!: string;
  @ApiProperty() message!: string;
}

/** Outcome of `POST /admin/reports/bulk-actions`. */
export class BulkReportResultDto {
  @ApiProperty() action!: string;
  @ApiProperty() requested!: number;
  @ApiProperty({ type: [String] }) succeeded!: string[];
  @ApiProperty({ type: [BulkReportFailureDto] }) failed!: BulkReportFailureDto[];
}

/** Full report detail — the drawer view. */
export class ReportDetailDto extends ReportDto {
  @ApiProperty({ type: ReportedEntitySnapshotDto })
  entity!: ReportedEntitySnapshotDto;

  @ApiProperty({ type: [ReportNoteDto] })
  notes!: ReportNoteDto[];

  @ApiProperty({ type: AppealDto, nullable: true })
  appeal!: AppealDto | null;

  @ApiProperty({ type: [AuditLogDto], description: 'Moderation actions taken on this report.' })
  history!: AuditLogDto[];
}

/** Full appeal detail — the appeal drawer view. */
export class AppealDetailDto extends AppealDto {
  @ApiProperty({ type: ReportDto })
  report!: ReportDto;

  @ApiProperty({ type: [AuditLogDto], description: 'Timeline of moderation + appeal events.' })
  timeline!: AuditLogDto[];
}
