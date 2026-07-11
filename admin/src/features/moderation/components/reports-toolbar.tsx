import { QButton } from '@qalam/ui';
import { Checkbox, Popover, Select } from 'antd';
import { Columns3, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import { SearchInput } from '@/components/search-input';
import { Toolbar } from '@/components/toolbar';

import { REPORT_COLUMNS, REQUIRED_REPORT_COLUMNS } from '../moderation.constants';
import { useModerationPrefs, type TableDensity } from '../stores/moderation-prefs.store';

interface ReportsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onRefresh: () => void;
  isFetching: boolean;
}

const DENSITY_OPTIONS: { label: string; value: TableDensity }[] = [
  { label: 'Compact', value: 'small' },
  { label: 'Cozy', value: 'middle' },
  { label: 'Comfortable', value: 'large' },
];

/** Report-queue toolbar: debounced search, filter toggle, density, column visibility, refresh. */
export function ReportsToolbar({
  search,
  onSearchChange,
  filtersOpen,
  onToggleFilters,
  onRefresh,
  isFetching,
}: ReportsToolbarProps): ReactElement {
  const density = useModerationPrefs((state) => state.density);
  const setDensity = useModerationPrefs((state) => state.setDensity);
  const hiddenColumns = useModerationPrefs((state) => state.hiddenColumns);
  const toggleColumn = useModerationPrefs((state) => state.toggleColumn);
  const [value, setValue] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setValue(search), [search]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (next: string): void => {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearchChange(next), 350);
  };

  const columnsMenu = (
    <div
      className="flex max-h-80 flex-col gap-2 overflow-y-auto pe-1"
      role="group"
      aria-label="Toggle columns"
    >
      {REPORT_COLUMNS.filter((column) => !REQUIRED_REPORT_COLUMNS.has(column.key)).map((column) => (
        <Checkbox
          key={column.key}
          checked={!hiddenColumns.includes(column.key)}
          onChange={() => toggleColumn(column.key)}
        >
          {column.label}
        </Checkbox>
      ))}
    </div>
  );

  return (
    <Toolbar
      start={
        <>
          <SearchInput
            value={value}
            onChange={commit}
            onSubmit={onSearchChange}
            ariaLabel="Search reports"
            placeholder="Search description or an exact reporter/target id…"
          />
          <QButton
            variant={filtersOpen ? 'primary' : 'secondary'}
            size="sm"
            icon={SlidersHorizontal}
            onClick={onToggleFilters}
            aria-expanded={filtersOpen}
          >
            Filters
          </QButton>
          <Select<TableDensity>
            size="small"
            aria-label="Row density"
            value={density}
            options={DENSITY_OPTIONS}
            onChange={setDensity}
            style={{ minWidth: 130 }}
          />
        </>
      }
      end={
        <>
          <Popover content={columnsMenu} trigger="click" placement="bottomRight">
            <QButton variant="secondary" size="sm" icon={Columns3}>
              Columns
            </QButton>
          </Popover>
          <QButton
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={onRefresh}
            loading={isFetching}
            aria-label="Refresh"
          />
        </>
      }
    />
  );
}
