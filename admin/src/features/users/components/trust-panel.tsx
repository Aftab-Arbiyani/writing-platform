import { PERMISSIONS } from '@qalam/shared';
import { QCard, QSectionHeader } from '@qalam/ui';
import { ShieldAlert } from 'lucide-react';
import type { ReactElement } from 'react';

import { LoadingState } from '@/components/loading-state';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/errors';

import { useTrustRestrictions, useTrustStrikes, useTrustSummary } from '../hooks/use-trust';
import { countedStrikeWeight } from '../lib/trust-standing';
import { TrustLiftButton } from './trust-lift-button';
import { TrustRestrictForm } from './trust-restrict-form';
import { TrustRestrictionList } from './trust-restriction-list';
import { TrustRevokeStrikeButton } from './trust-revoke-strike-button';
import { TrustStandingCard } from './trust-standing-card';
import { TrustStrikeForm } from './trust-strike-form';
import { TrustStrikeList } from './trust-strike-list';

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
 * **The two permissions are gated separately, because the server checks them separately.** The reads
 * carry `trust.view`, the three mutations `trust.manage`. A viewer with only `trust.view` gets this
 * whole panel — standing, history, everything — with NO action affordances: no forms, no lift
 * buttons, not disabled buttons that would 403 on click. No seeded role is in that state today
 * (`Role.Moderator` upward all hold `trust.*`), but `role_permissions` is editable at runtime, so
 * the branch is real and is written rather than collapsed into one check.
 */
export interface TrustPanelProps {
  userId: string;
  /** False while the tab is not selected, so a closed tab fires no request. */
  active?: boolean;
}

/**
 * Why a trust sanction is not the account suspension on the same screen.
 *
 * Both are called "suspend", they are backed by different tables, and neither implies the other. A
 * trust `suspended` restriction denies every policy-gated action and leaves sign-in working; an
 * account suspension blocks SIGN-IN (`auth.service.ts:123`) and revokes every session.
 *
 * **One clause of this note used to be wrong and B9 corrected it.** It said the Policy Engine never
 * sees an account suspension, which was true and was also the A2-1 defect: a closed account read as
 * being in good standing for every decision. The engine now reads `users.status`
 * (`AccountStatusService`), so an account suspension refuses policy-gated actions too — the
 * remaining difference is the direction that is still deliberately one-way, and that is what the
 * note now says.
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
          <strong>Suspend</strong> in the account actions menu goes further: it blocks sign-in,
          revokes every session, <em>and</em> the Policy Engine refuses anything a live token could
          still reach. It writes no trust restriction, so the standing below can read perfectly
          clean for an account that is closed — the badge on the standing card says when that is the
          case.
        </p>
        <p className="text-ink-secondary">
          The two are recorded and lifted separately, and lifting one leaves the other in force.
        </p>
      </div>
    </QCard>
  );
}

export function TrustPanel({ userId, active = true }: TrustPanelProps): ReactElement {
  const { can } = usePermissions();
  const summary = useTrustSummary(userId, active);
  const restrictions = useTrustRestrictions(userId, active);
  const strikes = useTrustStrikes(userId, active);
  const canManage = can(PERMISSIONS.TrustManage);

  // A global restriction in force is what a revoke does NOT lift, so the revoke confirmation has to
  // know. Read from the standing, which carries the ACTIVE rows.
  const restrictionInForce = (summary.data?.restrictions.length ?? 0) > 0;
  // Only computed when the list actually arrived: 0 from a failed or pending read would read as a
  // disagreement with the standing and print a discrepancy note about nothing.
  const countedWeight = strikes.data === undefined ? undefined : countedStrikeWeight(strikes.data);

  return (
    <div className="flex flex-col gap-5" data-testid="trust-panel">
      <SanctionScopeNote />

      {summary.isLoading ? (
        <LoadingState variant="rows" rows={5} />
      ) : summary.isError ? (
        <p className="text-sm text-danger">{getErrorMessage(summary.error)}</p>
      ) : summary.data !== undefined ? (
        <TrustStandingCard summary={summary.data} countedWeight={countedWeight} />
      ) : null}

      <QCard as="section" padding="md" className="flex flex-col gap-3">
        <QSectionHeader
          title="Strikes"
          description="Every strike ever issued. Only the ones still counting contribute to the weight above; revoking is the only thing that lowers it."
        />
        {strikes.isLoading ? (
          <LoadingState variant="rows" rows={3} />
        ) : strikes.isError ? (
          <p className="text-sm text-danger">{getErrorMessage(strikes.error)}</p>
        ) : (
          <TrustStrikeList
            strikes={strikes.data ?? []}
            // Revoke is offered per row and only on rows still counting — the list decides which.
            // Without `trust.manage` no `renderActions` is passed at all, exactly as for the lift.
            renderActions={
              canManage && summary.data !== undefined
                ? (strike) => (
                    <TrustRevokeStrikeButton
                      strike={strike}
                      activeStrikeWeight={summary.data.activeStrikeWeight}
                      restrictionInForce={restrictionInForce}
                    />
                  )
                : undefined
            }
          />
        )}
      </QCard>

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
          <TrustRestrictionList
            restrictions={restrictions.data ?? []}
            // Lift is offered per row, and only on rows still in force — the list decides which
            // those are. Without `trust.manage` no `renderActions` is passed at all, so the rows
            // render exactly as they do for a read-only viewer.
            renderActions={
              canManage ? (restriction) => <TrustLiftButton restriction={restriction} /> : undefined
            }
          />
        )}
      </QCard>

      {/*
        The two write forms need the standing to say anything honest — the strike form's escalation
        projection is built from the current active weight and the active restrictions — so they wait
        for it rather than guessing from zero.
      */}
      {canManage && summary.data !== undefined ? (
        <>
          <TrustStrikeForm
            userId={userId}
            activeStrikeWeight={summary.data.activeStrikeWeight}
            activeRestrictions={summary.data.restrictions}
          />
          <TrustRestrictForm userId={userId} />
        </>
      ) : null}
    </div>
  );
}
