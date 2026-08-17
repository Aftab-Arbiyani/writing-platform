import { QTag } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

import { EmptyState } from '@/components/empty-state';
import { formatDateTime } from '@/lib/format';

import {
  restrictionState,
  restrictionStateTag,
  sortRestrictions,
  type RestrictionState,
} from '../lib/trust-standing';
import {
  restrictionEffect,
  restrictionScopeLabel,
  restrictionTypeLabel,
} from '../lib/trust-labels';
import type { AdminRestriction } from '../types/trust.types';

/**
 * A user's restrictions (`GET /admin/users/:id/restrictions`) — **active AND historical in one
 * array**, which is the whole difficulty of this list.
 *
 * A lifted restriction (`liftedAt` set) and an expired one (`expiresAt` in the past) are history:
 * they carry a neutral tag, muted text, and the date they stopped applying, so neither can be read
 * as a live sanction. Only a row that is genuinely in force gets the danger tag and the word both
 * customer clients use for it — "In force".
 *
 * A clean record is the COMMON case, so an empty array renders as a calm statement, never an error.
 */
function endDate(restriction: AdminRestriction, state: RestrictionState): ReactNode {
  if (state === 'lifted') {
    // `liftedAt` is non-null whenever the state is 'lifted' — `restrictionState` decided that.
    return `Lifted ${formatDateTime(restriction.liftedAt ?? restriction.createdAt)}`;
  }
  if (restriction.expiresAt === null) {
    // The wording both clients use for a restriction with no expiry.
    return 'No end date';
  }
  return state === 'expired'
    ? `Expired ${formatDateTime(restriction.expiresAt)}`
    : `Until ${formatDateTime(restriction.expiresAt)}`;
}

export interface TrustRestrictionListProps {
  restrictions: readonly AdminRestriction[];
  /**
   * Rendered beside a row that is still in force — the lift affordance. Absent for a
   * `trust.view`-only operator, who gets the list with no actions at all rather than buttons that
   * would 403.
   */
  renderActions?: (restriction: AdminRestriction) => ReactNode;
}

export function TrustRestrictionList({
  restrictions,
  renderActions,
}: TrustRestrictionListProps): ReactElement {
  if (restrictions.length === 0) {
    return (
      <EmptyState
        title="No restrictions on record"
        description="This account has never been restricted. Nothing is wrong."
        minHeight={160}
      />
    );
  }

  const now = new Date();
  const rows = sortRestrictions(restrictions, now);

  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map((restriction) => {
        const state = restrictionState(restriction, now);
        const tag = restrictionStateTag(state);
        const historical = state !== 'active';
        const effect = restrictionEffect(restriction.type);

        return (
          <li key={restriction.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm font-medium ${historical ? 'text-ink-muted' : 'text-ink'}`}>
                {restrictionTypeLabel(restriction.type)}
                <span className="font-normal text-ink-muted">
                  {' · '}
                  {restrictionScopeLabel(restriction.scope)}
                </span>
              </span>
              <QTag color={tag.color} size="sm">
                {tag.label}
              </QTag>
              {renderActions !== undefined && state === 'active' ? (
                <span className="ms-auto">{renderActions(restriction)}</span>
              ) : null}
            </div>

            {effect !== undefined && !historical ? (
              <p className="text-xs text-ink-secondary">{effect}</p>
            ) : null}

            <p className={`text-sm ${historical ? 'text-ink-muted' : 'text-ink-secondary'}`}>
              <bdi>{restriction.reason}</bdi>
            </p>

            <p className="text-xs text-ink-muted">
              {endDate(restriction, state)} · applied {formatDateTime(restriction.createdAt)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
