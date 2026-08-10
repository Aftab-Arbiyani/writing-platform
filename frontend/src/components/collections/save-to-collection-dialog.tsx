import { QButton, QDialog, QErrorState, QSkeleton, useToast } from '@qalam/ui';
import { Plus, Star, BookMarked } from 'lucide-react';
import { type ReactElement, useState } from 'react';

import { useCollectionActions, useMyCollections } from '@/hooks/use-collections';
import { getErrorMessage, getRequestId } from '@/lib/errors';
import type { Collection } from '@/types/collection';

import { CollectionFormDialog } from './collection-form-dialog';

/**
 * Save a piece into a collection (W7b) — the web counterpart of mobile's
 * `save_to_collection_sheet.dart`.
 *
 * Lists the reader's collections, saves into the one they pick, and offers "New collection" inline
 * so a reader with none is one gesture from a saved piece rather than being sent away to create one
 * first (the form dialog resolves with what it created, which is what makes the chain possible).
 *
 * App level (docs/26 §4): invoked from the reader today, and from any piece card that offers it, so
 * it may not live inside either feature.
 */
export interface SaveToCollectionDialogProps {
  open: boolean;
  onClose: () => void;
  pieceId: string;
  /** For the dialog's description, so the reader can see what they are filing. */
  pieceTitle: string;
}

export function SaveToCollectionDialog({
  open,
  onClose,
  pieceId,
  pieceTitle,
}: SaveToCollectionDialogProps): ReactElement {
  const toast = useToast();
  const query = useMyCollections();
  const { addPiece } = useCollectionActions();
  const [creating, setCreating] = useState(false);
  const [savingTo, setSavingTo] = useState<string | null>(null);

  const collections = query.data?.pages.flatMap((page) => page.items) ?? [];

  const save = (collection: Collection): void => {
    setSavingTo(collection.id);
    addPiece.mutate(
      { collectionId: collection.id, pieceId },
      {
        onSuccess: () => {
          toast.success(`Saved to ${collection.title}`);
          onClose();
        },
        onError: (err) => {
          toast.error('Couldn’t save it', { description: getErrorMessage(err) });
        },
        onSettled: () => setSavingTo(null),
      },
    );
  };

  return (
    <>
      <QDialog
        open={open}
        onClose={onClose}
        title="Save to a collection"
        description={`Where should “${pieceTitle}” go?`}
        size="sm"
        footer={
          <div className="flex justify-between gap-2">
            <QButton variant="ghost" icon={Plus} onClick={() => setCreating(true)}>
              New collection
            </QButton>
            <QButton variant="ghost" onClick={onClose}>
              Close
            </QButton>
          </div>
        }
      >
        {query.isLoading ? (
          <div role="status" aria-busy="true" aria-label="Loading your collections">
            <QSkeleton variant="text" lines={3} />
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
          <p className="text-ink-secondary text-sm">
            You don’t have any collections yet. Make one and this piece goes straight into it.
          </p>
        ) : (
          <ul className="flex list-none flex-col gap-1 p-0" aria-label="Your collections">
            {collections.map((collection) => (
              <li key={collection.id}>
                <button
                  type="button"
                  disabled={savingTo !== null}
                  onClick={() => save(collection)}
                  className="hover:bg-raised flex w-full items-center gap-3 rounded-md px-2 py-2 text-start disabled:opacity-60"
                >
                  {collection.isDefault ? (
                    <Star size={16} strokeWidth={1.5} className="text-accent" aria-hidden />
                  ) : (
                    <BookMarked
                      size={16}
                      strokeWidth={1.5}
                      className="text-ink-muted"
                      aria-hidden
                    />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-ink truncate text-sm font-medium">
                      <bdi>{collection.title}</bdi>
                    </span>
                    <span className="text-ink-muted text-xs">
                      {collection.piecesCount === 1
                        ? '1 piece'
                        : `${String(collection.piecesCount)} pieces`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {query.hasNextPage ? (
              <li>
                <QButton
                  variant="ghost"
                  size="sm"
                  loading={query.isFetchingNextPage}
                  onClick={() => {
                    void query.fetchNextPage();
                  }}
                >
                  More collections
                </QButton>
              </li>
            ) : null}
          </ul>
        )}
      </QDialog>

      {/* Chained: the form resolves with what it created, and the piece goes straight into it. */}
      {creating ? (
        <CollectionFormDialog
          open
          onClose={() => setCreating(false)}
          onSaved={(collection) => {
            setCreating(false);
            save(collection);
          }}
        />
      ) : null}
    </>
  );
}
