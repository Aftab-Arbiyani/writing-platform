import type { ReactElement, ReactNode } from 'react';

/**
 * Page-level header for admin sections: the `<h1>` (one per page), an optional description, a
 * trailing actions slot, and an optional breadcrumbs slot rendered above the title. Distinct from
 * `QSectionHeader` (which is an `<h2>` section head) — this owns the document heading.
 */
export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Rendered above the title (usually `<Breadcrumbs />`). */
  breadcrumbs?: ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: PageHeaderProps): ReactElement {
  return (
    <header className="flex flex-col gap-3">
      {breadcrumbs}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-2xl font-semibold text-ink">{title}</h1>
          {description ? <p className="text-sm text-ink-secondary">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
