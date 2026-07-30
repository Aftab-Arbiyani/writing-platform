import { QButton } from '@qalam/ui';
import { Tag, type TableColumnsType } from 'antd';
import { Eye } from 'lucide-react';

import { formatDateTime } from '@/lib/format';

import { CATEGORY_COLOR } from '../audit.constants';
import type { AuditLog } from '../types/audit.types';

interface BuildColumnsOptions {
  hiddenColumns: string[];
  sort: string;
  onView: (entry: AuditLog) => void;
}

type SortOrder = 'ascend' | 'descend' | null;

function sortOrderFor(columnKey: string, sort: string): SortOrder {
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  if (field !== columnKey) {
    return null;
  }
  return desc ? 'descend' : 'ascend';
}

const shortId = (id: string | null): string => (id === null ? '—' : id.slice(0, 8));

/** Builds the audit-log columns; hidden columns filtered out, View action pinned right. */
export function buildAuditColumns(options: BuildColumnsOptions): TableColumnsType<AuditLog> {
  const { hiddenColumns, sort, onView } = options;
  const hidden = new Set(hiddenColumns);
  const show = (key: string): boolean => !hidden.has(key);
  const columns: TableColumnsType<AuditLog> = [];

  if (show('createdAt')) {
    columns.push({
      key: 'createdAt',
      title: 'Time',
      dataIndex: 'createdAt',
      sorter: true,
      sortOrder: sortOrderFor('createdAt', sort),
      render: (value: string) => formatDateTime(value),
    });
  }
  if (show('action')) {
    columns.push({
      key: 'action',
      title: 'Action',
      dataIndex: 'action',
      sorter: true,
      sortOrder: sortOrderFor('action', sort),
      render: (value: string) => <span className="font-mono text-sm text-ink">{value}</span>,
    });
  }
  if (show('category')) {
    columns.push({
      key: 'category',
      title: 'Category',
      dataIndex: 'category',
      render: (value: string) => <Tag color={CATEGORY_COLOR[value] ?? 'default'}>{value}</Tag>,
    });
  }
  if (show('actor')) {
    columns.push({
      key: 'actor',
      title: 'Actor',
      render: (_, entry) =>
        entry.actorId === null ? (
          <span className="text-ink-muted">system</span>
        ) : (
          <span className="tabular-nums">
            {entry.actorRole ?? '—'} · {shortId(entry.actorId)}
          </span>
        ),
    });
  }
  if (show('target')) {
    columns.push({
      key: 'target',
      title: 'Target',
      render: (_, entry) => (
        <span className="tabular-nums">
          {entry.targetType} · {shortId(entry.targetId)}
        </span>
      ),
    });
  }
  if (show('ip')) {
    columns.push({
      key: 'ip',
      title: 'IP',
      dataIndex: 'ip',
      render: (value: string | null) => value ?? <span className="text-ink-muted">—</span>,
    });
  }

  columns.push({
    key: 'actions',
    title: '',
    fixed: 'right',
    width: 64,
    render: (_, entry) => (
      <QButton
        variant="ghost"
        size="sm"
        icon={Eye}
        aria-label={`View audit entry ${entry.id.slice(0, 8)}`}
        onClick={() => onView(entry)}
      />
    ),
  });

  return columns;
}
