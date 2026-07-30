import { TriangleAlert } from 'lucide-react';
import type { ReactElement } from 'react';

import { cn } from '../lib/cn.js';
import { QButton } from './q-button.js';

export interface QErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** X-Request-Id, surfaced for support (docs/06 §4.5). */
  requestId?: string;
  minHeight?: number;
  className?: string;
}

/** In-place error panel (docs/06 §4.5) — never a blank screen. Offers a retry + requestId. */
export function QErrorState({
  title = 'Something went wrong.',
  description = "We couldn't load this. Your work is safe.",
  onRetry,
  retryLabel = 'Try again',
  requestId,
  minHeight = 320,
  className,
}: QErrorStateProps): ReactElement {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 px-6 text-center', className)}
      style={{ minHeight }}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-raised">
        <TriangleAlert size={24} strokeWidth={1.5} className="text-danger" aria-hidden />
      </span>
      <h3 className="text-lg font-medium text-ink">{title}</h3>
      {description ? (
        <p className="max-w-[40ch] text-sm text-ink-secondary">{description}</p>
      ) : null}
      {onRetry ? (
        <QButton variant="secondary" onClick={onRetry}>
          {retryLabel}
        </QButton>
      ) : null}
      {requestId ? <p className="font-mono text-xs text-ink-muted">Ref: {requestId}</p> : null}
    </div>
  );
}
