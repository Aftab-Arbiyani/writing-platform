import { MAX_CLAPS_PER_USER_PER_PIECE } from '@qalam/shared';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

import { readingApi } from '../api/reading.api';
import { FLUSH_DELAY_MS } from '../hooks/use-claps';
import type { PieceEngagement } from '../types/reading.types';
import { ClapButton } from './clap-button';

vi.mock('../api/reading.api', () => ({
  readingApi: { clap: vi.fn(), unclap: vi.fn() },
}));

const clap = vi.mocked(readingApi.clap);
const unclap = vi.mocked(readingApi.unclap);

const PIECE_ID = 'piece-1';

function engagementOf(claps: number, viewerClaps: number): PieceEngagement {
  return {
    stats: { likes: 0, claps, bookmarks: 0, comments: 0, responses: 0, shares: 0 },
    viewer: { hasLiked: false, clapCount: viewerClaps, hasBookmarked: false },
  };
}

/**
 * The harness subscribes to the engagement query the way the reader page does — through `useQuery`
 * on `qk.pieces.engagement` — so the hook's optimistic `setQueryData` writes drive a re-render
 * exactly as they do in the app.
 *
 * (An earlier version drove renders from a manual `queryCache.subscribe`. A subscription that
 * outlived a failing test then re-rendered an unmounted tree and left stale DOM for the next test,
 * which is a fake failure that costs more to diagnose than the real one. Letting React own the
 * subscription removes the whole failure mode.)
 */
function renderClap(initial: PieceEngagement, authed = true, onRequireAuth = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  client.setQueryData(qk.pieces.engagement(PIECE_ID), initial);

  function Harness(): ReactElement {
    const { data } = useQuery({
      queryKey: qk.pieces.engagement(PIECE_ID),
      // Never refetches: the seeded value plus the hook's own writes are the whole story here.
      queryFn: () => initial,
      staleTime: Number.POSITIVE_INFINITY,
    });
    return (
      <ClapButton
        pieceId={PIECE_ID}
        engagement={data}
        authed={authed}
        onRequireAuth={onRequireAuth}
      />
    );
  }

  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return { ...render(<Harness />, { wrapper: Wrapper }), client, onRequireAuth };
}

/**
 * The clap button. Matched from the START of the accessible name, because "Remove my N claps" also
 * ends in "claps" and a looser regex matches both controls.
 */
const button = (): HTMLElement =>
  screen.getByRole('button', { name: /^(Clap for this piece|You’ve given all)/ });

const removeButton = (): HTMLElement => screen.getByRole('button', { name: /^Remove my/ });

/**
 * Close the debounce window and let what it started run.
 *
 * The ASYNC advance matters: TanStack Query's `notifyManager` also schedules through `setTimeout`,
 * so a synchronous advance fires the debounce but never lets the mutation it triggered proceed.
 */
async function settle(ms = FLUSH_DELAY_MS): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/**
 * Poll `predicate` on the FAKE clock until it holds.
 *
 * Testing Library's `waitFor` cannot be used here and switching to real timers mid-test is worse
 * than useless: pending fake timers are DISCARDED on `useRealTimers`, and the notify batch that
 * paints the server's answer is one of them — so the paint never arrives and the test fails for a
 * reason that has nothing to do with the code.
 *
 * A mutation settles across several microtask hops in TanStack's retryer and only then schedules
 * that batch, so the two queues have to be walked alternately. This is `waitFor`'s shape with the
 * fake clock as its pump.
 */
async function flushUntil(predicate: () => void, rounds = 50): Promise<void> {
  let lastError: unknown;
  for (let round = 0; round < rounds; round++) {
    try {
      predicate();
      return;
    } catch (error) {
      lastError = error;
    }
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
  }
  throw lastError;
}

