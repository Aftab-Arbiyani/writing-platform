import { getPage, type CursorPage } from '@/lib/api-client';

import type { TaxonomyGenre, TaxonomyLanguage } from '../types/settings.types';

/**
 * Option source for the Edit-Profile genre + language pickers. There is no `/taxonomy` endpoint
 * (docs/26 §11 gap #2); the reference lists come from the search taxonomy endpoints with `q`
 * OMITTED = browse by usage. Using these as a data source is NOT the search feature. Kept local
 * to this feature (a small duplicate of the editor's copy) so settings never imports another
 * feature (docs/26 §4).
 */
export const taxonomyApi = {
  genres: (signal?: AbortSignal): Promise<CursorPage<TaxonomyGenre>> =>
    getPage<TaxonomyGenre>('/search/genres?limit=50', { signal }),

  languages: (signal?: AbortSignal): Promise<CursorPage<TaxonomyLanguage>> =>
    getPage<TaxonomyLanguage>('/search/languages?limit=50', { signal }),
};
