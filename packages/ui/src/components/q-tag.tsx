import { X } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { cn } from '../lib/cn.js';
import type { LinkComponent } from '../lib/link.js';

export type QTagColor = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface QTagProps {
  children: ReactNode;
  color?: QTagColor;
  size?: 'sm' | 'md';
  /** Renders as a link (tag/genre pages) via the injected `linkComponent`. */
  href?: string;
  linkComponent?: LinkComponent;
  /** Removable tag (editor); requires `removeLabel` for the ✕ button's aria-label. */
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}

const COLOR: Record<QTagColor, string> = {
  neutral: 'bg-raised text-ink-secondary',
  accent: 'bg-accent/12 text-accent',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info',
};

const SIZE: Record<'sm' | 'md', string> = {
  sm: 'h-5 px-2 text-xs',
  md: 'h-6 px-2 text-xs',
};

/** Tag / chip (docs/07 §7.6). Custom — AntD's Tag carries the wrong voice + close logic. */
export function QTag({
  children,
  color = 'neutral',
  size = 'md',
  href,
  linkComponent,
  onRemove,
  removeLabel,
  className,
}: QTagProps): ReactElement {
  const base = cn(
    'inline-flex items-center gap-1 rounded-sm font-medium',
    SIZE[size],
    COLOR[color],
    className,
  );

  if (href && linkComponent) {
    const Link = linkComponent;
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }

  return (
    <span className={base}>
      {children}
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="ms-0.5 inline-flex size-4 items-center justify-center rounded-sm hover:bg-ink/10"
        >
          <X size={12} strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
