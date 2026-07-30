import { QButton, cn } from '@qalam/ui';
import { FilterX } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Container for a row of filter controls (selects, date pickers, search) with a "Clear" affordance
 * that appears once any filter is active. Pairs with `useFilters` (URL-synced): pass its
 * `activeCount` and `reset`. The controls themselves are the caller's children.
 */
export interface FilterBarProps {
  children: ReactNode;
  activeCount?: number;
  onClear?: () => void;
  className?: string;
}

export function FilterBar({
  children,
  activeCount = 0,
  onClear,
  className,
}: FilterBarProps): ReactElement {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="group"
      aria-label="Filters"
    >
      {children}
      {activeCount > 0 && onClear ? (
        <QButton variant="ghost" size="sm" icon={FilterX} onClick={onClear}>
          Clear{activeCount > 0 ? ` (${String(activeCount)})` : ''}
        </QButton>
      ) : null}
    </div>
  );
}
