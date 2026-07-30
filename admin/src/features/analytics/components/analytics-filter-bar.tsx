import { QButton } from '@qalam/ui';
import { Dropdown, Select, type MenuProps } from 'antd';
import { Download, FileJson, Printer, RefreshCw, Sheet } from 'lucide-react';
import { createElement, type ReactElement } from 'react';

import { Toolbar } from '@/components/toolbar';

import { GENRE_OPTIONS, LANGUAGE_OPTIONS } from '../analytics.constants';
import { useAnalyticsFilters } from '../stores/analytics-filters.store';
import { DateRangeSelector } from './date-range-selector';

interface AnalyticsFilterBarProps {
  /** Exports the CURRENT section — the page wires the dataset into the handler. */
  onExport: (format: 'csv' | 'json') => void;
  exporting: boolean;
  onPrint: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * The dashboard filter bar (A8): date range + language/genre filters, plus export
 * (CSV/JSON), a print-friendly view, and refresh. Country/device/platform filters
 * are intentionally NOT surfaced — the platform captures no such dimension (the
 * backend accepts but ignores them), so exposing them would mislead. Filters live
 * in the persisted filter store.
 */
export function AnalyticsFilterBar({
  onExport,
  exporting,
  onPrint,
  onRefresh,
  refreshing,
}: AnalyticsFilterBarProps): ReactElement {
  const range = useAnalyticsFilters((state) => state.range);
  const from = useAnalyticsFilters((state) => state.from);
  const to = useAnalyticsFilters((state) => state.to);
  const language = useAnalyticsFilters((state) => state.language);
  const genre = useAnalyticsFilters((state) => state.genre);
  const setRange = useAnalyticsFilters((state) => state.setRange);
  const setCustom = useAnalyticsFilters((state) => state.setCustom);
  const setFilter = useAnalyticsFilters((state) => state.setFilter);

  const exportItems: MenuProps['items'] = [
    { key: 'csv', label: 'Export CSV', icon: createElement(Sheet, { size: 16 }) },
    { key: 'json', label: 'Export JSON', icon: createElement(FileJson, { size: 16 }) },
  ];

  return (
    <Toolbar
      start={
        <>
          <DateRangeSelector
            range={range}
            from={from}
            to={to}
            onRange={setRange}
            onCustom={setCustom}
          />
          <Select
            value={language ?? ''}
            onChange={(value) => setFilter('language', value)}
            options={LANGUAGE_OPTIONS}
            style={{ minWidth: 150 }}
            aria-label="Language filter"
          />
          <Select
            value={genre ?? ''}
            onChange={(value) => setFilter('genre', value)}
            options={GENRE_OPTIONS}
            style={{ minWidth: 140 }}
            aria-label="Genre filter"
          />
        </>
      }
      end={
        <>
          <Dropdown
            menu={{ items: exportItems, onClick: ({ key }) => onExport(key as 'csv' | 'json') }}
            trigger={['click']}
            placement="bottomRight"
          >
            <QButton variant="secondary" size="sm" icon={Download} loading={exporting}>
              Export
            </QButton>
          </Dropdown>
          <QButton variant="secondary" size="sm" icon={Printer} onClick={onPrint}>
            Print
          </QButton>
          <QButton
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={onRefresh}
            loading={refreshing}
            aria-label="Refresh"
          />
        </>
      }
    />
  );
}
