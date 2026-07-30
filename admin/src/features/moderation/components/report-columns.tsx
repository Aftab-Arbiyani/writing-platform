import { Tag, type TableColumnsType } from 'antd';

import { formatDate } from '@/lib/format';

import { REASON_LABELS, TYPE_LABELS } from '../moderation.constants';
import type { Report } from '../types/moderation.types';
import { PriorityBadge, ReportStatusBadge, SeverityBadge } from './moderation-badges';
import { ReportRowActions } from './report-row-actions';

interface BuildColumnsOptions {
  hiddenColumns: string[];
  sort: string;
  onView: (report: Report) => void;
  onAssign: (report: Report) => void;
  onEscalate: (report: Report) => void;
  onResolve: (report: Report) => void;
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

/** Builds the report-queue columns; hidden columns filtered out, actions pinned right. */
export function buildReportColumns(options: BuildColumnsOptions): TableColumnsType<Report> {
  const { hiddenColumns, sort, onView, onAssign, onEscalate, onResolve } = options;
  const hidden = new Set(hiddenColumns);
  const show = (key: string): boolean => !hidden.has(key);
  const columns: TableColumnsType<Report> = [];

  if (show('priority')) {
    columns.push({
      key: 'priority',
      title: 'Priority',
      dataIndex: 'priority',
      sorter: true,
      sortOrder: sortOrderFor('priority', sort),
      render: (_, report) => <PriorityBadge priority={report.priority} />,
    });
  }
  if (show('type')) {
    columns.push({
      key: 'type',
      title: 'Type',
      dataIndex: 'entityType',
      render: (value: string) => <Tag>{TYPE_LABELS[value] ?? value}</Tag>,
    });
  }
  if (show('reason')) {
    columns.push({
      key: 'reason',
      title: 'Reason',
      dataIndex: 'reason',
      render: (value: string) => REASON_LABELS[value] ?? value,
    });
  }
  if (show('status')) {
    columns.push({
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      sorter: true,
      sortOrder: sortOrderFor('status', sort),
      render: (_, report) => <ReportStatusBadge status={report.status} />,
    });
  }
  if (show('severity')) {
    columns.push({
      key: 'severity',
      title: 'Severity',
      dataIndex: 'severity',
      sorter: true,
      sortOrder: sortOrderFor('severity', sort),
      render: (_, report) => <SeverityBadge severity={report.severity} />,
    });
  }
  if (show('reportedUser')) {
    columns.push({
      key: 'reportedUser',
      title: 'Reported user',
      dataIndex: 'reportedUserId',
      render: (value: string | null) => <span className="tabular-nums">{shortId(value)}</span>,
    });
  }
  if (show('reporter')) {
    columns.push({
      key: 'reporter',
      title: 'Reporter',
      dataIndex: 'reporterId',
      render: (value: string) => <span className="tabular-nums">{shortId(value)}</span>,
    });
  }
  if (show('assignee')) {
    columns.push({
      key: 'assignee',
      title: 'Assignee',
      dataIndex: 'assignedModeratorId',
      render: (value: string | null) =>
        value === null ? <span className="text-ink-muted">Unassigned</span> : shortId(value),
    });
  }
  if (show('createdAt')) {
    columns.push({
      key: 'createdAt',
      title: 'Reported',
      dataIndex: 'createdAt',
      sorter: true,
      sortOrder: sortOrderFor('createdAt', sort),
      render: (value: string) => formatDate(value),
    });
  }

  columns.push({
    key: 'actions',
    title: '',
    fixed: 'right',
    width: 64,
    render: (_, report) => (
      <ReportRowActions
        report={report}
        onView={() => onView(report)}
        onAssign={() => onAssign(report)}
        onEscalate={() => onEscalate(report)}
        onResolve={() => onResolve(report)}
      />
    ),
  });

  return columns;
}
