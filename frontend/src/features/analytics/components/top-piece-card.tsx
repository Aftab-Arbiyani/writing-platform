import { QCard } from '@qalam/ui';
import { Trophy } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { formatCount } from '@/lib/format';
import { pieceStatsPath } from '@/lib/routes';

import type { MostPopularPiece } from '../types/analytics.types';

/**
 * The "top performer" highlight (docs: Top Performing Pieces) — the writer's most-viewed piece from
 * the `/analytics/me` aggregate (real, by views). Distinct from the "latest published" table; links
 * to the piece's full analytics.
 */
export function TopPieceCard({ piece }: { piece: MostPopularPiece }): ReactElement {
  return (
    <QCard padding="lg" className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
        <Trophy size={14} strokeWidth={1.75} aria-hidden />
        Top performer
      </span>
      <h3 className="font-serif text-lg font-semibold leading-snug text-ink">
        <Link
          to={pieceStatsPath(piece.pieceId)}
          dir="auto"
          className="hover:text-accent hover:underline"
        >
          {piece.title || 'Untitled'}
        </Link>
      </h3>
      <p className="text-sm text-ink-secondary">
        <span className="font-semibold tabular-nums text-ink">{formatCount(piece.views)}</span>{' '}
        views
      </p>
    </QCard>
  );
}
