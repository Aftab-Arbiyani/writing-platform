import { cn } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

/**
 * A thin horizontal toolbar for the strip above a table/list: a `start` slot (search, filters) and
 * an `end` slot (primary actions), wrapping gracefully on narrow viewports. Layout only — the
 * controls inside are the caller's.
 */
export interface ToolbarProps {
  start?: ReactNode;
  end?: ReactNode;
  className?: string;
}

export function Toolbar({ start, end, className }: ToolbarProps): ReactElement {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">{start}</div>
      {end ? <div className="flex flex-shrink-0 items-center gap-2">{end}</div> : null}
    </div>
  );
}
