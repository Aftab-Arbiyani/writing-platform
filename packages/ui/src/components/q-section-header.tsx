import type { ReactElement, ReactNode } from 'react';

import { cn } from '../lib/cn.js';

export interface QSectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Trailing actions slot (buttons, filters). */
  actions?: ReactNode;
  className?: string;
}

/** Section title + optional description + trailing actions (docs/07 §7, altitude of a page/section head). */
export function QSectionHeader({
  title,
  description,
  actions,
  className,
}: QSectionHeaderProps): ReactElement {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        {description ? <p className="text-sm text-ink-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
