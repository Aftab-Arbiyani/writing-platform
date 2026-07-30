import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Visibility } from '@qalam/shared';

import { piecesApi } from '../api/pieces.api';
import type { Piece } from '../types/piece.types';
import { usePublishPiece, useSchedulePiece } from './use-publish';

vi.mock('../api/pieces.api', () => ({
  piecesApi: { update: vi.fn(), publish: vi.fn(), schedule: vi.fn() },
}));

function providers() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const piece = (id: string): Piece => ({ id }) as Piece;
const patch = { title: 'T', genreSlug: 'ghazal', visibility: Visibility.Public, tags: [] };

describe('publish + schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(piecesApi.update).mockResolvedValue(piece('p1'));
    vi.mocked(piecesApi.publish).mockResolvedValue(piece('p1'));
    vi.mocked(piecesApi.schedule).mockResolvedValue(piece('p1'));
  });

  it('publish PATCHes metadata then publishes with an idempotency key', async () => {
    const { result } = renderHook(() => usePublishPiece(), { wrapper: providers() });
    await act(async () => {
      await result.current.mutateAsync({ id: 'p1', patch });
    });
    expect(piecesApi.update).toHaveBeenCalledWith('p1', patch);
    expect(piecesApi.publish).toHaveBeenCalledWith('p1', expect.any(String));
    // idempotency key is a non-empty string
    const key = vi.mocked(piecesApi.publish).mock.calls[0]?.[1];
    expect(typeof key).toBe('string');
    expect((key ?? '').length).toBeGreaterThan(0);
  });

  it('schedule PATCHes metadata then schedules at the given time', async () => {
    const when = new Date(Date.now() + 3_600_000).toISOString();
    const { result } = renderHook(() => useSchedulePiece(), { wrapper: providers() });
    await act(async () => {
      await result.current.mutateAsync({ id: 'p1', patch, scheduledAt: when });
    });
    expect(piecesApi.update).toHaveBeenCalledWith('p1', patch);
    expect(piecesApi.schedule).toHaveBeenCalledWith('p1', when);
    expect(piecesApi.publish).not.toHaveBeenCalled();
  });
});
