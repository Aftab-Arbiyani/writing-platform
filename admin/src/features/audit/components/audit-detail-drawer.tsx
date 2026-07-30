import { Descriptions, Tag } from 'antd';
import type { ReactElement, ReactNode } from 'react';

import { Drawer } from '@/components/drawer';
import { LoadingState } from '@/components/loading-state';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

import { CATEGORY_COLOR } from '../audit.constants';
import { useAuditEntry } from '../hooks/use-audit';
import type { AuditLog } from '../types/audit.types';

const renderValue = (value: unknown): string =>
  value === null || value === undefined
    ? '—'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

function relatedReport(entry: AuditLog): string | null {
  if (entry.targetType === 'report') {
    return entry.targetId;
  }
  const reportId = entry.metadata.reportId;
  return typeof reportId === 'string' ? reportId : null;
}

function Body({ entry }: { entry: AuditLog }): ReactElement {
  const before = entry.metadata.before ?? entry.metadata.previous;
  const after = entry.metadata.after ?? entry.metadata.current;
  const report = relatedReport(entry);

  return (
    <div className="flex flex-col gap-5">
      <Descriptions
        column={1}
        size="small"
        items={[
          {
            key: 'action',
            label: 'Action',
            children: <span className="font-mono">{entry.action}</span>,
          },
          {
            key: 'category',
            label: 'Category',
            children: (
              <Tag color={CATEGORY_COLOR[entry.category] ?? 'default'}>{entry.category}</Tag>
            ),
          },
          {
            key: 'actor',
            label: 'Actor',
            children:
              entry.actorId === null ? 'system' : `${entry.actorRole ?? '—'} · ${entry.actorId}`,
          },
          {
            key: 'target',
            label: 'Target',
            children: `${entry.targetType} · ${entry.targetId ?? '—'}`,
          },
          { key: 'previous', label: 'Previous', children: renderValue(before) },
          { key: 'new', label: 'New', children: renderValue(after) },
          { key: 'time', label: 'Timestamp', children: formatDateTime(entry.createdAt) },
          { key: 'ip', label: 'IP address', children: entry.ip ?? '—' },
          {
            key: 'report',
            label: 'Related report',
            children: report ?? <span className="text-ink-muted">—</span>,
          },
          {
            key: 'id',
            label: 'Audit id',
            children: <span className="font-mono text-xs">{entry.id}</span>,
          },
          {
            key: 'request',
            label: 'Request id',
            children: entry.requestId ?? '—',
          },
        ]}
      />
      <section className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-ink">Metadata</h3>
        <pre className="max-h-64 overflow-auto rounded-md border border-line bg-surface p-2 text-xs text-ink">
          {JSON.stringify(entry.metadata, null, 2)}
        </pre>
        <p className="text-xs text-ink-muted">
          Device / user-agent is not exposed by this endpoint.
        </p>
      </section>
    </div>
  );
}

/** Audit entry detail drawer. */
export function AuditDetailDrawer({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}): ReactElement {
  const query = useAuditEntry(id);
  let body: ReactNode = null;
  if (id !== null && query.isLoading) {
    body = <LoadingState variant="rows" rows={6} />;
  } else if (query.isError) {
    body = <p className="text-sm text-danger">{getErrorMessage(query.error)}</p>;
  } else if (query.data !== undefined) {
    body = <Body entry={query.data} />;
  }
  return (
    <Drawer open={id !== null} onClose={onClose} width={600} title="Audit entry">
      {body}
    </Drawer>
  );
}
