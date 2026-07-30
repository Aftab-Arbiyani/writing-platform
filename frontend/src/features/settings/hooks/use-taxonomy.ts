import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { taxonomyApi } from '../api/taxonomy.api';

/**
 * Genre + language option lists for the Edit-Profile pickers. Taxonomy tier (1h staleTime,
 * docs/12 §2.2 — reference data). Shares the `qk.taxonomy.*` cache keys with the editor's pickers.
 */
const TAXONOMY_STALE = 60 * 60 * 1000;

export function useGenreOptions() {
  return useQuery({
    queryKey: qk.taxonomy.genres(),
    queryFn: ({ signal }) => taxonomyApi.genres(signal).then((page) => page.items),
    staleTime: TAXONOMY_STALE,
  });
}

export function useLanguageOptions() {
  return useQuery({
    queryKey: qk.taxonomy.languages(),
    queryFn: ({ signal }) => taxonomyApi.languages(signal).then((page) => page.items),
    staleTime: TAXONOMY_STALE,
  });
}
