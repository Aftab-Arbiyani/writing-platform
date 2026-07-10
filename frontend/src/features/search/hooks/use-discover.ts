import type { DiscoverPieceKind, WriterKind } from '@qalam/shared';
import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { discoverApi } from '../api/discover.api';

/**
 * Discovery-screen data (E6, docs/06 §8). Each section shows one warm page (no in-section
 * pagination — rows link out to a full list). Content tier for editorial slices (5m staleTime),
 * Taxonomy tier for the popular tag/genre/language widgets (1h) — they are cached + effectively
 * static within a session (docs/12 §2.2). All public: the discovery screen works signed-out.
 */
const CONTENT_STALE_MS = 5 * 60 * 1000;
const TAXONOMY_STALE_MS = 60 * 60 * 1000;

export function useDiscoverWriters(kind: WriterKind, enabled = true) {
  return useQuery({
    queryKey: qk.discover.writers(kind),
    queryFn: ({ signal }) => discoverApi.writers({ kind, signal }).then((page) => page.items),
    staleTime: CONTENT_STALE_MS,
    enabled,
  });
}

export function useDiscoverPieces(kind: DiscoverPieceKind, enabled = true) {
  return useQuery({
    queryKey: qk.discover.pieces(kind),
    queryFn: ({ signal }) => discoverApi.pieces({ kind, signal }).then((page) => page.items),
    staleTime: CONTENT_STALE_MS,
    enabled,
  });
}

export function useTrendingPieces(enabled = true) {
  return useQuery({
    queryKey: qk.discover.trendingPieces(),
    queryFn: ({ signal }) => discoverApi.trendingPieces({ signal }).then((page) => page.items),
    staleTime: CONTENT_STALE_MS,
    enabled,
  });
}

export function useDiscoverTags(enabled = true) {
  return useQuery({
    queryKey: qk.discover.tags(),
    queryFn: ({ signal }) => discoverApi.tags({ signal }).then((page) => page.items),
    staleTime: TAXONOMY_STALE_MS,
    enabled,
  });
}

export function useDiscoverGenres(enabled = true) {
  return useQuery({
    queryKey: qk.discover.genres(),
    queryFn: ({ signal }) => discoverApi.genres({ signal }).then((page) => page.items),
    staleTime: TAXONOMY_STALE_MS,
    enabled,
  });
}

export function useDiscoverLanguages(enabled = true) {
  return useQuery({
    queryKey: qk.discover.languages(),
    queryFn: ({ signal }) => discoverApi.languages({ signal }).then((page) => page.items),
    staleTime: TAXONOMY_STALE_MS,
    enabled,
  });
}
