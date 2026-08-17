import { QCard, QSectionHeader } from '@qalam/ui';
import { ShieldAlert } from 'lucide-react';
import type { ReactElement } from 'react';

import { LoadingState } from '@/components/loading-state';
import { getErrorMessage } from '@/lib/errors';

import { useTrustRestrictions, useTrustSummary } from '../hooks/use-trust';
import { TrustRestrictionList } from './trust-restriction-list';
import { TrustStandingCard } from './trust-standing-card';

/**
 * The Trust & Safety surface for one account (AF6, row A2) — **one panel, two entry points**.
 *
 * It renders as a tab on the user detail drawer (where an operator already suspends the account, so
 * the two sanctions can be told apart side by side) and as the body of the `/trust` route. The
 * second entry point is not a duplicate for its own sake: `/users` sits behind
 * `RequireRole min={Role.Admin}`, while `Role.Moderator` is the role whose grant list explicitly
 * names `trust.view` + `trust.manage` — so a drawer-only surface would be invisible to its primary
 * operator. Same component, same words, same actions, reachable from wherever each audience works.
 *
 * **Two reads, not one, and both are shown.** The standing (`GET users/:id/trust`) carries the
 * ACTIVE restrictions; the list (`GET users/:id/restrictions`) carries active AND historical. They
 * are fetched separately, fail separately, and both are refetched after any mutation.
 *
 * Actions (issue a strike, apply a restriction, lift one) require `trust.manage` and are added by
 * the mutations slice; a `trust.view`-only operator sees this whole panel with no action
 * affordances — not disabled buttons that would 403 on click.
 */
export interface TrustPanelProps {
  userId: string;
  /** False while the tab is not selected, so a closed tab fires no request. */
  active?: boolean;
}

/**
 * Why a trust sanction is not the account suspension on the same screen.
 *
 * Both are called "suspend", they are backed by different tables, and neither implies the other:
 * an account suspension blocks SIGN-IN (`auth.service.ts:123`) and revokes sessions but is invisible
 * to the Policy Engine, while a trust `suspended` restriction denies every policy-gated action
 * (`policy.rules.ts` rule 1) and leaves sign-in working. Shipping two controls that both read as
 * "suspend this person" without saying that is worse than shipping neither.
 */
function SanctionScopeNote(): ReactElement {
  return (
    <QCard as="section" aria-label="How trust sanctions differ" padding="md" className="flex gap-3">
      <ShieldAlert
        size={18}
        strokeWidth={1.75}
        className="mt-0.5 flex-shrink-0 text-info"
        aria-hidden
      />
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-medium text-ink">Trust sanctions are not account suspension.</p>
        <p className="text-ink-secondary">
          What is on this tab decides what the account may <strong>do</strong>: restrictions are
          enforced by the Policy Engine on every action, and a trust &ldquo;Suspended&rdquo;
          restriction still lets the person sign in and read.
        </p>
        <p className="text-ink-secondary">
          <strong>Suspend</strong> in the account actions menu is the other thing: it blocks sign-in
          and revokes every session, and the Policy Engine never sees it. The two are recorded
          separately and lifted separately — lifting one leaves the other in force.
        </p>
      </div>
    </QCard>
  );
}

export function TrustPanel({ userId, active = true }: TrustPanelProps): ReactElement {
  const summary = useTrustSummary(userId, active);
  const restrictions = useTrustRestrictions(userId, active);

  return (
    <div className="flex flex-col gap-5" data-testid="trust-panel">
      <SanctionScopeNote />

      {summary.isLoading ? (
        <LoadingState variant="rows" rows={5} />
      ) : summary.isError ? (
        <p className="text-sm text-danger">{getErrorMessage(summary.error)}</p>
      ) : summary.data !== undefined ? (
        <TrustStandingCard summary={summary.data} />
      ) : null}

      <QCard as="section" padding="md" className="flex flex-col gap-3">
        <QSectionHeader
          title="Restrictions"
          description="Everything ever applied to this account — lifted and expired rows are history, not live sanctions."
        />
        {restrictions.isLoading ? (
          <LoadingState variant="rows" rows={3} />
        ) : restrictions.isError ? (
          <p className="text-sm text-danger">{getErrorMessage(restrictions.error)}</p>
        ) : (
          <TrustRestrictionList restrictions={restrictions.data ?? []} />
        )}
      </QCard>
    </div>
  );
}
