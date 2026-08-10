import { MAX_CLAPS_PER_USER_PER_PIECE } from '@qalam/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { qk } from '@/lib/query-keys';

import { readingApi } from '../api/reading.api';
import type { PieceEngagement } from '../types/reading.types';

/**
 * The clap gesture (W7b, docs/45 §4.4) — accumulating, batched, capped, optimistic.
 *
 * A clap is **not a like**. Like toggles one boolean; a clap is a 1..50 quantity the reader builds
 * by clicking repeatedly, and its removal is all-or-nothing. That difference is the whole reason
 * `use-engagement` could not absorb it and W1 deferred it to this row.
 *
 * ## The four properties this has to get right
 *
 * **1. It accumulates.** Each click adds one, toward `MAX_CLAPS_PER_USER_PER_PIECE`. The count
 * moves immediately (optimistically) so it climbs under the reader's cursor.
 *
 * **2. Twenty clicks are ONE request.** `ClapDto` carries a `count` precisely so a client can
 * batch. Clicks accumulate in a ref and a single `POST` flushes the total. Twenty requests would
 * be twenty rows of write-tier rate limit spent on one gesture, twenty chances to interleave, and
 * twenty `viewerClaps` answers racing each other back.
 *
 * **The window is {@link FLUSH_DELAY_MS} ms of idle**, and both bounds are deliberate:
 *   - **Above ~250 ms**, because that is the slow end of a deliberate repeat-click cadence. A
 *     shorter window would split one gesture into several requests — exactly the thing being
 *     avoided — and the split would be worst for the slowest clickers.
 *   - **Below ~1 s**, because past about a second an un-flushed count stops feeling saved. The
 *     reader has already seen the number move; the write should land while the gesture is still
 *     the thing they are thinking about.
 * It is an idle (debounce) window, not a fixed interval: a continuing burst keeps deferring the
 * flush, so a long run of claps is still one request rather than one per window.
 *
 * **3. The cap is per user per piece and the client stops at it.** `viewerClaps + pending` is
 * clamped to the max; a click at the cap is a no-op — no increment, no request, no error. The
 * server clamps too (`min(count, MAX - current)`) and answers `CLAP_LIMIT_REACHED` to a request
 * that is already maxed, which is precisely the error the reader must never be shown for hammering
 * a full button.
 *
 * **4. Removal is all-or-nothing.** `DELETE` removes every clap this viewer has on the piece.
 * There is no decrement, so the affordance says "remove my claps".
 *
 * ## Losing a pending burst is a real failure, so it is handled
 *
 * A debounce means there is always a window where the reader's claps exist only in this hook. If
 * they navigate, close the tab, or background it in that window, an unflushed burst is silently
 * lost — the count they watched climb simply is not there next visit. So the pending total is also
 * flushed on unmount and on `pagehide` / `visibilitychange`, not only on the timer.
 *
 * No durable outbox, though: web has no offline write story by design (docs/48 §4, "Partly
 * inherent") and porting mobile's `SyncEngine` queue is explicitly out of scope.
 *
 * ## Direction note
 *
 * This is the one part of W7b that is **not** a port. Mobile's reader action bar has no clap
 * control at all — no gesture, no accumulator, no `POST /pieces/:id/claps` caller anywhere in the
 * app — despite docs/48 §2 having credited it with one. Web is therefore the reference for the clap
 * interaction; see the register's §3.15 and the mobile follow-up it opens.
 */

/**
 * Idle window before a burst of clicks is flushed as one request. Justified at length above; the
 * short version is "longer than a repeat-click, shorter than 'did that save?'".
 */
export const FLUSH_DELAY_MS = 600;

/** The reader's own clap state, as the control renders it. */
export interface ClapState {
  /** `viewerClaps` plus anything still pending, clamped to the cap — what the reader sees. */
  viewerClaps: number;
  /** The piece total including the optimistic delta. */
  totalClaps: number;
  /** True once the reader cannot add another. */
  atCap: boolean;
  /** True while a flush or a removal is in flight (for a quiet busy state, not a spinner-per-click). */
  isBusy: boolean;
  /** Add one clap. A no-op at the cap. */
  clap: () => void;
  /** Remove every clap this viewer has on the piece. */
  removeClaps: () => void;
}

function patchEngagement(
  client: ReturnType<typeof useQueryClient>,
  key: readonly unknown[],
  update: (prev: PieceEngagement) => PieceEngagement,
): void {
  const prev = client.getQueryData<PieceEngagement>(key);
  if (prev) client.setQueryData<PieceEngagement>(key, update(prev));
}

const clamp = (value: number): number => (value < 0 ? 0 : value);

