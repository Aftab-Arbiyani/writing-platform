import { QButton, QCard } from '@qalam/ui';
import { Lock } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/lib/routes';

import type { PieceAllowanceNotice } from '../lib/piece-allowance';

/** The id the create affordance points `aria-describedby` at, so "why is this off" is announced. */
export const PIECE_LIMIT_NOTICE_ID = 'piece-limit-notice';

/**
 * The author is at (or past) their plan's piece cap (B4, docs/45 §4.9).
 *
 * Follows the shape W4 established for a premium refusal — say what happened in the server's own
 * terms, then offer the action that actually helps — but is built from `@qalam/ui` primitives here
 * rather than importing monetization's `FeatureLockCard`, because a feature may not import another
 * feature (docs/26 §4). It is a lock in kind, not in code.
 *
 * **It is rendered instead of nothing, and beside a create control that is visibly disabled rather
 * than hidden.** An affordance that quietly disappears is mobile's C-1 defect; one that stays live
 * and 402s is W3c-1. This is the third option: still there, plainly off, and explained.
 */
export function PieceLimitNotice({
  notice,
}: {
  notice: PieceAllowanceNotice;
}): ReactElement | null {
  const navigate = useNavigate();
  if (!notice.blocked) return null;

  return (
    <QCard as="section" className="border-transparent bg-warning/12 text-warning-on-tint">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/*
         * `role="status"`, not `alert`: it is part of the page on arrival, and an alert that fires
         * on every dashboard visit is one a screen-reader user learns to ignore.
         */}
        <p role="status" className="flex items-start gap-3 text-sm">
          <Lock size={18} className="mt-px shrink-0" aria-hidden />
          <span>
            <span className="font-medium">{notice.headline}</span>{' '}
            <span id={PIECE_LIMIT_NOTICE_ID}>{notice.description}</span>
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
 * "24 of 25 pieces", beside the create action — the count BEFORE it bites, which is the whole
 * point of surfacing it (docs/45 §4.9). Renders nothing on an unlimited plan, where there is no
 * number worth counting down.
 */
export function PieceAllowanceCount({
  notice,
}: {
  notice: PieceAllowanceNotice;
}): ReactElement | null {
  if (notice.countLabel === null) return null;
  return (
    <span
      // `text-warning` rather than the `-on-tint` pairing used inside the card: this sits on the
      // page background, not on a tinted surface, and the two are not interchangeable.
      className={`text-xs tabular-nums ${notice.blocked ? 'text-warning' : 'text-ink-muted'}`}
    >
      {notice.countLabel}
    </span>
  );
}
