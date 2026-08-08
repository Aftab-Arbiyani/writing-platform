import type { StorySnapshotHistory } from '../types/collaboration.types';

/**
 * What to say about a story's version-history depth (B7, docs/45 §4.12).
 *
 * Pure, so the wording and the thresholds are testable without a DOM — the same split B4's
 * `piece-allowance.ts` and B6's `collaborator-allowance.ts` use.
 */
export interface SnapshotHistoryNotice {
  /** "5 of 32 versions" — the count line. Null when nothing is being withheld. */
  countLabel: string | null;
  /** True once older versions exist but are not shown. */
  limited: boolean;
  /** Heading for the upsell state. Null when not limited. */
  headline: string | null;
  /** Body — says plainly that nothing was deleted. Null when not limited. */
  description: string | null;
}

const NOT_LIMITED = { limited: false, headline: null, description: null };

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * **`unlimited` is the test for "no cap", not `limit === 0`** — but for the ordinary reason, and
 * this key is on the ordinary convention. `maxSnapshotHistory` uses `0` = unlimited like
 * `maxPieces`; B6's seats are the one inverted key in the product. Reading the server's boolean
 * keeps this correct either way and means the sentinel is decided in exactly one place, the server.
 *
 * Only one blocked state, and it is not really "blocked": the versions exist, they are stored, and
 * a bigger plan shows them again **retroactively** — so the sentence is an offer, not an error and
 * not a deletion notice. It never says "try again later" (the W4 remedy conflation, docs/48 §3.6);
 * nothing here resets and waiting achieves nothing.
 *
 * The count is withheld only when there is nothing to withhold: a story whose whole history fits
 * inside the plan gets no count line, because "3 of 3 versions" is noise on a page that already
 * lists three rows.
 */
export function resolveSnapshotHistoryNotice(
  history: StorySnapshotHistory | undefined,
): SnapshotHistoryNotice {
  if (history === undefined || history.unlimited || history.hidden <= 0) {
    return { countLabel: null, ...NOT_LIMITED };
  }

  return {
    countLabel: `${history.visible} of ${plural(history.total, 'version')}`,
    limited: true,
    headline: `${plural(history.hidden, 'older version')} ${history.hidden === 1 ? 'is' : 'are'} saved but not shown.`,
    description:
      `Your plan shows the ${history.limit} most recent versions of a story. ` +
      'Nothing was deleted — the older ones come back, and stay revertible, the moment you move ' +
      'to a larger plan.',
  };
}
