import { MAX_CLAPS_PER_USER_PER_PIECE } from '@qalam/shared';
import { QButton } from '@qalam/ui';
import { Hand } from 'lucide-react';
import type { ReactElement } from 'react';

import { formatCount } from '@/lib/format';

import { useClaps } from '../hooks/use-claps';
import type { PieceEngagement } from '../types/reading.types';

/**
 * The clap control (W7b, docs/45 §4.4) — click to add, click again to add again, up to
 * `MAX_CLAPS_PER_USER_PER_PIECE`. The batching, capping and optimism all live in `use-claps`; this
 * is the surface.
 *
 * **What it shows and why.** The prominent number is the PIECE total, because that is what a reader
 * arriving cold wants to know. The reader's own contribution rides in a quiet suffix and in the
 * accessible name, because a bare "50" beside the button does not say whose 50 it is.
 *
 * **At the cap the button goes inert rather than hidden or refused.** It is `disabled` with a name
 * that says why, so a reader who hammers a maxed-out button meets no error and no phantom
 * increment — the two failures this row names. Disabled-and-explained is the house pattern (C-1:
 * not hidden; W3c-1: not live-and-refused).
 *
 * **Removal is a separate, honestly-labelled control.** `DELETE` takes ALL of this viewer's claps
 * and there is no decrement endpoint, so there is no "−1" to build: the second button reads
 * "Remove my N claps" and means exactly that. It appears only once the reader has some.
 *
 * **Counts are public; acting is not.** A signed-out reader sees both numbers and is routed to
 * sign-in on click, by the same `returnTo` path like and bookmark already use.
 */
export function ClapButton({
  pieceId,
  engagement,
  authed,
  onRequireAuth,
}: {
  pieceId: string;
  engagement: PieceEngagement | undefined;
  authed: boolean;
  /** Where a signed-out reader goes instead of clapping — the bar owns the route, not this. */
  onRequireAuth: () => void;
}): ReactElement {
  const { viewerClaps, totalClaps, atCap, isBusy, clap, removeClaps } = useClaps(
    pieceId,
    engagement,
  );

  const mine = authed && viewerClaps > 0;
  const label = !authed
    ? 'Clap for this piece'
    : atCap
      ? `You’ve given all ${String(MAX_CLAPS_PER_USER_PER_PIECE)} claps`
      : mine
        ? `Clap for this piece (you’ve given ${String(viewerClaps)})`
        : 'Clap for this piece';

  return (
    <span className="inline-flex items-center gap-1">
      <QButton
        variant="ghost"
        size="sm"
        icon={Hand}
        // Deliberately never `loading`: a burst must stay clickable, and a control that went busy
        // mid-gesture would swallow the very clicks the batching exists to collect.
        aria-label={label}
        disabled={authed && atCap}
        className={mine ? 'text-accent' : 'text-ink-muted'}
        onClick={() => {
          if (!authed) {
            onRequireAuth();
            return;
          }
          clap();
        }}
      >
        <span className="tabular-nums">{formatCount(totalClaps)}</span>
        {mine ? (
          <span className="text-ink-muted ms-1 text-xs tabular-nums">
            · you {formatCount(viewerClaps)}
          </span>
        ) : null}
      </QButton>

      {mine ? (
        <QButton
          variant="ghost"
          size="sm"
          loading={isBusy}
          aria-label={`Remove my ${String(viewerClaps)} claps`}
          className="text-ink-muted"
          onClick={removeClaps}
        >
          <span aria-hidden>Undo</span>
        </QButton>
      ) : null}
    </span>
  );
}
