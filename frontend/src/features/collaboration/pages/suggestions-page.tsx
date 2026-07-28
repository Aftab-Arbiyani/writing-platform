import { POLICY_ACTIONS, SuggestionStatus } from '@qalam/shared';
import { QButton, QEmptyState, QErrorState, QSectionHeader, QSkeleton } from '@qalam/ui';
import { PenLine } from 'lucide-react';
import { type ReactElement, useState } from 'react';
import { useParams } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId } from '@/lib/errors';

import { CapabilityGate } from '../components/capability-gate';
import { SuggestionCard } from '../components/suggestion-card';
import { SuggestionComposer } from '../components/suggestion-composer';
import { useStorySuggestions, useSuggestionActions } from '../hooks/use-suggestions';
import { isCollaborationEnabled } from '../lib/collaboration-enabled';

/**
 * A story's suggested edits (`/write/:storyId/suggestions`, AF6 W3b).
 *
 * Built entirely from the DTOs: mobile's equivalent screen has **no create affordance at all** and
 * its `addSuggestion` could only ever 400 (defect M-2, docs/48 §3.2), so there was nothing to port.
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
  const [composing, setComposing] = useState(false);

  const enabled = isCollaborationEnabled();
  const query = useStorySuggestions(enabled ? storyId : undefined, status);
  const { addSuggestion } = useSuggestionActions(storyId);

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
        description="Proposed edits to this story. Accepting records the decision — the wording is applied in the editor."
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
            <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.StorySuggest}>
              <QButton size="sm" onClick={() => setComposing(true)}>
                Suggest an edit
              </QButton>
            </CapabilityGate>
          </div>
        }
      />

      {composing ? (
        <SuggestionComposer
          isPending={addSuggestion.isPending}
          onCancel={() => setComposing(false)}
          onSubmit={async (input) => {
            await addSuggestion.mutateAsync(input);
            setComposing(false);
          }}
        />
      ) : null}

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
