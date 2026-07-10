import { QSearch } from '@qalam/ui';
import { Compass } from 'lucide-react';
import type { KeyboardEvent, ReactElement } from 'react';
import { Link } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { RecentSearches } from '../components/recent-searches';
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
 * (`useSearchInput`). Below the field: with a query, the scope tabs + filters + results; without
 * one, the recent + trending panel. Every list owns its own loading/empty/error state.
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

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      const value = text.trim();
      if (value.length >= 2) recent.record(value);
      commit();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-4 py-6 sm:px-6">
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

          <SearchResults params={params} />
        </>
      ) : (
        <div className="flex flex-col gap-10 py-2">
          <RecentSearches onRun={runQuery} />
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
