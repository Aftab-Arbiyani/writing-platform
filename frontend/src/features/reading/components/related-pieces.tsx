import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { formatReadingTime } from '@/lib/format';
import { piecePath } from '@/lib/routes';

import type { RelatedSuggestion } from '../hooks/use-related-pieces';

/**
 * "More like this" (W1 §4.1, upgraded in W5) — up to four pieces to read next.
 *
 * The items come from the AF4 recommender for a signed-in reader and from a tag search otherwise
 * (`useRelatedPieces` decides). When an item carries a `reason`, it is rendered: a recommendation
 * that does not say why it was recommended is just a list, and AF4's whole design law is that every
 * result explains itself. The tag-search fallback has no reason to give and shows none.
 *
 * A compact link list, deliberately **not** the feed's `PieceCard`: that component belongs to
 * `features/feed` and a feature may never import another feature (docs/26 §4). It also renders
 * as `role="article"`, which on this page would compete with the piece itself for the article
 * landmark a reader (and the reader e2e spec) navigates by.
 *
 * Renders nothing at all when there is nothing to suggest — an empty "related" heading is worse
 * than no section.
 */
export function RelatedPieces({ pieces }: { pieces: RelatedSuggestion[] }): ReactElement | null {
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
                {piece.readingTimeSeconds > 0 ? (
                  <>
                    <span aria-hidden> · </span>
                    {formatReadingTime(piece.readingTimeSeconds)}
                  </>
                ) : null}
              </p>
              {piece.reason !== '' ? (
                <p className="mt-1 text-sm text-ink-secondary">{piece.reason}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
