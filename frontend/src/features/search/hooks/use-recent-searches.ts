import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

import { searchApi } from '../api/search.api';
import { useSearchStore } from '../stores/search.store';
import type { RecentSearch } from '../types/search.types';

/** A recent search as the UI consumes it — a server id (UUID) or, locally, the query itself. */
export interface RecentItem {
  id: string;
  query: string;
}

/**
 * Recent searches, unified across the two worlds that own them (docs/26 §11 — never fabricate
 * data): for signed-in readers the server list (`GET /search/recent`, auto-recorded when a search
 * runs) is the source of truth with per-item + bulk delete; for signed-out visitors the
 * device-local persisted store is the sole list. Either way the local store is a write-through
 * cache, so an executed search shows up instantly with no round-trip and the panel is never empty
 * mid-refetch. Deletes are optimistic (docs/12 §2.5).
 */
export function useRecentSearches() {
  const client = useQueryClient();
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');

  const localRecent = useSearchStore((s) => s.recent);
  const addLocal = useSearchStore((s) => s.addRecent);
  const removeLocal = useSearchStore((s) => s.removeRecent);
  const clearLocal = useSearchStore((s) => s.clearRecent);

  const serverQuery = useQuery({
    queryKey: qk.search.recent(),
    queryFn: ({ signal }) => searchApi.recent(signal),
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const deleteOne = useMutation({
    mutationFn: (id: string) => searchApi.deleteRecent(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: qk.search.recent() });
      const previous = client.getQueryData<RecentSearch[]>(qk.search.recent());
      client.setQueryData<RecentSearch[]>(qk.search.recent(), (old) =>
        (old ?? []).filter((r) => r.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) client.setQueryData(qk.search.recent(), context.previous);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: qk.search.recent() });
    },
  });

  const clearAll = useMutation({
    mutationFn: () => searchApi.clearRecent(),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: qk.search.recent() });
      const previous = client.getQueryData<RecentSearch[]>(qk.search.recent());
      client.setQueryData<RecentSearch[]>(qk.search.recent(), []);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) client.setQueryData(qk.search.recent(), context.previous);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: qk.search.recent() });
    },
  });

  // Server is the source only when it actually has rows; otherwise fall back to the local mirror
  // (offline, still loading, or a fresh account) so the panel never flashes empty. `serverData`
  // keeps React Query's stable identity — a `?? []` fallback here would break the memo below.
  const serverData = serverQuery.data;
  const source: 'server' | 'local' = isAuthed && (serverData?.length ?? 0) > 0 ? 'server' : 'local';

  const items = useMemo<RecentItem[]>(() => {
    if (source === 'server' && serverData) {
      const seen = new Set<string>();
      const out: RecentItem[] = [];
      for (const row of serverData) {
        const key = row.query.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ id: row.id, query: row.query });
      }
      return out;
    }
    return localRecent.map((query) => ({ id: query, query }));
  }, [source, serverData, localRecent]);

  const record = useCallback(
    (query: string) => {
      addLocal(query);
      // The server records the term as part of the search request itself; nudge the list to
      // refetch so the authoritative row (with its id) replaces the local mirror shortly after.
      if (isAuthed) void client.invalidateQueries({ queryKey: qk.search.recent() });
    },
    [addLocal, isAuthed, client],
  );

  const remove = useCallback(
    (item: RecentItem) => {
      removeLocal(item.query);
      if (source === 'server') deleteOne.mutate(item.id);
    },
    [removeLocal, source, deleteOne],
  );

  const clear = useCallback(() => {
    clearLocal();
    if (source === 'server') clearAll.mutate();
  }, [clearLocal, source, clearAll]);

  return {
    items,
    source,
    isLoading: isAuthed && serverQuery.isLoading,
    record,
    remove,
    clear,
  };
}
