import { Tag } from 'antd';
import type { ReactElement } from 'react';

import { formatDateTime } from '@/lib/format';

import type { AuditLogEntry } from '../types/users.types';

const CATEGORY_TONE: Record<string, string> = {
  status: 'orange',
  role: 'geekblue',
  security: 'red',
  administrative: 'default',
};

/** Humanizes a dot-cased action code, e.g. `user.reset_password` → "reset password". */
function humanize(action: string): string {
  return action.replace(/^user\./, '').replaceAll('_', ' ');
}

/** One audit-trail entry — category tag, action, actor, time, and reason if recorded. */
export function AuditEntryRow({ entry }: { entry: AuditLogEntry }): ReactElement {
  const reason = typeof entry.metadata.reason === 'string' ? entry.metadata.reason : null;
  return (
    <li className="flex flex-col gap-1 border-b border-line py-2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <Tag color={CATEGORY_TONE[entry.category] ?? 'default'}>{entry.category}</Tag>
        <span className="text-sm font-medium text-ink">{humanize(entry.action)}</span>
        <span className="ms-auto text-xs text-ink-muted">{formatDateTime(entry.createdAt)}</span>
      </div>
      <div className="text-xs text-ink-secondary">
        {entry.actorRole !== null ? `by ${entry.actorRole}` : 'system'}
        {reason !== null ? ` · ${reason}` : ''}
      </div>
    </li>
  );
}
