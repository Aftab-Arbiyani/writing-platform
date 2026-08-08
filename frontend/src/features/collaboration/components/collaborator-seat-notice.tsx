import { QButton, QCard } from '@qalam/ui';
import { Lock, Sparkles } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/lib/routes';

import type { CollaboratorAllowanceNotice } from '../lib/collaborator-allowance';

/** The id the invite affordance points `aria-describedby` at, so "why is this off" is announced. */
export const COLLABORATOR_SEAT_NOTICE_ID = 'collaborator-seat-notice';

/**
 * The story is at (or has no) collaborator seats on its owner's plan (B6, docs/45 §4.11).
 *
 * Follows B4's `PieceLimitNotice` shape rather than importing it — a feature may not import another
 * feature (docs/26 §4), and the two say different things anyway. Built from `@qalam/ui` primitives
 * for the same reason the piece notice is: monetization's `FeatureLockCard` lives in another
 * feature. It is a lock in kind, not in code.
 *
 * **Rendered beside an invite control that stays visible and is plainly disabled.** A control that
 * silently disappears is mobile's C-1 defect; one that stays live and 402s is W3c-1. This is the
 * third option: still there, off, and explained — and for a free author the explanation is what
 * collaboration IS, since they have never been able to see it work.
 *
 * The tint differs by state on purpose: `free` is an offer (accent), the other two are a limit
 * being hit (warning). Both pairings are token-based, so they carry their own contrast in light
 * and dark; neither hard-codes a colour.
 */
export function CollaboratorSeatNotice({
  notice,
}: {
  notice: CollaboratorAllowanceNotice;
}): ReactElement | null {
  const navigate = useNavigate();
  if (!notice.blocked) return null;

  const Icon = notice.free ? Sparkles : Lock;

  return (
    <QCard
      as="section"
      className={
        notice.free
          ? 'border-transparent bg-accent/12 text-accent-on-tint'
          : 'border-transparent bg-warning/12 text-warning-on-tint'
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/*
         * `role="status"`, not `alert`: it is part of the page on arrival, and an alert that fires
         * on every visit to the collaborators page is one a screen-reader user learns to ignore.
         */}
        <p role="status" className="flex items-start gap-3 text-sm">
          <Icon size={18} className="mt-px shrink-0" aria-hidden />
          <span>
            <span className="font-medium">{notice.headline}</span>{' '}
            <span id={COLLABORATOR_SEAT_NOTICE_ID}>{notice.description}</span>
          </span>
        </p>
        <QButton
          variant="secondary"
          size="sm"
          className="shrink-0 self-start"
          onClick={() => {
            void navigate(ROUTES.settingsBillingPlans);
          }}
        >
          See plans
        </QButton>
      </div>
    </QCard>
  );
}

/**
 * "2 of 3 collaborators", beside the invite action — the count BEFORE it bites, which is the whole
 * point of surfacing it (docs/45 §4.11). Renders nothing on an unlimited plan, where a number that
 * never approaches anything is not information.
 *
 * The pending part is called out separately because it explains a discrepancy the roster cannot:
 * a story showing two collaborators can still be full if a third invitation is unanswered.
 */
export function CollaboratorSeatCount({
  notice,
}: {
  notice: CollaboratorAllowanceNotice;
}): ReactElement | null {
  if (notice.countLabel === null) return null;
  return (
    <span
      // `text-warning` rather than the `-on-tint` pairing used inside the card: this sits on the
      // page background, not on a tinted surface, and the two are not interchangeable.
      className={`text-xs tabular-nums ${notice.blocked ? 'text-warning' : 'text-ink-muted'}`}
    >
      {notice.countLabel}
      {notice.pendingLabel === null ? null : (
        <span className="text-ink-muted"> · {notice.pendingLabel}</span>
      )}
    </span>
  );
}
