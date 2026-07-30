import { Select } from 'antd';
import type { ReactElement } from 'react';

import { FilterBar } from '@/components/filter-bar';
import type { Filters } from '@/hooks/use-filters';

import {
  PRIORITY_OPTIONS,
  REASON_OPTIONS,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  type ReportFilterKey,
} from '../moderation.constants';

const FILTER_FIELDS: ReportFilterKey[] = [
  'type',
  'status',
  'priority',
  'severity',
  'reason',
  'dateFrom',
  'dateTo',
];

/** Labelled control wrapper. */
function Field({ label, children }: { label: string; children: ReactElement }): ReactElement {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Advanced filters for the report queue (type/status/priority/severity/reason/date range). */
export function ReportsFilters({ filters }: { filters: Filters<ReportFilterKey> }): ReactElement {
  const activeCount = FILTER_FIELDS.filter((key) => filters.values[key] !== undefined).length;
  const clear = (): void => {
    for (const key of FILTER_FIELDS) {
      filters.setFilter(key, undefined);
    }
  };

  const dateInput = (key: ReportFilterKey): ReactElement => (
    <input
      type="date"
      className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
      value={filters.values[key] ?? ''}
      onChange={(event) => filters.setFilter(key, event.target.value || undefined)}
    />
  );

  const select = (
    key: ReportFilterKey,
    placeholder: string,
    options: { label: string; value: string }[],
  ): ReactElement => (
    <Select
      allowClear
      style={{ minWidth: 150 }}
      placeholder={placeholder}
      value={filters.values[key] ?? undefined}
      options={options}
      onChange={(value?: string) => filters.setFilter(key, value ?? undefined)}
    />
  );

  return (
    <FilterBar activeCount={activeCount} onClear={clear}>
      <Field label="Type">{select('type', 'Any type', TYPE_OPTIONS)}</Field>
      <Field label="Status">{select('status', 'Any status', STATUS_OPTIONS)}</Field>
      <Field label="Priority">{select('priority', 'Any priority', PRIORITY_OPTIONS)}</Field>
      <Field label="Severity">{select('severity', 'Any severity', SEVERITY_OPTIONS)}</Field>
      <Field label="Reason">{select('reason', 'Any reason', REASON_OPTIONS)}</Field>
      <Field label="Reported from">{dateInput('dateFrom')}</Field>
      <Field label="Reported to">{dateInput('dateTo')}</Field>
    </FilterBar>
  );
}
