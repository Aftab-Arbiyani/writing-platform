import { SearchType } from '@qalam/shared';
import type { ReactElement } from 'react';

import type { UseSearchQueryParamsResult } from '../hooks/use-search-query-params';
import { AllResults } from './all-results';
import {
  GenreResults,
  LanguageResults,
  PieceResults,
  TagResults,
  WriterResults,
} from './search-result-lists';

/**
 * Dispatches the active search scope to its result list. Only the active tab's component is
 * mounted, so each per-type infinite hook runs unconditionally (rules of hooks) and a tab switch
 * cleanly unmounts the previous query. The `key` on the type forces a fresh mount per scope so
 * scroll/state don't bleed across tabs.
 */
export function SearchResults({ params }: { params: UseSearchQueryParamsResult }): ReactElement {
  const { q, type, filters } = params;

  switch (type) {
    case SearchType.Writers:
      return <WriterResults key="writers" q={q} filters={filters} />;
    case SearchType.Pieces:
      return <PieceResults key="pieces" q={q} filters={filters} />;
    case SearchType.Tags:
      return <TagResults key="tags" q={q} />;
    case SearchType.Genres:
      return <GenreResults key="genres" q={q} />;
    case SearchType.Languages:
      return <LanguageResults key="languages" q={q} />;
    case SearchType.All:
    default:
      return <AllResults key="all" q={q} onSeeAll={params.setType} />;
  }
}
