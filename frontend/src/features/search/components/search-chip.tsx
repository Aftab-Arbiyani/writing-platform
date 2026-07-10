import { cn } from '@qalam/ui';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * A pill BUTTON for "run this query" actions (recent + trending keywords). `QTag` renders a
 * link or a static span — these chips fire a callback (execute a search) instead, so they need
 * a real `<button>`. Tokenized surface, ≥40px tall for a comfortable touch target (docs/28).
 */
const CHIP_BASE =
  'inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm text-ink-secondary transition-colors hover:border-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function SearchChip({
  label,
  icon: Icon,
  onClick,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  className?: string;
}): ReactElement {
  return (
    <button type="button" onClick={onClick} className={cn(CHIP_BASE, className)}>
      {Icon ? <Icon size={14} strokeWidth={1.75} aria-hidden /> : null}
      <span dir="auto" className="truncate">
        {label}
      </span>
    </button>
  );
}

/**
 * A removable recent-search chip: the label runs the query, the trailing ✕ forgets it. Two
 * distinct focus stops (run vs remove) so both are keyboard-reachable (docs/28 §2).
 */
export function RemovableChip({
  label,
  onClick,
  onRemove,
  removeLabel,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  onRemove: () => void;
  removeLabel: string;
  icon?: LucideIcon;
}): ReactElement {
  return (
    <span className={cn(CHIP_BASE, 'pe-1.5')}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {Icon ? <Icon size={14} strokeWidth={1.75} aria-hidden /> : null}
        <span dir="auto" className="truncate">
          {label}
        </span>
      </button>
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="inline-flex size-6 items-center justify-center rounded-full text-ink-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <X size={13} strokeWidth={1.75} aria-hidden />
      </button>
    </span>
  );
}
