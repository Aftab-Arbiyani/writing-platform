import { AiFeature } from '@qalam/shared';
import type { SemanticSearchRequest } from '@qalam/api-types';
import { QButton, QEmptyState } from '@qalam/ui';
import { Sparkles, SearchX } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { AiAvailabilityNotice } from '@/components/ai-availability-notice';
import { getErrorMessage } from '@/lib/errors';

import { useAiAvailability } from '@/hooks/use-ai-availability';

import { useSemanticSearch } from '../hooks/use-retrieval';
import type { UseSearchQueryParamsResult } from '../hooks/use-search-query-params';
import { RetrievalResultCard } from './retrieval-result-card';
import { ResultListSkeleton } from './search-skeletons';

/**
 * AI (retrieval-backed) search results (W5/AF4) — the `mode=ai` half of the search page.
 *
 * **Why this sits beside the keyword results rather than replacing them.** The two engines answer
 * differently and have different prerequisites: keyword search is public and always available, while
 * every AF4 route needs auth, `ai.use`, and a dark-launchable feature flag. A page that swapped one
 * for the other would take working search away from a signed-out reader, or from any deployment that
 * has not turned the flags on. So the engine is a URL-addressable mode, and this component owns the
 * whole not-available story for it.
 *
 * The row's filters carry over — `language`, `genre` and `tag` map onto the DTO's flat filter fields
 * (`tags` comma-joined, 48 §3.9 W5-1) — so switching engines keeps the reader's refinements instead
 * of silently dropping them.
 */
export function AiSearchPanel({ params }: { params: UseSearchQueryParamsResult }): ReactElement {
  const availability = useAiAvailability(AiFeature.SemanticSearch);
  // Synthesis is the only part of search that spends tokens, so it is opt-in per session and off by
  // default — a reader who wants prose asks for it (mobile's "AI answer" chip is the same bargain).
  const [synthesize, setSynthesize] = useState(false);

  const request: SemanticSearchRequest = {
    query: params.q.trim(),
    ...(params.language !== null ? { language: params.language } : {}),
    ...(params.genre !== null ? { genre: params.genre } : {}),
    ...(params.tag !== null ? { tags: params.tag } : {}),
    ...(synthesize ? { synthesize: true } : {}),
  };
  const query = useSemanticSearch(request);

  if (availability !== 'available' && availability !== 'unknown') {
    return <AiAvailabilityNotice availability={availability} />;
  }

  // Skeleton-first, like every other result list on this page (docs/06 §4.1) — the layout must not
  // jump when the ranked results arrive.
  if (query.isPending || availability === 'unknown') {
    return <ResultListSkeleton count={4} />;
  }

  if (query.isError) {
    // A retrieval failure is not a broken page: the same query still works in keyword mode, and
    // saying so is more useful than a bare error.
    return (
      <QEmptyState
        icon={SearchX}
        title="AI search didn’t finish"
        description={getErrorMessage(query.error)}
        minHeight={220}
        action={
          <QButton
            variant="secondary"
            size="sm"
            onClick={() => {
              params.setMode('keyword');
            }}
          >
            Use keyword search
          </QButton>
        }
      />
    );
  }

  const data = query.data;
  if (!data) return <div />;

  const hasResults = data.results.length > 0;
  const answer = data.answer ?? '';

  return (
    <section className="flex flex-col gap-4" aria-label="AI search results">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/*
          A toggle, not a link: it re-runs the SAME query with synthesis on, which is a different
          request and a different cache entry. `aria-pressed` is what makes that state audible.
        */}
        <QButton
          variant={synthesize ? 'primary' : 'secondary'}
          size="sm"
          icon={Sparkles}
          aria-pressed={synthesize}
          onClick={() => {
            setSynthesize((on) => !on);
          }}
        >
          {synthesize ? 'AI answer on' : 'Explain these results'}
        </QButton>
        {/*
          The server reports which strategies actually ran and whether it degraded. Surfacing
          `degraded` matters: a partial answer that looks complete is the failure mode this platform
          is most exposed to, since a source can time out and the request still succeeds.
        */}
        <p className="text-sm text-ink-secondary">
          {data.meta.returned} of {data.meta.totalCandidates} candidates
          {data.meta.degraded ? ' · some sources were unavailable' : ''}
        </p>
      </div>

      {answer !== '' ? (
        <div className="border-line rounded-lg border bg-raised p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-secondary">
            AI answer
          </p>
          <p dir="auto" className="whitespace-pre-wrap text-sm text-ink">
            {answer}
          </p>
        </div>
      ) : null}

      {hasResults ? (
        <ul className="flex flex-col gap-3">
          {data.results.map((item) => (
            <li key={`${item.sourceType}:${item.id}`}>
              <RetrievalResultCard item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <QEmptyState
          icon={SearchX}
          title="Nothing found"
          description="Try a different phrasing, or a broader query."
          minHeight={200}
        />
      )}
    </section>
  );
}
