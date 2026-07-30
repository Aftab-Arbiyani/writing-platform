import { Checkbox, Select } from 'antd';
import type { ReactElement } from 'react';

import { FilterBar } from '@/components/filter-bar';
import type { Filters } from '@/hooks/use-filters';

import {
  HAS_PUBLISHED_OPTIONS,
  ROLE_OPTIONS,
  STATUS_OPTIONS,
  VERIFIED_OPTIONS,
  VISIBILITY_OPTIONS,
  type UserFilterKey,
} from '../users.constants';

/** Filter fields shown as controls (excludes `q` [toolbar search] and `sort` [table]). */
const FILTER_FIELDS: UserFilterKey[] = [
  'role',
  'status',
  'verified',
  'visibility',
  'hasPublished',
  'registeredFrom',
  'registeredTo',
  'lastLoginFrom',
  'lastLoginTo',
  'includeDeleted',
];

interface UsersFiltersProps {
  filters: Filters<UserFilterKey>;
}

/** A labelled control wrapper (stacked label + control). */
function Field({ label, children }: { label: string; children: ReactElement }): ReactElement {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}

/**
 * The advanced-filter panel for the user grid. Enum filters use themed AntD
 * `Select`s; date filters use native `<input type="date">` (string-valued, so no
 * dayjs dependency and controlled straight off the URL). Everything writes to the
 * URL via `filters.setFilter`; the "Clear" count reflects only these fields.
 */
export function UsersFilters({ filters }: UsersFiltersProps): ReactElement {
  const activeCount = FILTER_FIELDS.filter((key) => filters.values[key] !== undefined).length;
  const clearFilters = (): void => {
    for (const key of FILTER_FIELDS) {
      filters.setFilter(key, undefined);
    }
  };

  const dateInput = (key: UserFilterKey): ReactElement => (
    <input
      type="date"
      className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
      value={filters.values[key] ?? ''}
      onChange={(event) => filters.setFilter(key, event.target.value || undefined)}
    />
  );

  const select = (
    key: UserFilterKey,
    placeholder: string,
    options: { label: string; value: string }[],
  ): ReactElement => (
    <Select
      allowClear
      style={{ minWidth: 160 }}
      placeholder={placeholder}
      value={filters.values[key] ?? undefined}
      options={options}
      onChange={(value: string | undefined) => filters.setFilter(key, value ?? undefined)}
    />
  );

  return (
    <FilterBar activeCount={activeCount} onClear={clearFilters}>
      <Field label="Role">{select('role', 'Any role', ROLE_OPTIONS)}</Field>
      <Field label="Status">{select('status', 'Any status', STATUS_OPTIONS)}</Field>
      <Field label="Verification">{select('verified', 'Any', VERIFIED_OPTIONS)}</Field>
      <Field label="Visibility">{select('visibility', 'Any', VISIBILITY_OPTIONS)}</Field>
      <Field label="Published">{select('hasPublished', 'Any', HAS_PUBLISHED_OPTIONS)}</Field>
      <Field label="Registered from">{dateInput('registeredFrom')}</Field>
      <Field label="Registered to">{dateInput('registeredTo')}</Field>
      <Field label="Last login from">{dateInput('lastLoginFrom')}</Field>
      <Field label="Last login to">{dateInput('lastLoginTo')}</Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-secondary">
        <Checkbox
          checked={filters.values.includeDeleted === 'true'}
          onChange={(event) =>
            filters.setFilter('includeDeleted', event.target.checked ? 'true' : undefined)
          }
        />
        Include removed
      </label>
    </FilterBar>
  );
}
