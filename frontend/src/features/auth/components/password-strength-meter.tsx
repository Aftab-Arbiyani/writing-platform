import { PASSWORD_MIN } from '@qalam/shared';
import { cn } from '@qalam/ui';
import type { ReactElement } from 'react';

/**
 * Quiet 3-segment strength line (docs/06 §3.7 — deliberately NOT red/green bars). A gentle
 * confidence hint, never a gate: the Zod schema is the real rule. Announced to screen readers
 * politely; empty when the field is untouched.
 */
const LABELS = ['Too short', 'Getting there', 'Good', 'Strong'] as const;

function score(value: string): number {
  if (value.length < PASSWORD_MIN) return 0;
  let points = 1;
  if (value.length >= 14) points += 1;
  if (/[^A-Za-z0-9]/.test(value) || (/[A-Za-z]/.test(value) && /[0-9]/.test(value))) points += 1;
  return Math.min(points, 3);
}

export function PasswordStrengthMeter({ value }: { value: string }): ReactElement | null {
  if (!value) return null;
  const level = score(value);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i < level ? 'bg-accent' : 'bg-line',
            )}
          />
        ))}
      </div>
      <span className="text-xs text-ink-muted" role="status" aria-live="polite">
        Password strength: {LABELS[level]}
      </span>
    </div>
  );
}
