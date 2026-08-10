import type { ReportEntityType, ReportPriority, ReportReason, ReportStatus } from '@qalam/shared';

/**
 * Reporting (W7b, docs/45 §4.4) — the wire shapes of `POST /reports`.
 *
 * **One surface, four entity types.** `ReportEntityType` covers piece, comment, response AND user,
 * and mobile learned in M7 to build ONE generalized report sheet rather than four bespoke dialogs.
 * Web does the same: one component, parameterised, mounted in four places.
 *
 * App level (docs/26 §4) because those four mount points span three features — the reader
 * (`features/reading`), the conversation surfaces W7a shipped at app level, and the profile
 * (`features/profile`).
 */

/** `CreateReportDto`. `description` is capped at 1000 chars and recommended for `other`. */
export interface CreateReportInput {
  entityType: ReportEntityType;
  entityId: string;
  reason: ReportReason;
  description?: string;
}

/**
 * `ReportDto` as the reporter's client needs it.
 *
 * Only the fields a *reporter* may act on are modelled. The moderator-facing half of the DTO
 * (`assignedModeratorId`, `resolution`, `resolutionReason`, `resolvedById`, `severity`,
 * `reportedUserId`, `hasAppeal`) is deliberately absent: it belongs to the moderation queue, which
 * is the A-track, and `POST /reports/:id/appeal` is out of W7b's scope entirely.
 */
export interface Report {
  id: string;
  entityType: ReportEntityType;
  entityId: string;
  reason: ReportReason;
  description: string | null;
  /**
   * Always `pending` on creation. Surfaced so the confirmation can be honest: a report has been
   * SUBMITTED, not resolved.
   */
  status: ReportStatus;
  priority: ReportPriority;
  createdAt: string;
}
