import { SuggestionStatus } from '@qalam/shared';
import { QButton, QEmptyState, QErrorState, QSectionHeader, QSkeleton } from '@qalam/ui';
import { PenLine } from 'lucide-react';
import { type ReactElement, useState } from 'react';
import { useParams } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId } from '@/lib/errors';

import { SuggestionCard } from '../components/suggestion-card';
import { useStorySuggestions } from '../hooks/use-suggestions';
import { isCollaborationEnabled } from '../lib/collaboration-enabled';

/**
 * A story's suggested edits (`/write/:storyId/suggestions`, AF6 W3b) — **review only**.
 *
 * It used to carry a composer, and removing it is C-15's web half (docs/48 §3.22a). That composer
 * asked the writer to type "Starts at character" by hand, because this route renders no piece
 * content to select from — so the offset it produced was a guess, and the server's offset-exact
 * check 409'd it. The capability never worked here and could not be made to work here.
 *
 * Proposing now starts **in the reader**, where the passage actually is: the prose is walked into
 * per-block anchors and the reader picks one, so an offset is never typed by a human. That is also
 * where mobile puts it — `SuggestionComposerSheet` has exactly one caller in the whole app,
 * `reading_screen.dart`, and mobile's own suggestions screen carries only accept/reject/withdraw.
 * Two surfaces offering the same action in different shapes is the divergence §1 forbids, so this
 * page keeps the half it can do honestly.
 */
const FILTERS: { label: string; value: SuggestionStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: SuggestionStatus.Pending },
  { label: 'Accepted', value: SuggestionStatus.Accepted },
];

export function SuggestionsPage(): ReactElement {
  usePageTitle('Suggestions');
  const { storyId = '' } = useParams<{ storyId: string }>();
  const [status, setStatus] = useState<SuggestionStatus | undefined>(undefined);

  const enabled = isCollaborationEnabled();
  const query = useStorySuggestions(enabled ? storyId : undefined, status);

  if (!enabled) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-6 sm:px-6">
        <QEmptyState
          icon={PenLine}
          title="Collaboration is off"
          description="Enable collaboration to co-write and review with others."
        />
      </div>
    );
  }

  const suggestions = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-6 sm:px-6">
      <QSectionHeader
        title={<h1 className="text-ink font-serif text-2xl font-semibold">Suggestions</h1>}
        description="Proposed edits to this story. Accepting applies the replacement to the piece and snapshots the version before the edit."
        actions={
          <div className="flex flex-wrap gap-1">
            <div className="flex gap-1" role="group" aria-label="Filter suggestions">
              {FILTERS.map((filter) => (
                <QButton
                  key={filter.label}
                  size="sm"
                  variant={status === filter.value ? 'secondary' : 'ghost'}
                  aria-pressed={status === filter.value}
                  onClick={() => setStatus(filter.value)}
                >
                  {filter.label}
                </QButton>
              ))}
            </div>
          </div>
        }
      />

      {query.isLoading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading suggestions"
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <QSkeleton key={index} variant="text" lines={3} />
          ))}
        </div>
      ) : query.isError ? (
        <QErrorState
          title="Couldn’t load the suggestions."
          description={getErrorMessage(query.error)}
          requestId={getRequestId(query.error)}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : suggestions.length === 0 ? (
        <QEmptyState
          icon={PenLine}
          title="No suggestions yet"
          description="An editor or co-author can propose a change to any passage."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <SuggestionCard storyId={storyId} suggestion={suggestion} />
              </li>
            ))}
          </ul>

          {query.hasNextPage ? (
            <QButton
              variant="secondary"
              loading={query.isFetchingNextPage}
              onClick={() => {
                void query.fetchNextPage();
              }}
            >
              Load more
            </QButton>
          ) : null}
        </>
      )}
    </div>
  );
}
