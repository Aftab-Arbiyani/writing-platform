import { PolicyEffect, type PolicyActionCode } from '@qalam/shared';
import { QCard, QTag } from '@qalam/ui';
import { ShieldAlert } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { formatDate } from '@/lib/format';

import { useCapability } from '../hooks/use-capabilities';
import {
  activeRestrictions,
  isMuted,
  isReadOnly,
  isSuspended,
  useMyTrust,
} from '../hooks/use-trust';
import {
  restrictionScopeLabel,
  restrictionTypeLabel,
  trustStatusLabel,
} from '../lib/publishing-labels';
import type { TrustSummary } from '../types/collaboration.types';

/**
 * The restricted-state wall (AF6, W3c — docs/49 §3, §5).
 *
 * **Rendered where an effect demands it, not by intercepting the router.** That is the design's
 * shape ("rendered wherever an effect demands"), and web's own routing agrees with it: the guard
 * tree is `RequireAuth` around a session tri-state, and putting an async trust read in front of
 * every navigation would add a blocking request to each route change to answer a question only a
 * handful of surfaces ask. Mobile reached the same conclusion from a different constraint — its
 * `guardRedirect` is pure and synchronous — so both clients wall at the surface rather than the
 * route, for reasons of their own rather than by copying.
 *
 * **The trigger is the server's `effect`, never a locally-derived one.** A plain `deny` means "not
 * your story" and is handled by `CapabilityGate` rendering nothing; the effects below mean "your
 * account is limited", which is a different sentence and deserves an explanation. `GET /me/trust`
 * supplies the detail — status, and which restrictions are in force — so the wall says what happened
 * rather than just refusing.
 *
 * **Fails open.** No capability, no restrictive effect, or a trust read that failed → renders
 * `children` untouched. Telling someone in good standing that they are limited is worse than
 * briefly not telling someone who is; the server refuses the write either way.
 */
const RESTRICTIVE_EFFECTS: readonly PolicyEffect[] = [
  PolicyEffect.ReadOnly,
  PolicyEffect.Muted,
  PolicyEffect.Suspended,
  PolicyEffect.Blocked,
  PolicyEffect.TemporaryRestriction,
];

export interface RestrictedWallProps {
  storyId: string;
  /** The action whose decision decides whether this surface is walled. */
  action: PolicyActionCode | string;
  children: ReactNode;
}

/** The headline for a standing, most severe first. Falls back to the neutral wording. */
function copyFor(trust: TrustSummary | undefined): { title: string; body: string } {
  if (isSuspended(trust)) {
    return {
      title: 'Your account is suspended',
      body: 'Writing, commenting and publishing are unavailable while your account is suspended.',
    };
  }
  if (isReadOnly(trust)) {
    return {
      title: 'Your account is read-only',
      body: 'You can read everything as usual. Writing, commenting and publishing are paused.',
    };
  }
  if (isMuted(trust)) {
    return {
      title: 'Your account is muted',
      body: 'Your comments and posts are limited in visibility right now.',
    };
  }
  return {
    title: 'Your account is limited',
    body: 'Some actions are temporarily restricted.',
  };
}

export function RestrictedWall({ storyId, action, children }: RestrictedWallProps): ReactElement {
  const { find } = useCapability(storyId);
  const decision = find(action);
  const restrictive =
    decision !== undefined && RESTRICTIVE_EFFECTS.includes(decision.effect as PolicyEffect);

  // Only fetched when a restrictive effect has actually been seen — a healthy viewer never pays for
  // this request.
  const trust = useMyTrust(restrictive);

  if (!restrictive) return <>{children}</>;

  const copy = copyFor(trust.data);
  const restrictions = activeRestrictions(trust.data);

  return (
    <QCard as="section" aria-labelledby="restricted-heading">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="text-danger mt-0.5 shrink-0" size={20} aria-hidden />
          <div className="flex flex-col gap-1">
            <h2 id="restricted-heading" className="text-ink text-base font-semibold">
              {copy.title}
            </h2>
            <p className="text-ink-secondary text-sm">{copy.body}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-muted">Standing</span>
          {trust.data ? (
            <QTag color="danger" size="sm">
              {trustStatusLabel(trust.data.status)}
            </QTag>
          ) : (
            // The wall stands on the capability decision alone; the trust read only enriches it, so
            // a failed or pending read degrades to the server's own reason rather than hiding it.
            <QTag color="neutral" size="sm">
              {decision.reason}
            </QTag>
          )}
        </div>

        {restrictions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-ink-secondary text-sm font-medium">In force</h3>
            <ul className="divide-line flex flex-col divide-y">
              {restrictions.map((restriction) => (
                <li key={restriction.id} className="flex flex-col gap-1 py-2">
                  <p className="text-ink text-sm font-medium">
                    {restrictionTypeLabel(restriction.type)}
                    <span className="text-ink-muted font-normal">
                      {' · '}
                      {restrictionScopeLabel(restriction.scope)}
                    </span>
                  </p>
                  {restriction.reason ? (
                    <p className="text-ink-secondary text-sm">
                      <bdi>{restriction.reason}</bdi>
                    </p>
                  ) : null}
                  <p className="text-ink-muted text-xs">
                    {restriction.expiresAt === null
                      ? 'No end date'
                      : `Until ${formatDate(restriction.expiresAt)}`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </QCard>
  );
}
