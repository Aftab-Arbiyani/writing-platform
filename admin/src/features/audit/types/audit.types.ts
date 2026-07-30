/**
 * Wire types for the Audit Logs feature (A6), mirroring the E12.7 backend DTOs
 * (`backend/src/modules/audit/dto/audit-log.dto.ts`). Hand-authored until
 * `@qalam/api-types` regenerates — TODO(aftab): drop for generated types.
 */

/** One audit-trail entry (backend AuditLogDto). */
export interface AuditLog {
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

export interface AuditActionCount {
  action: string;
  count: number;
}

export interface AuditActorCount {
  actorId: string;
  count: number;
}

/** Global audit statistics (backend AuditStatisticsDto). */
export interface AuditStatistics {
  today: number;
  thisWeek: number;
  thisMonth: number;
  topActions: AuditActionCount[];
  mostActiveActors: AuditActorCount[];
}

/** Validated audit-log filters, string-coerced for the wire. */
export type AuditListParams = {
  page?: number;
  limit?: number;
  action?: string;
  module?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  sort?: string;
};
