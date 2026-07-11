/**
 * Moderation audit vocabulary — dot-cased `target.verb` action codes recorded in
 * `audit_logs` via `AuditService.record()` (reused from E12.5). `auditCategoryOf`
 * buckets unknown actions as "administrative", which is correct for these.
 */
export const MODERATION_TARGET = {
  Report: 'report',
  Appeal: 'appeal',
  Piece: 'piece',
  Comment: 'comment',
  User: 'user',
} as const;

export const MODERATION_ACTIONS = {
  ReportResolve: 'report.resolve',
  ReportAssign: 'report.assign',
  ReportPriority: 'report.priority',
  ReportEscalate: 'report.escalate',
  ReportNote: 'report.note',
  ReportBulk: 'report.bulk_action',
  ContentHide: 'content.hide',
  ContentRemove: 'content.remove',
  ContentRestore: 'content.restore',
  UserWarn: 'user.warn',
  UserSuspend: 'user.suspend',
  UserBan: 'user.ban',
  AppealApprove: 'appeal.approve',
  AppealReject: 'appeal.reject',
} as const;

/** How many report/appeal history rows to surface in a detail view. */
export const MODERATION_HISTORY_LIMIT = 50;
