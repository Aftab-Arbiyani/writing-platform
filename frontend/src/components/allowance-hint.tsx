import type { ReactElement } from 'react';

import { allowanceFor, allowanceLine, useFeatureAllowances } from '@/features/monetization';

/**
 * "12 of 30 today" under a tool (D5) — what the writer has left, before they spend it.
 *
 * **Placed inside the tool, not on the plan card.** The number is only interesting at the moment of
 * using the thing; on a pricing page it is a specification, here it is a warning. It replaces the
 * token-and-credit budget the old panel showed, which asked a writer to reason about a currency they
 * never bought in units they cannot count.
 *
 * **Silent when there is nothing to report.** No allowance for this key means either monetization is
 * dark or the plan grants it without limit, and both should show nothing rather than a zero. This is
 * a hint, so its absence must never read as a wall.
 */
export function AllowanceHint({ featureKey }: { featureKey: string }): ReactElement | null {
  const { allowances } = useFeatureAllowances();
  const allowance = allowanceFor(allowances, featureKey);

  if (allowance === null || allowance.limit === null) return null;

  const spent = allowance.remaining === 0;
  return (
    <p
      data-testid={`allowance-${featureKey}`}
      className={spent ? 'text-danger text-xs' : 'text-ink-muted text-xs'}
    >
      {allowanceLine(allowance)}
    </p>
  );
}
