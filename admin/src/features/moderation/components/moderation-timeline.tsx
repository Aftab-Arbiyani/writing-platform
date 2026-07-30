import { Tag } from 'antd';
import type { ReactElement } from 'react';

import { formatDateTime } from '@/lib/format';

import type { AuditEntry } from '../types/moderation.types';

const CATEGORY_TONE: Record<string, string> = {
  status: 'orange',
  role: 'geekblue',
  security: 'red',
  administrative: 'default',
};

/** Humanizes a dot-cased action code, e.g. `content.hide` → "content hide". */
function humanize(action: string): string {
  return action.replaceAll('.', ' ').replaceAll('_', ' ');
}

/** One timeline entry — action, actor, time, reason, and the audit reference id. */
function TimelineRow({ entry }: { entry: AuditEntry }): ReactElement {
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
        <span className="text-ink-muted"> · ref {entry.id.slice(0, 8)}</span>
      </div>
    </li>
  );
}

/** The moderation/appeal timeline — audit entries newest-first. */
export function ModerationTimeline({
  entries,
  emptyLabel = 'No history yet.',
}: {
  entries: AuditEntry[];
  emptyLabel?: string;
}): ReactElement {
  if (entries.length === 0) {
    return <p className="py-2 text-sm text-ink-muted">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-col">
      {entries.map((entry) => (
        <TimelineRow key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}
