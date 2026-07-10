import { QSectionLoader, QSkeleton } from '@qalam/ui';
import type { ReactElement } from 'react';

/**
 * Section-level loading placeholder for admin surfaces. `spinner` for an indeterminate wait;
 * `rows` for a table-shaped skeleton (better perceived performance for lists). Reuses the shared
 * loader/skeleton primitives (reduced-motion + tokens handled there).
 */
export interface LoadingStateProps {
  variant?: 'spinner' | 'rows';
  /** Number of skeleton rows for the `rows` variant. */
  rows?: number;
  label?: string;
}

export function LoadingState({
  variant = 'spinner',
  rows = 6,
  label = 'Loading',
}: LoadingStateProps): ReactElement {
  if (variant === 'rows') {
    return (
      <div role="status" aria-label={label} className="flex flex-col gap-2 py-2">
        {Array.from({ length: rows }, (_, index) => (
          <QSkeleton key={index} variant="rect" height={48} radius="sm" className="w-full" />
        ))}
      </div>
    );
  }
  return <QSectionLoader label={label} />;
}
