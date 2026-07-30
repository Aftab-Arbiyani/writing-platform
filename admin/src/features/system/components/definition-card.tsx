import { QCard } from '@qalam/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

/**
 * A titled surface that renders a set of label → value rows as a `<dl>` (a semantic definition
 * list). Used across the System info + config-health views to present grouped identity fields.
 * Presentational only; values are pre-formatted by the caller. Two columns on wider viewports,
 * collapsing to one on mobile — logical grid, no physical margins.
 */
export interface DefinitionItem {
  label: string;
  value: ReactNode;
}

export interface DefinitionCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  items: DefinitionItem[];
}

export function DefinitionCard({
  title,
  description,
  icon: Icon,
  items,
}: DefinitionCardProps): ReactElement {
  return (
    <QCard as="section" padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {Icon ? (
            <Icon size={18} strokeWidth={1.75} className="text-ink-secondary" aria-hidden />
          ) : null}
          <h2 className="text-base font-semibold text-ink">{title}</h2>
        </div>
        {description ? <p className="text-sm text-ink-secondary">{description}</p> : null}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
              {item.label}
            </dt>
            <dd className="min-w-0 text-sm text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </QCard>
  );
}
