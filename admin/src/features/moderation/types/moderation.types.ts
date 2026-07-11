import type {
  AppealStatus,
  ReportEntityType,
  ReportPriority,
  ReportReason,
  ReportResolution,
  ReportSeverity,
  ReportStatus,
  Role,
} from '@qalam/shared';

/**
 * Wire types for the Content Moderation feature (A5), mirroring the backend
 * moderation DTOs (`backend/src/modules/moderation/dto/*`). Hand-authored until
 * `@qalam/api-types` is regenerated for the new endpoints —
 * TODO(aftab): drop for generated types once `openapi.json` includes them.
 */

/** One audit-trail entry — moderation/appeal history + timeline (backend AuditLogDto). */
export interface AuditEntry {
  id: string;
  action: string;
  category: string;
  actorId: string | null;
  actorRole: string | null;
  targetId: string | null;
  targetType: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface ReportedEntitySnapshot {
  type: ReportEntityType;
  id: string;
  exists: boolean;
  label: string | null;
  authorId: string | null;
}

/** A report in the queue (backend ReportDto). */
export interface Report {
  id: string;
  entityType: ReportEntityType;
  entityId: string;
  reportedUserId: string | null;
  reporterId: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  priority: ReportPriority;
  severity: ReportSeverity | null;
  assignedModeratorId: string | null;
  resolution: ReportResolution | null;
  resolutionReason: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  hasAppeal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportNote {
  id: string;
  reportId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Appeal {
  id: string;
  reportId: string;
  appellantId: string;
  reason: string;
  status: AppealStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Warning {
  id: string;
  userId: string;
  moderatorId: string;
  reportId: string | null;
  reason: string;
  severity: ReportSeverity;
  createdAt: string;
}

/** Full report detail (backend ReportDetailDto). */
export interface ReportDetail extends Report {
  entity: ReportedEntitySnapshot;
  notes: ReportNote[];
  appeal: Appeal | null;
  history: AuditEntry[];
}

/** Full appeal detail (backend AppealDetailDto). */
export interface AppealDetail extends Appeal {
  report: Report;
  timeline: AuditEntry[];
}

export interface BulkReportResult {
  action: string;
  requested: number;
  succeeded: string[];
  failed: Array<{ id: string; message: string }>;
}

/** A user who can be assigned a report (from `/admin/users?role=`). */
export interface Moderator {
  id: string;
  username: string;
  displayName: string | null;
  role: Role;
}

/** The bulk operations (map to POST /admin/reports/bulk-actions `action`). */
export type BulkReportAction = 'approve' | 'reject' | 'assign' | 'hide' | 'restore' | 'close';

/** Validated report-queue filters, string-coerced for the wire. */
export type ReportListParams = {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  priority?: string;
  severity?: string;
  reason?: string;
  assignedModeratorId?: string;
  reportedUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  sort?: string;
};

export type AppealListParams = {
  page?: number;
  limit?: number;
  status?: string;
  sort?: string;
};

export interface ResolvePayload {
  resolution: ReportResolution;
  reason?: string;
  severity?: ReportSeverity;
}

export interface BulkReportPayload {
  action: BulkReportAction;
  reportIds: string[];
  moderatorId?: string;
  reason?: string;
}