describe('ClapButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fake ONLY the timers, deliberately: `shouldAdvanceTime` would close the very window these
    // tests exist to hold open.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    clap.mockResolvedValue({ viewerClaps: 1, totalClaps: 1 });
    unclap.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** THE requirement: a burst is ONE request carrying the accumulated count. */
  it('sends ONE request carrying the accumulated count for a burst of clicks', async () => {
    clap.mockResolvedValue({ viewerClaps: 7, totalClaps: 107 });
    renderClap(engagementOf(100, 0));

    for (let i = 0; i < 7; i++) fireEvent.click(button());

    // Nothing has gone out yet — the window is still open.
    expect(clap).not.toHaveBeenCalled();

    await settle();

    expect(clap).toHaveBeenCalledTimes(1);
    expect(clap).toHaveBeenCalledWith(PIECE_ID, 7);
  });

  it('keeps deferring while the burst continues, so a long run is still one request', async () => {
    clap.mockResolvedValue({ viewerClaps: 3, totalClaps: 3 });
    renderClap(engagementOf(0, 0));

    fireEvent.click(button());
    await settle(FLUSH_DELAY_MS - 100);
    fireEvent.click(button());
    await settle(FLUSH_DELAY_MS - 100);
    fireEvent.click(button());
    expect(clap).not.toHaveBeenCalled();

    await settle();
    expect(clap).toHaveBeenCalledTimes(1);
    expect(clap).toHaveBeenCalledWith(PIECE_ID, 3);
  });

  it('moves the count optimistically, before the request goes out', async () => {
    renderClap(engagementOf(10, 0));
    fireEvent.click(button());
    fireEvent.click(button());
    // 12 on the piece, 2 from this reader — painted with NO request sent, which is the point.
    await flushUntil(() => {
      expect(button()).toHaveTextContent('12');
    });
    expect(button()).toHaveTextContent('you 2');
    expect(clap).not.toHaveBeenCalled();
  });

  /** The cap: no error, no phantom increment, and nothing sent. */
  it('stops cleanly at the cap — no request, no increment, no error', async () => {
    renderClap(engagementOf(500, MAX_CLAPS_PER_USER_PER_PIECE));

    const capped = screen.getByRole('button', {
      name: `You’ve given all ${String(MAX_CLAPS_PER_USER_PER_PIECE)} claps`,
    });
    expect(capped).toBeDisabled();

    fireEvent.click(capped);
    fireEvent.click(capped);
    await settle(FLUSH_DELAY_MS * 2);

    expect(clap).not.toHaveBeenCalled();
    // The piece total is unchanged — no phantom increment.
    expect(capped).toHaveTextContent('500');
  });

  it('clamps a burst that would cross the cap to the claps actually available', async () => {
    clap.mockResolvedValue({ viewerClaps: MAX_CLAPS_PER_USER_PER_PIECE, totalClaps: 100 });
    renderClap(engagementOf(98, MAX_CLAPS_PER_USER_PER_PIECE - 2));

    // Ten clicks from two-below-the-cap: two land, eight are no-ops.
    for (let i = 0; i < 10; i++) fireEvent.click(button());
    await settle();

    expect(clap).toHaveBeenCalledTimes(1);
    expect(clap).toHaveBeenCalledWith(PIECE_ID, 2);
  });

  /** Removal is all-or-nothing, and nothing about it may read as a decrement. */
  it('removes ALL claps and never presents itself as a decrement', async () => {
    renderClap(engagementOf(60, 10));

    const remove = removeButton();
    expect(remove).toHaveAccessibleName('Remove my 10 claps');
    expect(remove.getAttribute('aria-label')).not.toContain('-1');

    fireEvent.click(remove);
    await flushUntil(() => {
      expect(unclap).toHaveBeenCalledWith(PIECE_ID);
    });
    // The viewer's ten come off the piece total, and their own count goes to zero.
    expect(button()).toHaveTextContent('50');
    expect(screen.queryByRole('button', { name: /^Remove my/ })).not.toBeInTheDocument();
  });

  it('offers no remove affordance when the reader has given none', () => {
    renderClap(engagementOf(60, 0));
    expect(screen.queryByRole('button', { name: /^Remove my/ })).not.toBeInTheDocument();
  });

  it('abandons an unflushed burst when the reader removes their claps', async () => {
    renderClap(engagementOf(60, 10));

    fireEvent.click(button()); // pending: 1, unflushed
    fireEvent.click(removeButton());
    await settle(FLUSH_DELAY_MS * 2);

    // The pending clap must NOT be sent afterwards — it would resurrect what was just removed.
    expect(clap).not.toHaveBeenCalled();
    expect(unclap).toHaveBeenCalledTimes(1);
  });

  /** A signed-out reader sees the counts and is routed to sign-in rather than clapping. */
  it('shows the count to a signed-out reader and routes them on click', () => {
    const onRequireAuth = vi.fn();
    renderClap(engagementOf(42, 0), false, onRequireAuth);

    expect(button()).toHaveTextContent('42');
    fireEvent.click(button());

    expect(onRequireAuth).toHaveBeenCalledTimes(1);
    expect(clap).not.toHaveBeenCalled();
  });

  /**
   * The debounce leaves a window where the claps exist only in the hook. Unmounting inside it must
   * flush, or a reader who claps and clicks straight through to another page loses them.
   */
  it('flushes a pending burst on unmount rather than dropping it', async () => {
    clap.mockResolvedValue({ viewerClaps: 3, totalClaps: 3 });
    const { unmount } = renderClap(engagementOf(0, 0));

    fireEvent.click(button());
    fireEvent.click(button());
    fireEvent.click(button());
    expect(clap).not.toHaveBeenCalled();

    await act(async () => {
      unmount();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(clap).toHaveBeenCalledWith(PIECE_ID, 3);
  });
});

/**
 * Reconciliation — what the reader sees once the batched flush has ANSWERED.
 *
 * Deliberately on REAL timers, in its own block. The tests above fake `setTimeout` to hold the
 * debounce window open, which is the only way to assert "one request, not twenty" deterministically.
 * But the settle path then runs through TanStack's retryer and React's scheduler, and pumping a fake
 * clock through both to get a repaint proved to assert the harness rather than the code: the cache
 * reached the server's value while the faked render queue did not. So these two pay a real ~600 ms
 * each and assert the real thing, end to end.
 */
describe('ClapButton — reconciling with the server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unclap.mockResolvedValue(undefined);
  });

  it('adopts the server’s authoritative total when the flush settles', async () => {
    // The server saw other readers clap too, so its total exceeds our optimistic guess.
    clap.mockResolvedValue({ viewerClaps: 2, totalClaps: 999 });
    renderClap(engagementOf(10, 0));

    fireEvent.click(button());
    fireEvent.click(button());
    // The optimistic paint lands first, without waiting for anything.
    await waitFor(() => {
      expect(button()).toHaveTextContent('12');
    });

    await waitFor(
      () => {
        expect(button()).toHaveTextContent('999');
      },
      { timeout: FLUSH_DELAY_MS + 2_000 },
    );
    expect(clap).toHaveBeenCalledExactlyOnceWith(PIECE_ID, 2);
  });

  it('rolls the optimistic claps back when the flush fails, and stays silent', async () => {
    clap.mockRejectedValue(
      new ApiError(400, { code: 'CLAP_LIMIT_REACHED', message: 'at the cap' }),
    );
    renderClap(engagementOf(20, 5));

    fireEvent.click(button());
    fireEvent.click(button());
    await waitFor(() => {
      expect(button()).toHaveTextContent('22');
    });

    // Back to 20 — the two optimistic claps are withdrawn, and no error is surfaced to the reader.
    await waitFor(
      () => {
        expect(button()).toHaveTextContent('20');
      },
      { timeout: FLUSH_DELAY_MS + 2_000 },
    );
  });
});
