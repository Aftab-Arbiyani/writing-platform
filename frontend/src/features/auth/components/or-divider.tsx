import type { ReactElement } from 'react';

/** Quiet "or" divider between the OAuth button and the email form. */
export function OrDivider({ label = 'or' }: { label?: string }): ReactElement {
  return (
    <div className="flex items-center gap-3 text-xs text-ink-muted" aria-hidden>
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
