import {
  ReportEntityType,
  ReportPriority,
  ReportReason,
  ReportResolution,
  ReportSeverity,
  ReportStatus,
} from '@qalam/shared';

/** URL filter keys for the report queue (pagination + these live in the URL). */
export const REPORT_FILTER_KEYS = [
  'q',
  'type',
  'status',
  'priority',
  'severity',
  'reason',
  'assignedModeratorId',
  'reportedUserId',
  'dateFrom',
  'dateTo',
  'sort',
] as const;
export type ReportFilterKey = (typeof REPORT_FILTER_KEYS)[number];

export const DEFAULT_REPORT_SORT = '-createdAt';

const opt = (values: Record<string, string>): { label: string; value: string }[] =>
  Object.entries(values).map(([value, label]) => ({ label, value }));

export const REASON_LABELS: Record<string, string> = {
  [ReportReason.Spam]: 'Spam',
  [ReportReason.Harassment]: 'Harassment',
  [ReportReason.HateSpeech]: 'Hate speech',
  [ReportReason.Violence]: 'Violence',
  [ReportReason.SexualContent]: 'Sexual content',
  [ReportReason.SelfHarm]: 'Self-harm',
  [ReportReason.Misinformation]: 'Misinformation',
  [ReportReason.Copyright]: 'Copyright',
  [ReportReason.Impersonation]: 'Impersonation',
  [ReportReason.Other]: 'Other',
};

export const TYPE_LABELS: Record<string, string> = {
  [ReportEntityType.Piece]: 'Piece',
  [ReportEntityType.Comment]: 'Comment',
  [ReportEntityType.User]: 'User',
  [ReportEntityType.Response]: 'Response',
};

export const TYPE_OPTIONS = opt(TYPE_LABELS);
export const REASON_OPTIONS = opt(REASON_LABELS);
export const STATUS_OPTIONS = opt({
  [ReportStatus.Pending]: 'Pending',
  [ReportStatus.Reviewing]: 'Reviewing',
  [ReportStatus.Resolved]: 'Resolved',
  [ReportStatus.Dismissed]: 'Dismissed',
  [ReportStatus.Appealed]: 'Appealed',
});
export const PRIORITY_OPTIONS = opt({
  [ReportPriority.Low]: 'Low',
  [ReportPriority.Normal]: 'Normal',
  [ReportPriority.High]: 'High',
  [ReportPriority.Urgent]: 'Urgent',
});
export const SEVERITY_OPTIONS = opt({
  [ReportSeverity.Low]: 'Low',
  [ReportSeverity.Medium]: 'Medium',
  [ReportSeverity.High]: 'High',
  [ReportSeverity.Critical]: 'Critical',
});

/** Decision options for the resolve dialog (label → resolution wire value). */
export const RESOLUTION_OPTIONS: { label: string; value: ReportResolution; danger?: boolean }[] = [
  { label: 'Approve content (no action)', value: ReportResolution.NoAction },
  { label: 'Dismiss report', value: ReportResolution.Dismissed },
  { label: 'Hide content', value: ReportResolution.ContentHidden },
  { label: 'Remove content', value: ReportResolution.ContentRemoved, danger: true },
  { label: 'Warn user', value: ReportResolution.UserWarned },
  { label: 'Suspend user (admin)', value: ReportResolution.UserSuspended, danger: true },
  { label: 'Ban user (admin)', value: ReportResolution.UserBanned, danger: true },
];

/** Tone maps for the priority/severity badges (QTag colors). */
export const PRIORITY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  [ReportPriority.Low]: 'neutral',
  [ReportPriority.Normal]: 'info',
  [ReportPriority.High]: 'warning',
  [ReportPriority.Urgent]: 'danger',
};
export const SEVERITY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  [ReportSeverity.Low]: 'neutral',
  [ReportSeverity.Medium]: 'info',
  [ReportSeverity.High]: 'warning',
  [ReportSeverity.Critical]: 'danger',
};
export const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  [ReportStatus.Pending]: 'warning',
  [ReportStatus.Reviewing]: 'info',
  [ReportStatus.Resolved]: 'success',
  [ReportStatus.Dismissed]: 'neutral',
  [ReportStatus.Appealed]: 'danger',
};

export interface ReportColumnMeta {
  key: string;
  label: string;
  sortable: boolean;
  defaultHidden?: boolean;
}

/** Grid columns; sortable keys are the backend `?sort=` tokens (createdAt/status/priority/severity). */
export const REPORT_COLUMNS: ReportColumnMeta[] = [
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'type', label: 'Type', sortable: false },
  { key: 'reason', label: 'Reason', sortable: false },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'severity', label: 'Severity', sortable: true },
  { key: 'reportedUser', label: 'Reported user', sortable: false },
  { key: 'reporter', label: 'Reporter', sortable: false, defaultHidden: true },
  { key: 'assignee', label: 'Assignee', sortable: false },
  { key: 'createdAt', label: 'Reported', sortable: true },
];

export const REQUIRED_REPORT_COLUMNS = new Set(['priority', 'actions']);
