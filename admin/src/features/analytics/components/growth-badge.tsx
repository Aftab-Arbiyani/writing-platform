import { cn } from '@qalam/ui';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactElement } from 'react';

interface GrowthBadgeProps {
  /** Percentage change (e.g. 12.5 or -3). */
  value: number;
  /** When true, a downward move is styled positive (e.g. error rate). */
  invert?: boolean;
  className?: string;
}

/**
 * A trend indicator (A8) — a signed percentage with a direction icon and
 * token-based tone. Up is good by default; pass `invert` when down is good.
 */
export function GrowthBadge({ value, invert = false, className }: GrowthBadgeProps): ReactElement {
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const positive = invert ? direction === 'down' : direction === 'up';
  const tone = direction === 'flat' ? 'text-ink-muted' : positive ? 'text-success' : 'text-danger';
  const label = `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 text-sm font-medium', tone, className)}
      aria-label={`Change ${label}`}
    >
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}
