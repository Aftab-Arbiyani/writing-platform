import { Input, Select } from 'antd';
import type { ReactElement } from 'react';

import { FilterBar } from '@/components/filter-bar';
import type { Filters } from '@/hooks/use-filters';

import { MODULE_OPTIONS, TARGET_TYPE_OPTIONS, type AuditFilterKey } from '../audit.constants';

const FILTER_FIELDS: AuditFilterKey[] = [
  'module',
  'action',
  'targetType',
  'actorId',
  'dateFrom',
  'dateTo',
];

function Field({ label, children }: { label: string; children: ReactElement }): ReactElement {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Advanced audit filters: module, action code, target type, actor id, date range. */
export function AuditFilters({ filters }: { filters: Filters<AuditFilterKey> }): ReactElement {
  const activeCount = FILTER_FIELDS.filter((key) => filters.values[key] !== undefined).length;
  const clear = (): void => {
    for (const key of FILTER_FIELDS) {
      filters.setFilter(key, undefined);
    }
  };

  const dateInput = (key: AuditFilterKey): ReactElement => (
    <input
      type="date"
      className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
      value={filters.values[key] ?? ''}
      onChange={(event) => filters.setFilter(key, event.target.value || undefined)}
    />
  );

  return (
    <FilterBar activeCount={activeCount} onClear={clear}>
      <Field label="Module">
        <Select
          allowClear
          style={{ minWidth: 150 }}
          placeholder="Any module"
          value={filters.values.module ?? undefined}
          options={MODULE_OPTIONS}
          onChange={(value?: string) => filters.setFilter('module', value ?? undefined)}
        />
      </Field>
      <Field label="Action code">
        <Input
          allowClear
          placeholder="e.g. user.suspend"
          value={filters.values.action ?? ''}
          onChange={(event) => filters.setFilter('action', event.target.value || undefined)}
        />
      </Field>
      <Field label="Target type">
        <Select
          allowClear
          style={{ minWidth: 150 }}
          placeholder="Any target"
          value={filters.values.targetType ?? undefined}
          options={TARGET_TYPE_OPTIONS}
          onChange={(value?: string) => filters.setFilter('targetType', value ?? undefined)}
        />
      </Field>
      <Field label="Actor id">
        <Input
          allowClear
          placeholder="Actor UUID"
          value={filters.values.actorId ?? ''}
          onChange={(event) => filters.setFilter('actorId', event.target.value || undefined)}
        />
      </Field>
      <Field label="From">{dateInput('dateFrom')}</Field>
      <Field label="To">{dateInput('dateTo')}</Field>
    </FilterBar>
  );
}
