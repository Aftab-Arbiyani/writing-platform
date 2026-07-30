import { getPage, type CursorPage } from '@/lib/api-client';

import type { TaxonomyGenre, TaxonomyLanguage } from '../types/piece.types';

/**
 * Taxonomy option source for the editor's language + genre pickers. There is no `/taxonomy`
 * endpoint (docs/12 §2.1.1); the reference lists come from the search taxonomy endpoints with
 * `q` OMITTED = browse by usage. Using these as a data source is NOT the search feature.
 */
export const taxonomyApi = {
  genres: (signal?: AbortSignal): Promise<CursorPage<TaxonomyGenre>> =>
    getPage<TaxonomyGenre>('/search/genres?limit=50', { signal }),

  languages: (signal?: AbortSignal): Promise<CursorPage<TaxonomyLanguage>> =>
    getPage<TaxonomyLanguage>('/search/languages?limit=50', { signal }),
};
