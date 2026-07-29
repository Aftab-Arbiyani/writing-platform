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

/**
 * Fill + label per colour. The label is the `-on-tint` token, NEVER the fill token.
 *
 * Painting `text-<fam>` on `bg-<fam>/12` measures a colour against itself, so the
 * ratio depended on one token plus whatever page was behind it — every tinted
 * colour inherited the flaw, and accent/danger passed on `surface` while failing on
 * `raised` (docs/48 §3.5). The `-on-tint` tokens are solved against the darkest
 * page, so all five clear AA on all three backgrounds with the fills unchanged.
 *
 * A new colour needs a `--q-<fam>-on-tint` token. This map is the single place that
 * has to be right: the a11y spec (`e2e/tests/frontend/a11y.spec.ts`, "every QTag
 * colour clears AA on every page background") PARSES it out of this file, asserts
 * the pairing rule, then renders every entry on all three page backgrounds and
 * scans it. So a sixth colour is covered the moment it is added here — and a fill
 * paired with the wrong label fails the suite before any page uses it.
 */
const COLOR: Record<QTagColor, string> = {
  neutral: 'bg-raised text-ink-secondary',
  accent: 'bg-accent/12 text-accent-on-tint',
  success: 'bg-success/12 text-success-on-tint',
  warning: 'bg-warning/12 text-warning-on-tint',
  danger: 'bg-danger/12 text-danger-on-tint',
  info: 'bg-info/12 text-info-on-tint',
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
