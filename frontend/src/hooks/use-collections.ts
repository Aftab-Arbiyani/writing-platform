import type { Visibility } from '@qalam/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { collectionsApi } from '@/lib/collections-api';
import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Reading lists / collections (W7b, docs/45 §4.4).
 *
 * App level (docs/26 §4) because the consumers straddle features: `features/collections` owns the
 * list and detail pages, while the reader — and any piece card — saves INTO a collection. Three
 * features would otherwise import one another.
 *
 * **Every read here needs a session**, unlike W7a's conversation reads: the controller carries a
 * class-level `@Permissions(collection.manage)` and scopes everything to the caller, so a
 * collection is never a public surface. The queries are `enabled` on the session rather than fired
 * and 401'd — a 401 calls the app's terminal-unauthorized handler and would bounce a browsing
 * visitor to login (the shape of the W5-6 defect, docs/48 §3.9, arrived at from the other side).
 */

/** Collections change at human speed and the list is short — 30 s is plenty. */
const COLLECTIONS_STALE = 30 * 1000;

/** The caller's own collections, newest page first. */
export function useMyCollections() {
  const authed = useAuthStore((s) => s.status) === 'authenticated';
  return useInfiniteQuery({
    queryKey: qk.collections.mine(),
    queryFn: ({ pageParam, signal }) => collectionsApi.mine(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled: authed,
    staleTime: COLLECTIONS_STALE,
  });
}

/**
 * One collection's header.
 *
 * Separate from its pieces on purpose: the two are separate endpoints, and a header that fails to
 * load must not take the piece list down with it (mobile's detail screen makes the same split).
 */
export function useCollection(id: string | undefined) {
  const authed = useAuthStore((s) => s.status) === 'authenticated';
  return useQuery({
    queryKey: qk.collections.detail(id ?? ''),
    queryFn: ({ signal }) => collectionsApi.detail(id ?? '', signal),
    enabled: authed && Boolean(id),
    staleTime: COLLECTIONS_STALE,
  });
}

/** One collection's pieces, cursor-paginated. */
export function useCollectionPieces(id: string | undefined) {
  const authed = useAuthStore((s) => s.status) === 'authenticated';
  return useInfiniteQuery({
    queryKey: qk.collections.pieces(id ?? ''),
    queryFn: ({ pageParam, signal }) => collectionsApi.pieces(id ?? '', pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled: authed && Boolean(id),
    staleTime: COLLECTIONS_STALE,
  });
}

/**
 * The six writes on collections.
 *
 * Invalidation targets whichever of the two things each write moved:
 *   • the LIST (`mine`) — created, renamed, deleted, and whenever `piecesCount` changed;
 *   • the COLLECTION (`detail(id)` prefix, which covers its header and its pieces) — for anything
 *     that touched one collection's contents.
 *
 * Saving and removing a piece move both, because `piecesCount` is rendered on the list card.
 *
 * Deliberately invalidate-and-refetch rather than splicing: the server owns `slug`, `piecesCount`,
 * `position` and `isDefault`, and a client that guessed them would show a collection that does not
 * match the next read.
 */
export function useCollectionActions() {
  const client = useQueryClient();

  const invalidateList = (): Promise<void> =>
    client.invalidateQueries({ queryKey: qk.collections.mine() });

  const invalidateOne = async (id: string): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: qk.collections.detail(id) }),
      invalidateList(),
    ]);
  };

  const create = useMutation({
    mutationFn: (input: { title: string; description?: string; visibility?: Visibility }) =>
      collectionsApi.create(input),
    onSuccess: invalidateList,
  });

  const update = useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      title?: string;
      description?: string;
      visibility?: Visibility;
    }) => collectionsApi.update(id, input),
    onSuccess: (_updated, variables) => invalidateOne(variables.id),
  });

  /** Deletes the COLLECTION. The pieces in it are untouched — they are not owned by it. */
  const remove = useMutation({
    mutationFn: (id: string) => collectionsApi.remove(id),
    onSuccess: invalidateList,
  });

  const addPiece = useMutation({
    mutationFn: ({
      collectionId,
      pieceId,
      note,
    }: {
      collectionId: string;
      pieceId: string;
      note?: string;
    }) => collectionsApi.addPiece(collectionId, pieceId, note),
    onSuccess: (_added, variables) => invalidateOne(variables.collectionId),
  });

  /**
   * Removes the piece's MEMBERSHIP of this collection. The piece itself, and every other collection
   * holding it, are untouched — which is why nothing under `qk.pieces.*` is invalidated here.
   */
  const removePiece = useMutation({
    mutationFn: ({ collectionId, pieceId }: { collectionId: string; pieceId: string }) =>
      collectionsApi.removePiece(collectionId, pieceId),
    onSuccess: (_removed, variables) => invalidateOne(variables.collectionId),
  });

  return { create, update, remove, addPiece, removePiece };
}
