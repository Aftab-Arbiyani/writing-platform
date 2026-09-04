import { QCard } from '@qalam/ui';
import type { ReactElement } from 'react';

import { formatDateTime } from '@/lib/format';

import { allowanceLine, windowNoun, type FeatureAllowance } from '../lib/feature-allowances';

/**
 * One tool's allowance — "12 of 30 today" (D5). Was `UsageWindowCard`.
 *
 * **The unit changed, and that is the whole point of the rewrite.** This card used to show a token
 * window: tokens, requests and dollars for today / this month / lifetime, with a bar over a token
 * cap. Tokens are an operator's unit. A poet asked "how much of my 200,000 monthly tokens does
 * tightening a stanza cost?" has been asked a question they cannot answer and did not want to be
 * asked. The allowance is now a count of the actions they actually took, per tool.
 *
 * The progress bar is a `<div role="progressbar">` with the full ARIA value set rather than a bare
 * styled div: it carries the only quantity on the card communicated by *width*, so without the value
 * attributes a screen-reader user gets the numbers and not the sense of how close the allowance is
 * to gone. An unlimited allowance renders no bar — there is no fraction of infinity to show.
 */
export function FeatureAllowanceCard({ allowance }: { allowance: FeatureAllowance }): ReactElement {
  const { limit, used, remaining, resetsAt, label } = allowance;
  const unlimited = limit === null;
  const exhausted = !unlimited && remaining === 0;
  const percent = unlimited ? 0 : Math.round(Math.min(1, Math.max(0, used / limit)) * 100);

  return (
    <QCard as="li" className="flex flex-col gap-3">
      <h3 className="text-ink text-sm font-semibold">{label}</h3>

      <p className="text-ink text-lg font-semibold">{allowanceLine(allowance)}</p>

      {unlimited ? (
        <p className="text-ink-muted text-sm">No limit on this tool.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-label={`${label} allowance used`}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${String(used)} of ${String(limit)} used ${windowNoun(allowance.window)}`}
            className="bg-raised h-1.5 w-full overflow-hidden rounded-full"
          >
            <div
              className={exhausted ? 'bg-danger h-full' : 'bg-accent h-full'}
              style={{ inlineSize: `${String(percent)}%` }}
            />
          </div>
          <p className="text-ink-secondary text-sm">
            {exhausted ? 'Limit reached' : `${String(remaining ?? 0)} left`}
            {resetsAt === null ? null : ` · resets ${formatDateTime(resetsAt)}`}
          </p>
        </div>
      )}
    </QCard>
  );
}
