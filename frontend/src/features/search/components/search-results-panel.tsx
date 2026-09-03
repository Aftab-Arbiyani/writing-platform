import type { SemanticSearchRequest } from '@qalam/api-types';
import { QEmptyState } from '@qalam/ui';
import { SearchX } from 'lucide-react';
import type { ReactElement } from 'react';

import { useSemanticSearch } from '../hooks/use-retrieval';
import type { UseSearchQueryParamsResult } from '../hooks/use-search-query-params';
import { RetrievalResultCard } from './retrieval-result-card';
import { SearchResults } from './search-results';
import { ResultListSkeleton } from './search-skeletons';

/**
 * The ranked, mixed-type results for the `All` scope (`POST /ai/search`).
 *
 * **This is now the default search, not an alternative to it.** It used to be the `mode=ai` half of
 * an engine switch, gated on auth + `ai.use` + a dark feature flag, and it owned a whole
 * "not available" story because any of those could be missing. D5 removed all three: the route is
 * public, the pipeline calls no model, and the one part that did — an optional synthesized answer —
 * is gone. What is left is a retriever-and-ranker, which is just a better search.
 *
 * The row's filters carry over: `language`, `genre` and `tag` map onto the DTO's flat filter fields
 * (`tags` comma-joined, 48 §3.9 W5-1), so a reader's refinements survive moving between scopes.
 */
export function SearchResultsPanel({
  params,
}: {
  params: UseSearchQueryParamsResult;
}): ReactElement {
  const request: SemanticSearchRequest = {
    query: params.q.trim(),
    ...(params.language !== null ? { language: params.language } : {}),
    ...(params.genre !== null ? { genre: params.genre } : {}),
    ...(params.tag !== null ? { tags: params.tag } : {}),
  };
  const query = useSemanticSearch(request);

  // Skeleton-first, like every other result list on this page (docs/06 §4.1) — the layout must not
  // jump when the ranked results arrive.
  if (query.isPending) {
    return <ResultListSkeleton count={4} />;
  }

  /**
   * A ranking failure falls back to the keyword list, silently.
   *
   * It used to render an error with a "Use keyword search" button, which was the right call while
   * the two engines were a choice the reader had made: telling someone their chosen engine failed
   * respects the choice. There is no choice now, so an error card would be reporting an
   * implementation detail — the reader asked for search, and the keyword list IS search. They get
   * results instead of an apology.
   */
  if (query.isError) {
    return <SearchResults params={params} />;
  }

  const data = query.data;
  if (!data) return <div />;

  return (
    <section className="flex flex-col gap-4" aria-label="Search results">
      {/*
        The server reports which strategies actually ran and whether it degraded. Surfacing
        `degraded` matters: a partial answer that looks complete is the failure mode this platform
        is most exposed to, since a source can time out and the request still succeeds.
      */}
      <p className="text-sm text-ink-secondary">
        {data.meta.returned} of {data.meta.totalCandidates} candidates
        {data.meta.degraded ? ' · some sources were unavailable' : ''}
      </p>

      {data.results.length > 0 ? (
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
