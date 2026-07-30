import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { formatReadingTime } from '@/lib/format';
import { piecePath } from '@/lib/routes';

import type { RelatedPiece } from '../types/reading.types';

/**
 * "More like this" (W1, docs/45 §4.1) — up to four pieces sharing this one's first tag.
 *
 * A compact link list, deliberately **not** the feed's `PieceCard`: that component belongs to
 * `features/feed` and a feature may never import another feature (docs/26 §4). It also renders
 * as `role="article"`, which on this page would compete with the piece itself for the article
 * landmark a reader (and the reader e2e spec) navigates by.
 *
 * Renders nothing at all when there is nothing to suggest — an empty "related" heading is worse
 * than no section.
 */
export function RelatedPieces({ pieces }: { pieces: RelatedPiece[] }): ReactElement | null {
  if (pieces.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="flex flex-col gap-3">
      <h2
        id="related-heading"
        className="text-sm font-medium uppercase tracking-wide text-ink-muted"
      >
        More like this
      </h2>
      <ul className="flex flex-col gap-3">
        {pieces.map((piece) => {
          const dir = piece.language?.direction === 'rtl' ? 'rtl' : 'ltr';
          const author = piece.author.penName ?? `@${piece.author.username}`;
          return (
            <li key={piece.id} className="border-line border-t pt-3 first:border-t-0 first:pt-0">
              <Link
                to={piecePath(piece.slug ?? piece.id)}
                className="font-serif text-lg text-ink hover:underline"
                dir={dir}
              >
                {piece.title}
              </Link>
              <p className="mt-1 text-sm text-ink-muted">
                <bdi>{author}</bdi>
                <span aria-hidden> · </span>
                {formatReadingTime(piece.readingTimeSeconds)}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
