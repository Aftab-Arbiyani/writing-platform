import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

interface ConfigurationCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * A titled configuration surface (A7). Wraps a group of settings with a header
 * (icon + title + description) and an optional action slot. Token-only styling,
 * dark-mode-safe, logical spacing (RTL-safe).
 */
export function ConfigurationCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
}: ConfigurationCardProps): ReactElement {
  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
        <div className="flex items-start gap-3">
          {Icon !== undefined ? (
            <span className="mt-0.5 text-ink-secondary" aria-hidden="true">
              <Icon size={18} />
            </span>
          ) : null}
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description !== undefined ? (
              <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
            ) : null}
          </div>
        </div>
        {actions !== undefined ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="px-4">{children}</div>
    </section>
  );
}
