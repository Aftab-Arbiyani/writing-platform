import { QSkeleton } from '@qalam/ui';
import { memo, useEffect, useRef, useState, type ReactElement } from 'react';

import type { ChartOption } from '../../lib/chart-options';
import type { ECharts } from './chart-core';

/** The screen-reader data table that makes every chart accessible (docs: accessible charts). */
export interface ChartTable {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface ChartProps {
  option: ChartOption;
  /** Accessible name for the chart region. */
  ariaLabel: string;
  height?: number;
  loading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  /** The equivalent data as a table — rendered visually-hidden for screen readers. */
  table?: ChartTable;
  /** Decorative sparkline: no accessible name/table (the value is conveyed by its card's text). */
  decorative?: boolean;
}

function A11yTable({ table }: { table: ChartTable }): ReactElement {
  return (
    <table className="sr-only">
      <caption>{table.caption}</caption>
      <thead>
        <tr>
          {table.columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The base chart wrapper (docs: Chart Container). Lazy-loads echarts (`./chart-core`) on mount,
 * renders into a canvas, and resizes with a `ResizeObserver` (charts are responsive). Owns loading
 * (skeleton) + empty states. ALWAYS renders a visually-hidden data table so the chart is accessible
 * to screen readers and reliable to test (echarts' canvas isn't). If echarts can't initialise
 * (e.g. jsdom), the data table still conveys everything — the component never throws. `memo`d so a
 * parent re-render doesn't rebuild the chart unless `option` actually changes.
 */
export const Chart = memo(function Chart({
  option,
  ariaLabel,
  height = 240,
  loading = false,
  isEmpty = false,
  emptyMessage = 'No data for this range yet.',
  table,
  decorative = false,
}: ChartProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const [ready, setReady] = useState(false);

  const inactive = loading || isEmpty;

  // Lazy-init the chart engine once the container is live (and not in a loading/empty state).
  useEffect(() => {
    if (inactive) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;

    void (async () => {
      try {
        const { createChart } = await import('./chart-core');
        const el = containerRef.current;
        if (disposed || !el) return;
        const chart = createChart(el);
        chartRef.current = chart;
        setReady(true);
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(() => chart.resize());
          observer.observe(el);
        }
      } catch {
        /* echarts unavailable (e.g. jsdom) — the accessible data table still conveys the data. */
      }
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
      setReady(false);
    };
  }, [inactive]);

  // (Re)apply the option whenever it changes — data updates + light/dark theme rebuilds.
  useEffect(() => {
    if (ready && chartRef.current) chartRef.current.setOption(option, true);
  }, [option, ready]);

  if (loading) {
    return <QSkeleton variant="rect" height={height} radius="md" />;
  }

  if (isEmpty) {
    return (
      <figure aria-label={decorative ? undefined : ariaLabel} className="m-0">
        <div
          className="flex items-center justify-center rounded-md bg-raised/40 px-4 text-center text-sm text-ink-muted"
          style={{ height }}
        >
          {emptyMessage}
        </div>
        {table && !decorative ? <A11yTable table={table} /> : null}
      </figure>
    );
  }

  return (
    <figure
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative || undefined}
      className="m-0"
    >
      <div
        ref={containerRef}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : ariaLabel}
        className="w-full"
        style={{ height }}
      />
      {table && !decorative ? <A11yTable table={table} /> : null}
    </figure>
  );
});
