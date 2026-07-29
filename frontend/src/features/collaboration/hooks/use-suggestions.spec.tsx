import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { qk } from '@/lib/query-keys';

import { collaborationApi } from '../api/collaboration.api';
import type { EditSuggestion } from '../types/collaboration.types';
import { useSuggestionActions } from './use-suggestions';

vi.mock('../api/collaboration.api', () => ({
  collaborationApi: {
    acceptSuggestion: vi.fn(),
    rejectSuggestion: vi.fn(),
    withdrawSuggestion: vi.fn(),
    addSuggestion: vi.fn(),
  },
}));

const STORY = 'story-1';

/**
 * Defect **C-13** (`qalam-mobile/docs/56` §2.6). Accepting a suggestion rewrites the piece
 * body server-side (D1, §3b), so the accept path MUST drop the cached piece — the editor
 * hydrates TipTap from `qk.pieces.detail` once and then autosaves the whole document with
 * no stale-write check, so a cached pre-accept body gets PATCHed back over the applied edit.
 *
 * Reject and withdraw change no prose, so they must NOT dump the content cache — dropping it
 * on every resolution would refetch the piece for nothing.
 */
function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
  const { result } = renderHook(() => useSuggestionActions(STORY), { wrapper });
  return { result, invalidate };
}

/** True when some invalidateQueries call targeted the `['pieces', …]` prefix. */
function invalidatedPieces(invalidate: ReturnType<typeof vi.spyOn>): boolean {
  return invalidate.mock.calls.some(
    (call) => (call[0] as { queryKey?: readonly unknown[] })?.queryKey?.[0] === 'pieces',
  );
}

describe('useSuggestionActions cache invalidation (C-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collaborationApi.acceptSuggestion).mockResolvedValue({} as EditSuggestion);
    vi.mocked(collaborationApi.rejectSuggestion).mockResolvedValue({} as EditSuggestion);
    vi.mocked(collaborationApi.withdrawSuggestion).mockResolvedValue({} as EditSuggestion);
  });

  it('accept drops the cached piece body, not just the suggestions list', async () => {
    const { result, invalidate } = setup();

    await act(async () => {
      await result.current.acceptSuggestion.mutateAsync('s-1');
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.pieces.all });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['stories', STORY, 'suggestions'],
    });
  });

  it('the piece invalidation covers the reader as well as the editor', () => {
    // Both views live under the one `pieces` prefix, which is why invalidating it is
    // enough — the reader is slug-keyed and has no id to invalidate individually.
    expect(qk.pieces.detail('p1')[0]).toBe('pieces');
    expect(qk.pieces.bySlug('a-slug')[0]).toBe('pieces');
    expect(qk.pieces.all[0]).toBe('pieces');
  });

  it('reject leaves the piece cache alone — it changes no prose', async () => {
    const { result, invalidate } = setup();

    await act(async () => {
      await result.current.rejectSuggestion.mutateAsync('s-1');
    });

    expect(invalidatedPieces(invalidate)).toBe(false);
  });

  it('withdraw leaves the piece cache alone — it changes no prose', async () => {
    const { result, invalidate } = setup();

    await act(async () => {
      await result.current.withdrawSuggestion.mutateAsync('s-1');
    });

    expect(invalidatedPieces(invalidate)).toBe(false);
  });
});
