import { QSearch } from '@qalam/ui';
import { Compass } from 'lucide-react';
import type { KeyboardEvent, ReactElement } from 'react';
import { Link } from 'react-router';

import { Seo } from '@/components/seo';
import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { AiSearchPanel } from '../components/ai-search-panel';
import { AiSearchSuggestions, SearchModeToggle } from '../components/ai-search-controls';
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
 * (`useSearchInput`). Below the field: with a query, the engine switch + filters + results; without
 * one, the recent / saved / trending panel. Every list owns its own loading/empty/error state.
 *
 * **Two engines answer the same field (W5/AF4, docs/45 §4).** `mode=keyword` is the E8 full-text
 * search this page has always run — public, always available, scoped by the tabs. `mode=ai` is the
 * retrieval-backed one: ranked, grounded, explainable, and gated on auth + `ai.use` + a feature flag
 * that ships dark. The AI half is additive on purpose — a reader who is signed out, or a deployment
 * that has not raised the flags, keeps exactly the search it had.
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
   * Run a SAVED search. Saved searches are an AF4 concept, so re-running one switches to the AI
   * engine as well as setting the query — restoring it into keyword mode would answer the reader's
   * saved question with a different engine and quietly call it the same search.
   */
  const runSavedQuery = (query: string): void => {
    recent.record(query);
    // ONE navigation, not two: `setMode` + `setQuery` in the same handler both patch the same
    // pre-navigation URL, so the second silently dropped the engine (docs/48 §3.9 W5-7).
    params.setSearch(query, 'ai');
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
            The engine switch sits above the scope tabs because it is the coarser choice: the tabs
            narrow WHERE keyword search looks, while this decides WHICH engine answers. AI search
            returns mixed entity types by design, so the scope tabs do not apply to it and are not
            rendered in that mode — a tab that silently did nothing would be worse than its absence.
          */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SearchModeToggle mode={params.mode} onSelect={params.setMode} />
            {/* Saving belongs to the AI engine — the E8 history already records keyword queries. */}
            {params.mode === 'ai' ? <SaveSearchButton query={params.q} /> : null}
          </div>

          {params.mode === 'keyword' ? (
            <SearchTabs type={params.type} onSelect={params.setType} />
          ) : null}
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

          {params.mode === 'ai' ? (
            <>
              <AiSearchSuggestions prefix={params.q.trim()} onPick={runQuery} />
              <AiSearchPanel params={params} />
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
