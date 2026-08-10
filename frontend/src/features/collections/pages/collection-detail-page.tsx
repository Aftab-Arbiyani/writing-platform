import {
  QButton,
  QCard,
  QEmptyState,
  QErrorState,
  QSkeleton,
  useConfirm,
  useToast,
} from '@qalam/ui';
import { ArrowLeft, X } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router';

import { useCollection, useCollectionActions, useCollectionPieces } from '@/hooks/use-collections';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId } from '@/lib/errors';
import { formatRelativeTime } from '@/lib/format';
import { piecePath, ROUTES } from '@/lib/routes';
import type { CollectionPiece } from '@/types/collection';

/**
 * One collection's pieces (W7b) — `/me/collections/:collectionId`, the same path mobile uses.
 *
 * **The header and the pieces load independently**, mirroring mobile's detail screen: they are two
 * endpoints, and a header that fails must not take the list down with it. So a failed header
 * degrades to a generic title and the pieces still render.
 *
 * Removing a piece here un-files it. It does NOT delete the piece — every affordance and every
 * confirmation has to say so, because "remove" next to someone's writing is otherwise ambiguous.
 */
export function CollectionDetailPage(): ReactElement {
  const { collectionId } = useParams<{ collectionId: string }>();
  const header = useCollection(collectionId);
  const query = useCollectionPieces(collectionId);

  const title = header.data?.title ?? 'Collection';
  usePageTitle(title);

  const pieces = query.data?.pages.flatMap((page) => page.items) ?? [];
  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    hasMore: Boolean(query.hasNextPage),
    isLoading: query.isFetchingNextPage,
    onLoadMore: () => {
      void query.fetchNextPage();
    },
  });

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-8 sm:px-6">
      <Link
        to={ROUTES.collections}
        className="text-ink-secondary hover:text-ink mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft size={16} strokeWidth={1.5} aria-hidden />
        All collections
      </Link>

      <header className="mb-6">
        <h1 className="text-ink font-serif text-3xl font-semibold">
          <bdi>{title}</bdi>
        </h1>
        {header.data?.description ? (
          <p className="text-ink-secondary mt-2" dir="auto">
            {header.data.description}
          </p>
        ) : null}
        {header.data ? (
          <p className="text-ink-muted mt-1 text-sm">
            {header.data.piecesCount === 1
              ? '1 piece'
              : `${String(header.data.piecesCount)} pieces`}
          </p>
        ) : null}
      </header>

      {query.isLoading ? (
        <div role="status" aria-busy="true" aria-label="Loading the collection">
          <QSkeleton variant="text" lines={4} />
        </div>
      ) : query.isError ? (
        <QErrorState
          title="Couldn’t load this collection."
          description={getErrorMessage(query.error)}
          requestId={getRequestId(query.error)}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : pieces.length === 0 ? (
        <QEmptyState
          title="Nothing saved here yet"
          description="Save a piece into this collection from the reader and it will show up here."
          action={
            <Link to={ROUTES.feed}>
              <QButton variant="secondary">Find something to read</QButton>
            </Link>
          }
        />
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {pieces.map((piece) => (
            <li key={piece.pieceId}>
              <PieceRow collectionId={collectionId ?? ''} collectionTitle={title} piece={piece} />
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinelRef} aria-hidden />
      {query.hasNextPage ? (
        <div className="mt-4">
          <QButton
            variant="secondary"
            size="sm"
            loading={query.isFetchingNextPage}
            onClick={() => {
              void query.fetchNextPage();
            }}
          >
            More pieces
          </QButton>
        </div>
      ) : null}
    </div>
  );
}

function PieceRow({
  collectionId,
  collectionTitle,
  piece,
}: {
  collectionId: string;
  collectionTitle: string;
  piece: CollectionPiece;
}): ReactElement {
  const confirm = useConfirm();
  const toast = useToast();
  const { removePiece } = useCollectionActions();

  const onRemove = async (): Promise<void> => {
    const confirmed = await confirm({
      title: `Remove “${piece.title}” from ${collectionTitle}?`,
      // Stated explicitly because "remove" beside someone's writing is otherwise ambiguous: this
      // un-files the piece, it does not delete it, and DELETE on the membership is all it touches.
      content: 'It comes off this list. The piece itself stays published and unchanged.',
      okText: 'Remove',
      cancelText: 'Keep',
    });
    if (!confirmed) return;
    removePiece.mutate(
      { collectionId, pieceId: piece.pieceId },
      {
        onSuccess: () => {
          toast.success('Removed from the collection');
        },
        onError: (err) => {
          toast.error('Couldn’t remove it', { description: getErrorMessage(err) });
        },
      },
    );
  };

  return (
    <QCard>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-base font-medium">
            <Link to={piecePath(piece.slug ?? piece.pieceId)} className="text-ink hover:underline">
              <bdi>{piece.title}</bdi>
            </Link>
          </h2>
          {piece.note ? (
            <p className="text-ink-secondary text-sm" dir="auto">
              <bdi>{piece.note}</bdi>
            </p>
          ) : null}
          <p className="text-ink-muted text-xs">
            Saved <time dateTime={piece.addedAt}>{formatRelativeTime(piece.addedAt)}</time>
          </p>
        </div>

        <QButton
          variant="ghost"
          size="sm"
          icon={X}
          loading={removePiece.isPending}
          aria-label={`Remove ${piece.title} from this collection`}
          onClick={() => {
            void onRemove();
          }}
        />
      </div>
    </QCard>
  );
}