export function useClaps(pieceId: string, engagement: PieceEngagement | undefined): ClapState {
  const client = useQueryClient();
  const key = qk.pieces.engagement(pieceId);

  /**
   * Claps clicked but not yet sent. A **ref**, not state: the flush callback and the unload
   * listeners must read the latest value without being re-created on every click, and the visible
   * count already lives in the query cache (patched optimistically) so this drives no rendering.
   */
  const pendingRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFlushing, setIsFlushing] = useState(false);

  const serverViewerClaps = engagement?.viewer.clapCount ?? 0;

  const clapMutation = useMutation({
    mutationFn: (count: number) => readingApi.clap(pieceId, count),
    /**
     * Adopt the server's two numbers. The viewer's because the server clamped ours, the piece's
     * because concurrent readers moved it while this page was open — the same reason `use-engagement`
     * adopts `totalLikes` rather than trusting its own `+1`.
     */
    onSuccess: (result) => {
      patchEngagement(client, key, (e) => ({
        stats: { ...e.stats, claps: result.totalClaps },
        viewer: { ...e.viewer, clapCount: result.viewerClaps },
      }));
    },
    /**
     * A failed flush rolls back exactly the claps that flush carried, then re-reads the truth.
     *
     * Refetch rather than trust the rollback arithmetic: the most likely failure IS
     * `CLAP_LIMIT_REACHED` from another tab or device having spent the cap, and in that case the
     * honest count is the server's, not ours-minus-what-we-sent. Deliberately silent — a clap is a
     * grace note, and a toast for a lost one costs the reader more than the clap was worth.
     */
    onError: (_err, count) => {
      patchEngagement(client, key, (e) => ({
        stats: { ...e.stats, claps: clamp(e.stats.claps - count) },
        viewer: { ...e.viewer, clapCount: clamp(e.viewer.clapCount - count) },
      }));
      void client.invalidateQueries({ queryKey: key });
    },
  });

  /**
   * Abandon anything clicked-but-unsent.
   *
   * Called synchronously from `removeClaps`, NOT from the mutation's `onMutate`: `onMutate` yields
   * at its first `await`, and the debounce timer can fire in that gap — which would send a burst
   * immediately after the reader asked for zero, resurrecting the claps they just removed.
   */
  const dropPending = useCallback(() => {
    pendingRef.current = 0;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const removeMutation = useMutation({
    mutationFn: () => readingApi.unclap(pieceId),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: key });
      const prev = client.getQueryData<PieceEngagement>(key);
      if (prev) {
        client.setQueryData<PieceEngagement>(key, {
          stats: { ...prev.stats, claps: clamp(prev.stats.claps - prev.viewer.clapCount) },
          viewer: { ...prev.viewer, clapCount: 0 },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) client.setQueryData(key, ctx.prev);
    },
  });

  /** Send whatever has accumulated. Safe to call spuriously — zero pending is a no-op. */
  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const count = pendingRef.current;
    if (count <= 0) return;
    pendingRef.current = 0;
    setIsFlushing(true);
    clapMutation.mutate(count, { onSettled: () => setIsFlushing(false) });
  }, [clapMutation]);

  /**
   * Flush on unmount and on the two events that mean "this page is going away".
   *
   * `pagehide` rather than `beforeunload`: `beforeunload` is unreliable on mobile Safari and blocks
   * the back/forward cache. `visibilitychange` catches a backgrounded tab, which on mobile is what
   * happens just before an app switch that never comes back.
   */
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const onAway = (): void => {
      flushRef.current();
    };
    const onHidden = (): void => {
      if (document.visibilityState === 'hidden') flushRef.current();
    };
    window.addEventListener('pagehide', onAway);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', onAway);
      document.removeEventListener('visibilitychange', onHidden);
      // Unmount is the common case — a reader who claps and clicks straight through to another page.
      flushRef.current();
    };
  }, []);

  const viewerClaps = Math.min(serverViewerClaps, MAX_CLAPS_PER_USER_PER_PIECE);
  const atCap = viewerClaps >= MAX_CLAPS_PER_USER_PER_PIECE;

  const clap = useCallback(() => {
    const prev = client.getQueryData<PieceEngagement>(key);
    // No engagement loaded means no count to move. Accumulating anyway would send a burst the
    // reader never saw acknowledged, which is worse than dropping the click.
    if (!prev) return;
    // The cap check reads the OPTIMISTIC count, which already includes every pending click — so a
    // reader who clicks twenty times from forty-nine gets one clap and nineteen no-ops, not a
    // request for twenty that the server silently clamps to one.
    if (prev.viewer.clapCount >= MAX_CLAPS_PER_USER_PER_PIECE) return;

    pendingRef.current += 1;
    patchEngagement(client, key, (e) => ({
      stats: { ...e.stats, claps: e.stats.claps + 1 },
      viewer: { ...e.viewer, clapCount: e.viewer.clapCount + 1 },
    }));

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flushRef.current();
    }, FLUSH_DELAY_MS);
  }, [client, key]);

  const removeClaps = useCallback(() => {
    if ((client.getQueryData<PieceEngagement>(key)?.viewer.clapCount ?? 0) <= 0) return;
    dropPending();
    removeMutation.mutate();
  }, [client, key, dropPending, removeMutation]);

  return {
    viewerClaps,
    totalClaps: engagement?.stats.claps ?? 0,
    atCap,
    isBusy: isFlushing || removeMutation.isPending,
    clap,
    removeClaps,
  };
}
