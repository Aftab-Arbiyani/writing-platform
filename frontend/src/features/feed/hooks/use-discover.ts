import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { discoverApi } from '../api/feed.api';

/**
 * Discover/taxonomy widgets: trending tags + genres (right rail + filter chips) and the
 * language list (language filter options). Taxonomy tier — 1h `staleTime` (docs/12 §2.2);
 * these are admin-curated / cached and effectively static within a session. Each returns just
 * the first page's items (rails don't paginate).
 */
const TAXONOMY_STALE = 60 * 60 * 1000;

export function useTrendingTags() {
  return useQuery({
    queryKey: qk.discover.tags(),
    queryFn: ({ signal }) => discoverApi.tags(signal).then((page) => page.items),
    staleTime: TAXONOMY_STALE,
  });
}

export function useTrendingGenres() {
  return useQuery({
    queryKey: qk.discover.genres(),
    queryFn: ({ signal }) => discoverApi.genres(signal).then((page) => page.items),
    staleTime: TAXONOMY_STALE,
  });
}

export function useFeedLanguages() {
  return useQuery({
    queryKey: qk.discover.languages(),
    queryFn: ({ signal }) => discoverApi.languages(signal).then((page) => page.items),
    staleTime: TAXONOMY_STALE,
  });
}
