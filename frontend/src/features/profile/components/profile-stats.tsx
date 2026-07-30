import type { ReactElement } from 'react';

import { formatCount } from '@/lib/format';
import type { ProfileCounts } from '@/types/profile';

/**
 * The profile stat line: pieces · followers · following (docs/06 §3.5). Only the three REAL
 * counts are shown — the `totalReads/likes/claps/bookmarks/responses` fields are hardcoded `0`
 * server-side pending later epics (docs/26 §11 gap #3) and are deliberately omitted, never shown
 * as misleading zeros. Followers/Following are buttons that open the connections dialog. Counts
 * use Latin digits + `tabular-nums` (docs/06 §6.5).
 */
export function ProfileStats({
  counts,
  onOpenFollowers,
  onOpenFollowing,
  interactive = true,
}: {
  counts: ProfileCounts;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  /** When false (private account viewed by a stranger), counts are static — the lists 403. */
  interactive?: boolean;
}): ReactElement {
  const followersLabel = counts.followers === 1 ? 'follower' : 'followers';
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-secondary">
      <li>
        <span className="font-semibold text-ink tabular-nums">
          {formatCount(counts.piecesPublished)}
        </span>{' '}
        {counts.piecesPublished === 1 ? 'piece' : 'pieces'}
      </li>
      <li>
        {interactive ? (
          <button
            type="button"
            onClick={onOpenFollowers}
            className="rounded-sm outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="font-semibold text-ink tabular-nums">
              {formatCount(counts.followers)}
            </span>{' '}
            {followersLabel}
          </button>
        ) : (
          <span>
            <span className="font-semibold text-ink tabular-nums">
              {formatCount(counts.followers)}
            </span>{' '}
            {followersLabel}
          </span>
        )}
      </li>
      <li>
        {interactive ? (
          <button
            type="button"
            onClick={onOpenFollowing}
            className="rounded-sm outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="font-semibold text-ink tabular-nums">
              {formatCount(counts.following)}
            </span>{' '}
            following
          </button>
        ) : (
          <span>
            <span className="font-semibold text-ink tabular-nums">
              {formatCount(counts.following)}
            </span>{' '}
            following
          </span>
        )}
      </li>
    </ul>
  );
}
