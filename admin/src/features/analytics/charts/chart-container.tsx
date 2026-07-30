import { QButton, QSkeleton } from '@qalam/ui';
import { BarChart3 } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { EmptyState } from '@/components/empty-state';
import { getErrorMessage } from '@/lib/errors';

export interface ChartTable {
  columns: string[];
  rows: Array<Array<string | number>>;
}

interface ChartContainerProps {
  title: string;
  description?: string;
  loading?: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  onRetry?: () => void;
  /** Screen-reader data table mirroring the chart (accessible charts). */
  table?: ChartTable;
  height?: number;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * A titled surface around one chart (A8) — owns the loading / empty / error
 * states and an sr-only data table so the chart is accessible to screen readers.
 * Reusable across every section.
 */
export function ChartContainer({
  title,
  description,
  loading = false,
  error = null,
  isEmpty = false,
  onRetry,
  table,
  height = 280,
  actions,
  children,
}: ChartContainerProps): ReactElement {
  return (
    <section className="flex flex-col rounded-lg border border-line bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description !== undefined ? (
            <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
          ) : null}
        </div>
        {actions !== undefined ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="p-4">
        {loading ? (
          <QSkeleton variant="rect" height={height} radius="sm" className="w-full" />
        ) : error !== null ? (
          <EmptyState
            icon={BarChart3}
            title="Couldn’t load this chart"
            description={getErrorMessage(error)}
            action={
              onRetry !== undefined ? (
                <QButton variant="secondary" size="sm" onClick={onRetry}>
                  Retry
                </QButton>
              ) : undefined
            }
          />
        ) : isEmpty ? (
          <EmptyState icon={BarChart3} title="No data for this range" minHeight={height} />
        ) : (
          <>
            {children}
            {table !== undefined ? (
              <table className="sr-only">
                <caption>{title}</caption>
                <thead>
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column} scope="col">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <tr key={index}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
