import {
  QButton,
  QCard,
  QEmptyState,
  QErrorState,
  QSkeleton,
  QTag,
  useConfirm,
  useToast,
} from '@qalam/ui';
import { Dropdown, type MenuProps } from 'antd';
import { BookMarked, Lock, MoreHorizontal, Plus, Star } from 'lucide-react';
import { type ReactElement, useState } from 'react';
import { Link } from 'react-router';

import { CollectionFormDialog } from '@/components/collections';
import { Visibility } from '@qalam/shared';
import { useCollectionActions, useMyCollections } from '@/hooks/use-collections';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId } from '@/lib/errors';
import { collectionPath } from '@/lib/routes';
import type { Collection } from '@/types/collection';

/**
 * The reader's collections (W7b, docs/45 §4.4) — `/me/collections`, the web counterpart of mobile's
 * `collections_screen.dart`, on the same path.
 *
 * Owner-only, so the route sits inside `RequireAuth`: `GET /collections` is scoped to the caller and
 * there is no public collections surface in Phase 1.
 *
 * The default "Favorites" collection carries no rename/delete menu at all — `PATCH` refuses a title
 * change on it (`COLLECTION_DEFAULT_IMMUTABLE`) and it is not a collection the reader made, so the
 * affordance is absent rather than present-and-refused (W3c-1).
 */
export function CollectionsPage(): ReactElement {
  const query = useMyCollections();
  const [creating, setCreating] = useState(false);
  usePageTitle('Your collections');

  const collections = query.data?.pages.flatMap((page) => page.items) ?? [];
  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    hasMore: Boolean(query.hasNextPage),
    isLoading: query.isFetchingNextPage,
    onLoadMore: () => {
      void query.fetchNextPage();
    },
  });

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-ink font-serif text-3xl font-semibold">Your collections</h1>
        <QButton icon={Plus} size="sm" onClick={() => setCreating(true)}>
          New collection
        </QButton>
      </header>

      {query.isLoading ? (
        <div role="status" aria-busy="true" aria-label="Loading your collections">
          <QSkeleton variant="text" lines={4} />
        </div>
      ) : query.isError ? (
        <QErrorState
          title="Couldn’t load your collections."
          description={getErrorMessage(query.error)}
          requestId={getRequestId(query.error)}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : collections.length === 0 ? (
        <QEmptyState
          title="No collections yet"
          description="A collection is a reading list you keep — make one, then save pieces into it from anywhere you read."
          action={
            <QButton icon={Plus} onClick={() => setCreating(true)}>
              New collection
            </QButton>
          }
        />
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {collections.map((collection) => (
            <li key={collection.id}>
              <CollectionCard collection={collection} />
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
            More collections
          </QButton>
        </div>
      ) : null}

      {creating ? <CollectionFormDialog open onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

function CollectionCard({ collection }: { collection: Collection }): ReactElement {
  const confirm = useConfirm();
  const toast = useToast();
  const { remove } = useCollectionActions();
  const [renaming, setRenaming] = useState(false);

  const onDelete = async (): Promise<void> => {
    const confirmed = await confirm({
      title: `Delete “${collection.title}”?`,
      // The distinction that matters: a collection is a shelf, not a container that owns what is
      // on it. Deleting it must not read as deleting the writing.
      content: 'The collection goes; the pieces in it stay where they are.',
      okText: 'Delete',
      cancelText: 'Keep',
      danger: true,
    });
    if (!confirmed) return;
    remove.mutate(collection.id, {
      onSuccess: () => {
        toast.success('Collection deleted');
      },
      onError: (err) => {
        toast.error('Couldn’t delete it', { description: getErrorMessage(err) });
      },
    });
  };

  const menu: MenuProps['items'] = [
    { key: 'rename', label: 'Rename', onClick: () => setRenaming(true) },
    { key: 'delete', label: 'Delete', danger: true, onClick: () => void onDelete() },
  ];

  return (
    <QCard>
      <div className="flex items-center gap-3">
        {collection.isDefault ? (
          <Star size={20} strokeWidth={1.5} className="text-accent shrink-0" aria-hidden />
        ) : (
          <BookMarked size={20} strokeWidth={1.5} className="text-ink-muted shrink-0" aria-hidden />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <Link
              to={collectionPath(collection.id)}
              className="text-ink truncate font-medium hover:underline"
            >
              <bdi>{collection.title}</bdi>
            </Link>
            {collection.visibility === Visibility.Private ? (
              <QTag size="sm">
                <span className="inline-flex items-center gap-1">
                  <Lock size={11} strokeWidth={2} aria-hidden />
                  Private
                </span>
              </QTag>
            ) : null}
          </span>
          <span className="text-ink-muted text-xs">
            {collection.piecesCount === 1 ? '1 piece' : `${String(collection.piecesCount)} pieces`}
          </span>
        </div>

        {/* Absent on the default collection: it cannot be renamed and is not the reader's to delete. */}
        {collection.isDefault ? null : (
          <Dropdown menu={{ items: menu }} trigger={['click']} placement="bottomRight">
            <QButton
              variant="ghost"
              size="sm"
              icon={MoreHorizontal}
              aria-label={`Actions for ${collection.title}`}
            />
          </Dropdown>
        )}
      </div>

      {renaming ? (
        <CollectionFormDialog open onClose={() => setRenaming(false)} existing={collection} />
      ) : null}
    </QCard>
  );
}
