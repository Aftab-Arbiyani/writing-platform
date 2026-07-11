import { QButton } from '@qalam/ui';
import { Select } from 'antd';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import type { ReactElement } from 'react';

import { SearchInput } from '@/components/search-input';
import { Toolbar } from '@/components/toolbar';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';

import { useUsersTablePrefs, type TableDensity } from '../stores/users-table-prefs.store';
import { ColumnVisibilityMenu } from './column-visibility-menu';
import { ExportMenu } from './export-menu';
import { SavedFiltersMenu } from './saved-filters-menu';

interface UsersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onRefresh: () => void;
  isFetching: boolean;
  onExport: (format: 'csv' | 'json') => void;
  onPrint: () => void;
  exporting: boolean;
}

const DENSITY_OPTIONS: { label: string; value: TableDensity }[] = [
  { label: 'Compact', value: 'small' },
  { label: 'Cozy', value: 'middle' },
  { label: 'Comfortable', value: 'large' },
];

/**
 * The grid toolbar: debounced search (username / display name / email / user id),
 * an advanced-filters toggle, density, column visibility, saved views, export, and
 * refresh. Search is committed to the URL after a short debounce so typing doesn't
 * refetch on every keystroke.
 */
export function UsersToolbar({
  search,
  onSearchChange,
  filtersOpen,
  onToggleFilters,
  onRefresh,
  isFetching,
  onExport,
  onPrint,
  exporting,
}: UsersToolbarProps): ReactElement {
  const density = useUsersTablePrefs((state) => state.density);
  const setDensity = useUsersTablePrefs((state) => state.setDensity);
  const { value, commit } = useDebouncedSearch(search, onSearchChange);

  return (
    <Toolbar
      start={
        <>
          <SearchInput
            value={value}
            onChange={commit}
            onSubmit={onSearchChange}
            ariaLabel="Search users"
            placeholder="Search username, name, email, or ID…"
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
          <SavedFiltersMenu />
          <ColumnVisibilityMenu />
          <ExportMenu onExport={onExport} onPrint={onPrint} exporting={exporting} />
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
