import type { SavedSearch } from '@qalam/api-types';
import { QButton, QDialog, QInput, useToast } from '@qalam/ui';
import { Bookmark, BookmarkPlus, X } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/stores/auth.store';

import { useDeleteSavedSearch, useSavedSearches, useSaveSearch } from '../hooks/use-retrieval';

/**
 * Saved searches — the reader's named, server-side searches.
 *
 * **Deliberately quiet when there is nothing to show.** It renders null for a signed-out reader or
 * an empty list, exactly like `RecentSearches` does: this sits on the search landing beside Recent
 * and Trending, and an empty shell there would push the two lists that DO have content below the
 * fold. The place a reader learns saved searches exist is the save button on a result set
 * ({@link SaveSearchButton}), not an empty heading.
 *
 * D5 swapped the AI-availability gate for a plain session check. Saving is the one retrieval route
 * that stayed authenticated — a saved search belongs to somebody — so a session is the real
 * condition, and it always was; the feature flag was standing in front of it.
 *
 * Distinct from the E8 recent-search history (`/search/recent`), which is unnamed, automatic, and
 * kept locally. The server caps these at 50 per user.
 */
export function SavedSearches({ onRun }: { onRun: (query: string) => void }): ReactElement | null {
  const authed = useAuthStore((s) => s.status) === 'authenticated';
  const { data } = useSavedSearches();
  const remove = useDeleteSavedSearch();
  const toast = useToast();

  const items = data ?? [];
  if (!authed || items.length === 0) return null;

  const onRemove = (item: SavedSearch): void => {
    remove.mutate(item.id, {
      onError: (error) => {
        toast.error('Couldn’t remove that search', { description: getErrorMessage(error) });
      },
    });
  };

  return (
    <section aria-labelledby="saved-searches-heading" className="flex flex-col gap-3">
      <h2 id="saved-searches-heading" className="text-sm font-semibold text-ink">
        Saved
      </h2>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            {/*
              The name runs it, the ✕ forgets it — two focus stops, like the recent chips, so both
              are keyboard-reachable. The query is shown under the name because a saved search is
              named by its owner and the name alone may not say what it looks for.
            */}
            <button
              type="button"
              onClick={() => {
                onRun(item.query);
              }}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-raised"
            >
              <Bookmark
                size={15}
                strokeWidth={1.75}
                className="shrink-0 text-ink-muted"
                aria-hidden
              />
              <span className="min-w-0">
                <span dir="auto" className="block truncate text-sm text-ink">
                  {item.name}
                </span>
                <span dir="auto" className="block truncate text-xs text-ink-secondary">
                  {item.query}
                </span>
              </span>
            </button>
            <QButton
              variant="ghost"
              size="sm"
              icon={X}
              aria-label={`Remove saved search “${item.name}”`}
              onClick={() => {
                onRemove(item);
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Save the current search under a name (`POST /ai/search/saved`).
 *
 * The name is asked for rather than derived, because that is the whole point of a saved search: the
 * query is already the query. A dialog rather than an inline field so the query text stays visible
 * behind it, and pre-filled with the query so accepting the default is one keystroke.
 *
 * **Saving is idempotent by name on the server**, so re-saving under an existing name updates it
 * instead of growing a duplicate — worth knowing, because the UI does not warn about the collision
 * and does not need to.
 */
export function SaveSearchButton({ query }: { query: string }): ReactElement | null {
  const authed = useAuthStore((s) => s.status) === 'authenticated';
  const save = useSaveSearch();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  // Self-hiding is what lets the search page render this unconditionally: a signed-out reader gets
  // search without a control that would only 401.
  if (!authed || query.trim() === '') return null;

  const openDialog = (): void => {
    setName(query.trim().slice(0, 120));
    setOpen(true);
  };

  const submit = (): void => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    save.mutate(
      { name: trimmed, query: query.trim() },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success('Search saved');
        },
        onError: (error) => {
          // The one failure a reader can act on is the 50-search cap; everything else reads as a
          // plain refusal, which is what `getErrorMessage` already says.
          toast.error('Couldn’t save that search', { description: getErrorMessage(error) });
        },
      },
    );
  };

  return (
    <>
      <QButton variant="ghost" size="sm" icon={BookmarkPlus} onClick={openDialog}>
        Save search
      </QButton>
      <QDialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Name this search"
        description="Saved searches live on your account, so you can re-run them from any device."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <QButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </QButton>
            <QButton
              variant="primary"
              size="sm"
              loading={save.isPending}
              disabled={name.trim() === ''}
              onClick={submit}
            >
              Save
            </QButton>
          </div>
        }
      >
        <QInput
          label="Name"
          value={name}
          maxLength={120}
          onChange={(event) => {
            setName(event.target.value);
          }}
          onPressEnter={submit}
        />
      </QDialog>
    </>
  );
}
