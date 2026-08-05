import { QCard } from '@qalam/ui';
import type { ReactElement } from 'react';

import type { AiUsageWindowSummary } from '../types/ai.types';

/**
 * One AF1 token-usage window — today, this month, or all time (W8 C3). Ported from mobile's
 * `ai_usage_screen` window card.
 *
 * A near-twin of monetization's `UsageWindowCard` and deliberately its own component: features may not
 * import features (docs/26 §4), and the two render different shapes. `AiUsageWindowSummary` splits
 * tokens into `inputTokens`/`outputTokens` and has **no `resetsAt`** — the AF1 windows are computed
 * from `startOfDayUtc`/`startOfMonthUtc` at read time (`usage.service.ts:97-99`), so there is no reset
 * timestamp to show and inventing one would be fabricating data.
 *
 * The progress bar carries the only quantity communicated by *width*, so it gets the full ARIA value
 * set; unlimited windows render no bar, because there is no fraction of infinity to draw and
 * `usedFraction` is null in exactly that case (`usage.service.ts:137`).
 */
export function AiUsageWindowCard({
  label,
  window,
}: {
  label: string;
  window: AiUsageWindowSummary;
}): ReactElement {
  const unlimited = window.tokenLimit === null;
  const fraction = window.usedFraction ?? 0;
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  const remaining =
    window.tokenLimit === null ? null : Math.max(0, window.tokenLimit - window.totalTokens);
  const exhausted = remaining === 0;

  return (
    <QCard as="li" className="flex flex-col gap-3">
      <h3 className="text-ink text-sm font-semibold">{label}</h3>

      <dl className="grid grid-cols-3 gap-2">
        <Stat label="tokens" value={window.totalTokens.toLocaleString()} />
        <Stat label="requests" value={window.requests.toLocaleString()} />
        <Stat label="est. cost" value={formatUsd(window.estimatedCostUsd)} />
      </dl>

      {/*
       * The in/out split is the one thing this card shows that the billing card cannot: it is the
       * difference between a writer sending long selections and one generating long output, and only
       * the AF1 ledger records it.
       */}
      <p className="text-ink-muted text-xs">
        {window.inputTokens.toLocaleString()} in · {window.outputTokens.toLocaleString()} out
      </p>

      {unlimited ? (
        <p className="text-ink-muted text-sm">No cap on this window.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-label={`${label} cap used`}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${percent}% used`}
            className="bg-raised h-1.5 w-full overflow-hidden rounded-full"
          >
            <div
              className={exhausted ? 'bg-danger h-full' : 'bg-accent h-full'}
              style={{ inlineSize: `${percent}%` }}
            />
          </div>
          <p className="text-ink-secondary text-sm">
            {exhausted
              ? 'Cap reached'
              : `${(remaining ?? 0).toLocaleString()} of ${(window.tokenLimit ?? 0).toLocaleString()} tokens left`}
          </p>
        </div>
      )}
    </QCard>
  );
}

/**
 * Cost is rendered to cents at four decimal places rather than two: a single completion often costs
 * a fraction of a cent, and `$0.00` for real spend reads as "free", which is the wrong impression to
 * leave on the page whose job is making metering visible.
 */
function formatUsd(amount: number): string {
  if (amount === 0) return '$0.00';
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`;
}

function Stat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="flex flex-col">
      <dd className="text-ink text-lg font-semibold">{value}</dd>
      <dt className="text-ink-muted text-xs">{label}</dt>
    </div>
  );
}
