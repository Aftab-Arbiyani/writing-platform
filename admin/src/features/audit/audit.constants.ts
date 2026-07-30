/** URL filter keys for the audit table (pagination + these live in the URL). */
export const AUDIT_FILTER_KEYS = [
  'q',
  'action',
  'module',
  'actorId',
  'targetType',
  'dateFrom',
  'dateTo',
  'sort',
] as const;
export type AuditFilterKey = (typeof AUDIT_FILTER_KEYS)[number];

export const DEFAULT_AUDIT_SORT = '-createdAt';

/** Known action-prefix modules (audit `action` is `module.verb`). */
export const MODULE_OPTIONS = [
  { label: 'User', value: 'user' },
  { label: 'Report', value: 'report' },
  { label: 'Content', value: 'content' },
  { label: 'Appeal', value: 'appeal' },
  { label: 'Audit', value: 'audit' },
];

/** Common target-entity kinds for the target filter. */
export const TARGET_TYPE_OPTIONS = [
  { label: 'User', value: 'user' },
  { label: 'Report', value: 'report' },
  { label: 'Appeal', value: 'appeal' },
  { label: 'Piece', value: 'piece' },
  { label: 'Comment', value: 'comment' },
];

/** AntD Tag colors for the audit category badge. */
export const CATEGORY_COLOR: Record<string, string> = {
  status: 'orange',
  role: 'geekblue',
  security: 'red',
  administrative: 'default',
};

export interface AuditColumnMeta {
  key: string;
  label: string;
  sortable: boolean;
  defaultHidden?: boolean;
}

/** Table columns; sortable keys are the backend `?sort=` tokens (createdAt|action). */
export const AUDIT_COLUMNS: AuditColumnMeta[] = [
  { key: 'createdAt', label: 'Time', sortable: true },
  { key: 'action', label: 'Action', sortable: true },
  { key: 'category', label: 'Category', sortable: false },
  { key: 'actor', label: 'Actor', sortable: false },
  { key: 'target', label: 'Target', sortable: false },
  { key: 'ip', label: 'IP', sortable: false, defaultHidden: true },
];

export const REQUIRED_AUDIT_COLUMNS = new Set(['action', 'actions']);
