import { QErrorState, QSkeleton } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { PieceConversation } from '@/components/conversation';
import { Seo } from '@/components/seo';
import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId, isApiError } from '@/lib/errors';
import { formatDate, formatReadingTime } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { piecePath, profilePath, ROUTES } from '@/lib/routes';

import { ContentRenderer } from '../components/content-renderer';
import { ReaderActionBar } from '../components/reader-action-bar';
import { ReaderAuthorCard } from '../components/reader-author-card';
import { ReaderSettings } from '../components/reader-settings';
import { RelatedPieces } from '../components/related-pieces';
import { usePiece, usePieceEngagement } from '../hooks/use-piece';
import { useRelatedPieces } from '../hooks/use-related-pieces';
import { COLUMN_WIDTH_PX, useReaderPreferences } from '../stores/reader-preferences.store';

/**
 * The reading view (W1, docs/45 §4.1) — `/p/:slug`, the surface the whole product points at.
 * Public with optional auth: an anonymous reader gets the piece and real engagement counts; the
 * author additionally sees their own unpublished work here (the server decides, not the client).
 *
 * The URL normally carries a slug, so this loads through the additive `GET /pieces/by-slug/:slug`
 * (docs/45 §3) rather than the UUID-only id route — a reader arriving from a link, a search
 * result, or a notification has no id. `usePiece` sniffs the identifier and falls back to the id
 * route for the one case that produces one: an unpublished piece, which has no slug yet and which
 * only its author can open.
 *
 * Reading is the one surface where typography is the product: the article renders through the
 * shared `.qalam-prose` class (identical to the editor's), and both `dir` and leading come from
 * the piece's own language so Urdu/Nastaliq reads correctly rather than being force-fit to LTR.
 */
/**
 * The reading column. Its width is a reader preference (narrow / medium / wide), so it is a
 * style rather than a `max-w-*` class — Tailwind cannot generate a class per runtime value.
 */
function Column({
  children,
  className = '',
  maxWidth,
}: {
  children: ReactNode;
  className?: string;
  maxWidth: number;
}): ReactElement {
  return (
    <div
      className={`mx-auto w-full px-4 sm:px-6 ${className}`}
      style={{ maxWidth: `${String(maxWidth)}px` }}
    >
      {children}
    </div>
  );
}

