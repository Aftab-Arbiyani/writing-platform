import { QTag } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

import { EmptyState } from '@/components/empty-state';
import { formatDateTime } from '@/lib/format';

import { strikeSeverityLabel } from '../lib/trust-labels';
import { sortStrikes, strikeState, strikeStateTag, type StrikeState } from '../lib/trust-standing';
import type { AdminStrike } from '../types/trust.types';

/**
 * A user's strikes (`GET /admin/users/:id/strikes`) — **active AND historical in one array**, the
 * read B9 added to close A2-2.
 *
 * This is what turns the escalation figure from a projection into a fact. A2 could only tell an
 * operator what a strike WOULD add, because nothing could read back what the account already
 * carried; the weight on the standing card had no visible provenance at all. Now every row that
 * contributes to it is listed, with its weight.
 *
 * Revoked and expired rows are history — neutral tag, muted text, and the date they stopped
 * counting — because only the active set carries weight (`sumActiveStrikeWeight` sums exactly it).
 * Hiding them would make a weight unexplainable, and rendering them as live would overstate the
 * record.
 *
 * A clean record is the common case, so an empty array is a calm statement, never an error. It
 * mirrors `TrustRestrictionList` deliberately: two lists on one tab that behaved differently would
 * be read as two different kinds of fact.
 */
function endDate(strike: AdminStrike, state: StrikeState): ReactNode {
  if (state === 'revoked') {
    // `revokedAt` is non-null whenever the state is 'revoked' — `strikeState` decided that.
    return `Revoked ${formatDateTime(strike.revokedAt ?? strike.createdAt)}`;
  }
  if (strike.expiresAt === null) {
    return 'Never expires';
  }
  return state === 'expired'
    ? `Expired ${formatDateTime(strike.expiresAt)}`
    : `Counts until ${formatDateTime(strike.expiresAt)}`;
}

export interface TrustStrikeListProps {
  strikes: readonly AdminStrike[];
  /**
   * Rendered beside a row that is still counting — the revoke affordance. Absent for a
   * `trust.view`-only operator, who gets the list with no actions rather than a button that would
   * 403. A revoked row never offers it: the server 409s a second revoke.
   */
  renderActions?: (strike: AdminStrike) => ReactNode;
}

export function TrustStrikeList({ strikes, renderActions }: TrustStrikeListProps): ReactElement {
  if (strikes.length === 0) {
    return (
      <EmptyState
        title="No strikes on record"
        description="This account has never been struck. Its active strike weight is 0."
        minHeight={160}
      />
    );
  }

  const now = new Date();
  const rows = sortStrikes(strikes, now);

  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map((strike) => {
        const state = strikeState(strike, now);
        const tag = strikeStateTag(state);
        const historical = state !== 'active';

        return (
          <li key={strike.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm font-medium ${historical ? 'text-ink-muted' : 'text-ink'}`}>
                {strikeSeverityLabel(strike.severity)}
              </span>
              <QTag color={tag.color} size="sm">
                {tag.label}
              </QTag>
              {renderActions !== undefined && state === 'active' ? (
                <span className="ms-auto">{renderActions(strike)}</span>
              ) : null}
            </div>

            <p className={`text-sm ${historical ? 'text-ink-muted' : 'text-ink-secondary'}`}>
              <bdi>{strike.reason}</bdi>
            </p>

            <p className="text-xs text-ink-muted">
              {endDate(strike, state)} · issued {formatDateTime(strike.createdAt)}
              {strike.reportId === null ? '' : ' · from a report'}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
