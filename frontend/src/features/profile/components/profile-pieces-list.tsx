import { PieceStatus } from '@qalam/shared';
import { QButton, QCard, QEmptyState, QErrorState, QSkeleton, QSpinner } from '@qalam/ui';
import { BookOpen, FileText, PenLine } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';

import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { getErrorMessage, getRequestId } from '@/lib/errors';
import { formatCount, formatDate, formatReadingTime } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { piecePath, ROUTES } from '@/lib/routes';
import type { ProfileResponse } from '@/types/profile';

import { useMyProfilePieces } from '../hooks/use-profile-pieces';
import type { ProfilePiece } from '../types/profile.types';

function PieceItem({ piece }: { piece: ProfilePiece }): ReactElement {
  const cover = mediaUrl(piece.coverImageKey);
  return (
    <QCard as="li" padding="md" interactive className="flex items-center gap-4">
      {cover ? (
        <img
          src={cover}
          alt=""
          width={72}
          height={72}
          loading="lazy"
          className="hidden h-16 w-16 shrink-0 rounded-md object-cover dark:brightness-[0.92] sm:block"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <Link
          to={piecePath(piece.slug ?? piece.id)}
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="block truncate font-serif text-lg font-semibold text-ink hover:underline">
            <bdi>{piece.title}</bdi>
          </span>
        </Link>
        <p className="mt-1 text-xs text-ink-muted">
          {piece.publishedAt ? formatDate(piece.publishedAt) : 'Draft'}
          {' · '}
          {formatReadingTime(piece.readingTimeSeconds)}
        </p>
      </div>
    </QCard>
  );
}

/**
 * The "Pieces" tab. For the OWN profile it lists real published pieces (`GET /me/pieces`) plus a
 * draft summary linking to the writer dashboard. For OTHER writers, `v1` has no per-author piece
 * endpoint (docs/11 §10.4) — the published *count* is real (from the profile), but the list can't
 * be fetched, so we say so plainly rather than inventing pieces.
 */
export function ProfilePiecesList({ profile }: { profile: ProfileResponse }): ReactElement {
  const navigate = useNavigate();
  const isSelf = profile.viewerRelation.isSelf;

  // Hooks run unconditionally (rules-of-hooks); the queries are disabled for non-self, so they
  // no-op there. The other-writer branch returns below, after all hooks have run.
  const published = useMyProfilePieces(PieceStatus.Published, isSelf);
  const drafts = useMyProfilePieces(PieceStatus.Draft, isSelf);
  const items = published.data?.pages.flatMap((page) => page.items) ?? [];
  const draftCount = drafts.data?.pages.flatMap((page) => page.items).length ?? 0;
  const sentinelRef = useInfiniteScroll({
    hasMore: published.hasNextPage ?? false,
    isLoading: published.isFetchingNextPage,
    onLoadMore: () => {
      void published.fetchNextPage();
    },
  });

  if (!isSelf) {
    const count = profile.counts.piecesPublished;
    return (
      <QEmptyState
        icon={BookOpen}
        title={count === 0 ? 'No published pieces yet.' : `${formatCount(count)} published`}
        description={
          count === 0
            ? 'When this writer publishes, their work appears here.'
            : 'Reading another writer’s pieces from their profile is coming soon.'
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Draft summary (own profile only) — a shortcut into the writer dashboard. */}
      {draftCount > 0 ? (
        <Link
          to={ROUTES.drafts}
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <QCard padding="md" interactive className="flex items-center gap-3">
            <FileText size={20} strokeWidth={1.5} className="text-ink-secondary" aria-hidden />
            <span className="text-sm text-ink">
              You have{' '}
              <span className="font-semibold tabular-nums">
                {draftCount}
                {drafts.hasNextPage ? '+' : ''}
              </span>{' '}
              {draftCount === 1 ? 'draft' : 'drafts'} in progress
            </span>
          </QCard>
        </Link>
      ) : null}

      {published.isLoading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading pieces"
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <QCard key={i} padding="md" className="flex items-center gap-4">
              <QSkeleton
                variant="rect"
                width={64}
                height={64}
                radius="md"
                className="hidden sm:block"
              />
              <div className="flex-1">
                <QSkeleton variant="title" width="50%" />
                <QSkeleton variant="text" lines={1} width="30%" className="mt-2" />
              </div>
            </QCard>
          ))}
        </div>
      ) : published.isError ? (
        <QErrorState
          title="Couldn’t load your pieces."
          description={getErrorMessage(published.error)}
          requestId={getRequestId(published.error)}
          onRetry={() => {
            void published.refetch();
          }}
        />
      ) : items.length === 0 ? (
        <QEmptyState
          icon={BookOpen}
          title="No published pieces yet."
          description="When you publish, your work appears here."
          action={
            <QButton
              variant="primary"
              icon={PenLine}
              onClick={() => {
                void navigate(ROUTES.write);
              }}
            >
              Write something
            </QButton>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {items.map((piece) => (
              <PieceItem key={piece.id} piece={piece} />
            ))}
          </ul>
          <div ref={sentinelRef} aria-hidden className="h-px" />
          {published.isFetchingNextPage ? (
            <div role="status" aria-label="Loading more" className="flex justify-center py-3">
              <QSpinner />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
