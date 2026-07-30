import { Tag } from 'antd';
import type { ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { formatDate } from '@/lib/format';

import { CATEGORY_COLOR } from '../audit.constants';
import type { AuditLog } from '../types/audit.types';

/** Groups entries by calendar day (they arrive newest-first). */
function groupByDay(entries: AuditLog[]): Array<[string, AuditLog[]]> {
  const groups = new Map<string, AuditLog[]>();
  for (const entry of entries) {
    const day = entry.createdAt.slice(0, 10);
    const bucket = groups.get(day) ?? [];
    bucket.push(entry);
    groups.set(day, bucket);
  }
  return [...groups.entries()];
}

const time = (iso: string): string => iso.slice(11, 19);

/** Chronological timeline view of the current audit page. Each row opens the detail drawer. */
export function AuditTimeline({
  entries,
  onView,
}: {
  entries: AuditLog[];
  onView: (entry: AuditLog) => void;
}): ReactElement {
  if (entries.length === 0) {
    return <EmptyState title="No audit events" description="No events match this view." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {groupByDay(entries).map(([day, dayEntries]) => (
        <section key={day} className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {formatDate(day)}
          </h3>
          <ul className="flex flex-col">
            {dayEntries.map((entry) => (
              <li key={entry.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 py-2 text-start hover:bg-raised"
                  onClick={() => onView(entry)}
                >
                  <span className="w-16 shrink-0 tabular-nums text-xs text-ink-muted">
                    {time(entry.createdAt)}
                  </span>
                  <Tag color={CATEGORY_COLOR[entry.category] ?? 'default'}>{entry.category}</Tag>
                  <span className="font-mono text-sm text-ink">{entry.action}</span>
                  <span className="ms-auto text-xs text-ink-secondary">
                    {entry.actorId === null
                      ? 'system'
                      : (entry.actorRole ?? entry.actorId.slice(0, 8))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
