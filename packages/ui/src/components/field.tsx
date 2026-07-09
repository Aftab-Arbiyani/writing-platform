import type { ReactElement, ReactNode } from 'react';

import { cn } from '../lib/cn.js';
import type { FieldA11y } from './use-field-a11y.js';

export interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  a11y: FieldA11y;
  children: ReactNode;
}

/**
 * Label → control → hint|error layout (docs/07 §7.2). Static label (no floating labels —
 * they misbehave in RTL + Nastaliq). Error copy in danger; hint in secondary ink.
 * (The `useFieldA11y` hook lives in ./use-field-a11y so this file only exports a component.)
 */
export function FieldShell({ label, hint, error, a11y, children }: FieldShellProps): ReactElement {
  const message = error ?? hint;
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={a11y.id} className="text-sm font-medium text-ink">
          {label}
        </label>
      ) : null}
      {children}
      {message ? (
        <span
          id={a11y.describedBy}
          className={cn('text-xs', error ? 'text-danger' : 'text-ink-secondary')}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