export function PiecePage(): ReactElement {
  const { slug } = useParams<{ slug: string }>();
  const query = usePiece(slug);
  const piece = query.data;
  const engagement = usePieceEngagement(piece?.id);
  const related = useRelatedPieces(piece);
  const maxWidth = COLUMN_WIDTH_PX[useReaderPreferences((s) => s.width)];

  usePageTitle(piece?.title ?? 'Reading');

  if (query.isLoading) {
    return (
      <article
        className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-6"
        role="status"
        aria-busy="true"
        aria-label="Loading piece"
      >
        <QSkeleton variant="title" width="80%" />
        <QSkeleton variant="text" lines={1} width="50%" className="mt-4" />
        <QSkeleton variant="text" lines={12} className="mt-10" />
      </article>
    );
  }

  if (query.isError || !piece) {
    const notFound = isApiError(query.error) && query.error.status === 404;
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 py-12 sm:px-6">
        <QErrorState
          title={notFound ? 'This piece isn’t here.' : 'Couldn’t load this piece.'}
          description={
            notFound
              ? 'It may have been unpublished, removed, or the link may be wrong.'
              : getErrorMessage(query.error)
          }
          requestId={getRequestId(query.error)}
          onRetry={
            notFound
              ? undefined
              : () => {
                  void query.refetch();
                }
          }
        />
        {notFound ? (
          <p className="mt-6 text-center">
            <Link to={ROUTES.feed} className="text-accent hover:underline">
              Back to the feed
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  const { author, language, genre } = piece;
  const displayName = author.penName ?? `@${author.username}`;
  const dir = language?.direction === 'rtl' ? 'rtl' : 'ltr';
  const cover = mediaUrl(piece.coverImageKey);
  // Unlisted/private pieces and drafts (author preview) must never be indexed.
  const indexable = piece.status === 'published' && piece.visibility === 'public';
  // The canonical link: what `Seo` declares, what Share copies, and where sign-in returns to.
  const canonicalPath = piecePath(piece.slug ?? piece.id);
  const canonicalUrl = new URL(canonicalPath, window.location.origin).toString();

  return (
    <article className="pb-16">
      <Seo
        title={piece.title}
        description={piece.subtitle ?? piece.featuredQuote ?? `${piece.title} by ${displayName}`}
        canonicalPath={canonicalPath}
        image={cover}
        type="article"
        noindex={!indexable}
      />

      {cover ? (
        <img
          src={cover}
          alt=""
          className="mb-8 max-h-[420px] w-full object-cover"
          // The cover is decorative here: the title immediately follows it.
          aria-hidden
        />
      ) : null}

      <Column maxWidth={maxWidth}>
        <header>
          <h1 className="font-serif text-4xl font-semibold leading-tight text-ink" dir={dir}>
            {piece.title}
          </h1>
          {piece.subtitle ? (
            <p className="mt-3 font-serif text-xl text-ink-secondary" dir={dir}>
              {piece.subtitle}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
            <Link
              to={profilePath(author.username)}
              className="font-medium text-ink hover:underline"
            >
              {displayName}
            </Link>
            {piece.publishedAt ? (
              <>
                <span aria-hidden>·</span>
                <time dateTime={piece.publishedAt}>{formatDate(piece.publishedAt)}</time>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span>{formatReadingTime(piece.readingTimeSeconds)}</span>
            {genre ? (
              <>
                <span aria-hidden>·</span>
                <span>{genre.name}</span>
              </>
            ) : null}
            {/* Typography controls sit with the byline: adjacent to the text they change,
                and out of the way of the first line of prose. */}
            <span className="ms-auto">
              <ReaderSettings />
            </span>
          </div>
        </header>
      </Column>

      {piece.featuredQuote ? (
        <Column maxWidth={maxWidth} className="mt-10">
          <p
            className="border-s-2 border-accent ps-4 font-serif text-2xl italic text-ink-secondary"
            dir={dir}
          >
            {piece.featuredQuote}
          </p>
        </Column>
      ) : null}

      <Column maxWidth={maxWidth} className="mt-10">
        <ContentRenderer content={piece.content} dir={dir} script={language?.script} />
      </Column>

      <Column maxWidth={maxWidth} className="mt-12">
        <ReaderActionBar
          pieceId={piece.id}
          pieceTitle={piece.title}
          engagement={engagement.data}
          isLoading={engagement.isLoading}
          shareUrl={canonicalUrl}
          returnTo={canonicalPath}
        />
      </Column>

      {piece.tags.length > 0 ? (
        <Column maxWidth={maxWidth} className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {piece.tags.map((tag) => (
              <li key={tag.id}>
                <span className="border-line rounded-md border px-2 py-1 text-sm text-ink-secondary">
                  #{tag.name}
                </span>
              </li>
            ))}
          </ul>
        </Column>
      ) : null}

      <Column maxWidth={maxWidth} className="mt-10">
        <ReaderAuthorCard username={author.username} fallbackName={displayName} />
      </Column>

      {/* The conversation (W7a, docs/45 §4.4) — INLINE here rather than on two pushed screens the
          way mobile does it, which is a recorded layout difference (48 §4.1). Ordered as mobile's
          own reader footer orders it: comments, then responses, then "More like this" last. */}
      <Column maxWidth={maxWidth} className="mt-12">
        <PieceConversation
          pieceId={piece.id}
          languageCode={language?.code ?? 'ur'}
          parentTitle={piece.title}
          returnTo={canonicalPath}
        />
      </Column>

      {related.data && related.data.length > 0 ? (
        <Column maxWidth={maxWidth} className="mt-10">
          <RelatedPieces pieces={related.data} />
        </Column>
      ) : null}
    </article>
  );
}
