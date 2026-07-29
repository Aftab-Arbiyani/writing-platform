import { QCard } from '@qalam/ui';
import type { ReactElement } from 'react';

import { formatDateTime } from '@/lib/format';

import { isExhausted, isUnlimited, remainingTokens } from '../hooks/use-usage';
import { formatTokens, formatUsd, formatUsedPercent } from '../lib/monetization-format';
import { usageWindowLabel } from '../lib/monetization-labels';
import type { UsageWindowResponse } from '../types/monetization.types';

/**
 * One AI usage window — today, this month, or lifetime (AF5, W4). Ported from mobile's `_WindowCard`.
 *
 * The progress bar is a `<div role="progressbar">` with the full ARIA value set rather than a bare
 * styled div: it carries the only quantity on the card that is communicated by *width*, so without
 * the value attributes a screen-reader user gets the numbers and not the sense of how close the
 * allowance is to gone. Unlimited windows render no bar at all — there is no fraction of infinity to
 * show, and `usedFraction` is null in exactly that case.
 */
export function UsageWindowCard({ window }: { window: UsageWindowResponse }): ReactElement {
  const label = usageWindowLabel(window.window);
  const unlimited = isUnlimited(window);
  const remaining = remainingTokens(window);
  const exhausted = isExhausted(window);
  const fraction = window.usedFraction ?? 0;
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  return (
    <QCard as="li" className="flex flex-col gap-3">
      <h3 className="text-ink text-sm font-semibold">{label}</h3>

      <dl className="grid grid-cols-3 gap-2">
        <Stat label="tokens" value={formatTokens(window.tokens)} />
        <Stat label="requests" value={formatTokens(window.requests)} />
        <Stat label="cost" value={formatUsd(window.costUsd)} />
      </dl>

      {unlimited ? (
        <p className="text-ink-muted text-sm">No limit on this window.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-label={`${label} allowance used`}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${formatUsedPercent(fraction)} used`}
            className="bg-raised h-1.5 w-full overflow-hidden rounded-full"
          >
            <div
              className={exhausted ? 'bg-danger h-full' : 'bg-accent h-full'}
              style={{ inlineSize: `${percent}%` }}
            />
          </div>
          <p className="text-ink-secondary text-sm">
            {exhausted
              ? 'Allowance used'
              : `${formatTokens(remaining ?? 0)} of ${formatTokens(window.tokenLimit ?? 0)} tokens left`}
            {window.resetsAt === null ? null : ` · resets ${formatDateTime(window.resetsAt)}`}
          </p>
        </div>
      )}
    </QCard>
  );
}

function Stat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="flex flex-col">
      <dd className="text-ink text-lg font-semibold">{value}</dd>
      <dt className="text-ink-muted text-xs">{label}</dt>
    </div>
  );
}
