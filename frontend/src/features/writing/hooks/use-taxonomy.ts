import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { taxonomyApi } from '../api/taxonomy.api';

/**
 * Language + genre option lists for the editor pickers. Taxonomy tier (1h staleTime,
 * docs/12 §2.2) — reference data, effectively static within a session. Each returns the
 * browse list's items.
 */
const TAXONOMY_STALE = 60 * 60 * 1000;

export function useLanguages() {
  return useQuery({
    queryKey: qk.taxonomy.languages(),
    queryFn: ({ signal }) => taxonomyApi.languages(signal).then((page) => page.items),
    staleTime: TAXONOMY_STALE,
  });
}

export function useGenres() {
  return useQuery({
    queryKey: qk.taxonomy.genres(),
    queryFn: ({ signal }) => taxonomyApi.genres(signal).then((page) => page.items),
    staleTime: TAXONOMY_STALE,
  });
}
