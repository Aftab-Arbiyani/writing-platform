import { SearchType } from '@qalam/shared';
import { QSearch } from '@qalam/ui';
import { Compass } from 'lucide-react';
import type { KeyboardEvent, ReactElement } from 'react';
import { Link } from 'react-router';

import { Seo } from '@/components/seo';
import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { SearchResultsPanel } from '../components/search-results-panel';
import { SearchSuggestions } from '../components/search-suggestions';
import { RecentSearches } from '../components/recent-searches';
import { SavedSearches, SaveSearchButton } from '../components/saved-searches';
import { RemovableChip } from '../components/search-chip';
import { SearchFilterBar } from '../components/search-filter-bar';
import { SearchResults } from '../components/search-results';
import { SearchTabs } from '../components/search-tabs';
import { TrendingSearches } from '../components/trending-searches';
import { useRecentSearches } from '../hooks/use-recent-searches';
import { useSearchInput } from '../hooks/use-search-input';
import { useSearchQueryParams } from '../hooks/use-search-query-params';

/**
 * The Search & Discovery screen (docs/06 §3.6, docs/11 §10) — the full experience and the mobile
 * search surface. All state is in the URL (`useSearchQueryParams`); the field debounces into it
 * (`useSearchInput`). Below the field: with a query, the scope tabs + filters + results; without one,
 * the recent / saved / trending panel. Every list owns its own loading/empty/error state.
 *
 * **One search (D5).** There used to be an engine switch here — `mode=keyword` for E8 full-text and
 * `mode=ai` for the retrieval-backed one, the second gated on auth + a dark feature flag. The two
 * were never really alternatives: the retrieval pipeline is a graph + keyword + metadata retriever
 * behind a ranker, and the only part of it that ever called a model was an optional synthesized
 * answer, which is gone. So there is one search, it is the ranked one, and it is public.
 *
 * **The scope tabs survived the merge and the switch did not**, because they are different kinds of
 * choice. The switch asked the reader to pick an implementation, which is a question a reader has no
 * way to answer. A scope is a refinement of their own intent — "just writers" — so `All` shows the
 * ranked, mixed-type results and every other tab narrows to that entity's keyword list. Nothing was
 * lost: both engines are still reachable, just not as a thing to choose between.
 */
export function SearchPage(): ReactElement {
  usePageTitle('Search');
  const params = useSearchQueryParams();
  const { text, setText, commit } = useSearchInput();
  const recent = useRecentSearches();

  // Run a query from a chip (recent / trending) — a fresh search, so a history entry.
  const runQuery = (query: string): void => {
    recent.record(query);
    params.setQuery(query);
  };

  /**
   * Run a SAVED search.
   *
   * Identical to {@link runQuery} since D5: a saved search used to have to restore the AI engine as
   * well as the query, because re-running one in keyword mode answered the reader's saved question
   * with a different engine and called it the same search (48 §3.9 W5-7). With one engine there is
   * no engine to restore, so the distinction — and the two-navigations bug it once hid — is gone.
   */
  const runSavedQuery = runQuery;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      const value = text.trim();
      if (value.length >= 2) recent.record(value);
      commit();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-4 py-6 sm:px-6">
      <Seo
        title="Search"
        description="Search writers, pieces, tags, genres, and languages across Qalam."
        canonicalPath={ROUTES.search}
      />
      {/* Page-level heading for SR/document outline; the search field is the visual entry point. */}
      <h1 className="sr-only">Search</h1>
      <div>
        <QSearch
          aria-label="Search writers, pieces, tags, genres, and languages"
          placeholder="Search writers, pieces, tags…"
          size="large"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      {params.hasQuery ? (
        <>
          {/*
            Unconditional since D5. `SaveSearchButton` self-hides for a signed-out reader, which is
            the only condition that ever mattered — it used to ALSO be hidden outside AI mode, and
            with one engine that would hide it from every search on the page.
          */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SaveSearchButton query={params.q} />
          </div>

          <SearchTabs type={params.type} onSelect={params.setType} />
          <SearchFilterBar params={params} />

          {params.tag ? (
            <div className="flex items-center gap-2 text-sm text-ink-secondary">
              <span>Filtered by tag</span>
              <RemovableChip
                label={`#${params.tag}`}
                onClick={() => {
                  /* re-running the same tag is a no-op; the chip exists to REMOVE it */
                }}
                onRemove={() => {
                  params.setTag(null);
                }}
                removeLabel={`Remove tag filter #${params.tag}`}
              />
            </div>
          ) : null}

          {/*
            `All` is the ranked, mixed-type answer; every narrower scope is that entity's keyword
            list. Suggestions ride with `All` because they are query reformulations — offering one
            while the reader has deliberately narrowed to "Writers" would push them back out of the
            scope they just chose.
          */}
          {params.type === SearchType.All ? (
            <>
              <SearchSuggestions prefix={params.q.trim()} onPick={runQuery} />
              <SearchResultsPanel params={params} />
            </>
          ) : (
            <SearchResults params={params} />
          )}
        </>
      ) : (
        <div className="flex flex-col gap-10 py-2">
          <RecentSearches onRun={runQuery} />
          <SavedSearches onRun={runSavedQuery} />
          <TrendingSearches onRun={runQuery} />
          <Link
            to={ROUTES.discover}
            className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
          >
            <Compass size={16} strokeWidth={1.75} aria-hidden />
            Explore Discover — featured writers &amp; trending pieces
          </Link>
        </div>
      )}
    </div>
  );
}
