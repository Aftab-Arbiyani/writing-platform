import { QCard } from '@qalam/ui';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

/**
 * A navigational card for the dashboard's Quick Actions. The whole card is a single router `Link`
 * (SPA navigation, keyboard-focusable). Navigation only — it never performs an action.
 */
export interface QuickActionCardProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  to: string;
}

export function QuickActionCard({
  icon: Icon,
  label,
  description,
  to,
}: QuickActionCardProps): ReactElement {
  return (
    <QCard interactive padding="none">
      <Link to={to} className="flex items-center gap-3 rounded-[inherit] p-4 focus:outline-none">
        <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-md bg-raised">
          <Icon size={18} strokeWidth={1.75} className="text-accent" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-ink">{label}</span>
          {description ? <span className="text-xs text-ink-muted">{description}</span> : null}
        </span>
        <ArrowRight size={16} className="ms-auto flex-shrink-0 text-ink-muted" aria-hidden />
      </Link>
    </QCard>
  );
}
