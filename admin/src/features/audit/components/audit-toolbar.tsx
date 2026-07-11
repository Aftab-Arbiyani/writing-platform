import { QButton } from '@qalam/ui';
import { Checkbox, Dropdown, Popover, Select, type MenuProps } from 'antd';
import { Columns3, Download, FileJson, RefreshCw, Sheet, SlidersHorizontal } from 'lucide-react';
import { createElement, useEffect, useRef, useState, type ReactElement } from 'react';

import { SearchInput } from '@/components/search-input';
import { Toolbar } from '@/components/toolbar';

import { AUDIT_COLUMNS, REQUIRED_AUDIT_COLUMNS } from '../audit.constants';
import { useAuditPrefs, type TableDensity } from '../stores/audit-prefs.store';

interface AuditToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onRefresh: () => void;
  isFetching: boolean;
  onExport: (format: 'csv' | 'json') => void;
  exporting: boolean;
}

const DENSITY_OPTIONS: { label: string; value: TableDensity }[] = [
  { label: 'Compact', value: 'small' },
  { label: 'Cozy', value: 'middle' },
  { label: 'Comfortable', value: 'large' },
];

/** Audit-log toolbar: debounced search, filter toggle, density, column visibility, export, refresh. */
export function AuditToolbar({
  search,
  onSearchChange,
  filtersOpen,
  onToggleFilters,
  onRefresh,
  isFetching,
  onExport,
  exporting,
}: AuditToolbarProps): ReactElement {
  const density = useAuditPrefs((state) => state.density);
  const setDensity = useAuditPrefs((state) => state.setDensity);
  const hiddenColumns = useAuditPrefs((state) => state.hiddenColumns);
  const toggleColumn = useAuditPrefs((state) => state.toggleColumn);
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
      {AUDIT_COLUMNS.filter((column) => !REQUIRED_AUDIT_COLUMNS.has(column.key)).map((column) => (
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

  const exportItems: MenuProps['items'] = [
    { key: 'csv', label: 'Export CSV', icon: createElement(Sheet, { size: 16 }) },
    { key: 'json', label: 'Export JSON', icon: createElement(FileJson, { size: 16 }) },
  ];

  return (
    <Toolbar
      start={
        <>
          <SearchInput
            value={value}
            onChange={commit}
            onSubmit={onSearchChange}
            ariaLabel="Search audit logs"
            placeholder="Search action code or an exact actor/target id…"
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
          <Dropdown
            menu={{ items: exportItems, onClick: ({ key }) => onExport(key as 'csv' | 'json') }}
            trigger={['click']}
            placement="bottomRight"
          >
            <QButton variant="secondary" size="sm" icon={Download} loading={exporting}>
              Export
            </QButton>
          </Dropdown>
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
