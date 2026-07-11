import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { moderationApi } from '../api/moderation.api';
import { useDeleteNote, useReopenReport, useUpdateNote } from './use-moderation-mutations';

vi.mock('../api/moderation.api', () => ({
  moderationApi: { updateNote: vi.fn(), deleteNote: vi.fn(), updateReport: vi.fn() },
}));

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => vi.clearAllMocks());

describe('note + reopen mutations', () => {
  it('updateNote edits the note and invalidates the cache', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    (moderationApi.updateNote as Mock).mockResolvedValue({ id: 'n1', body: 'edited' });

    const { result } = renderHook(() => useUpdateNote(), { wrapper: makeWrapper(client) });
    act(() => result.current.mutate({ id: 'r1', noteId: 'n1', body: 'edited' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(moderationApi.updateNote).toHaveBeenCalledWith('r1', 'n1', 'edited');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['moderation'] });
  });

  it('deleteNote removes the note and invalidates', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    (moderationApi.deleteNote as Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteNote(), { wrapper: makeWrapper(client) });
    act(() => result.current.mutate({ id: 'r1', noteId: 'n1' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(moderationApi.deleteNote).toHaveBeenCalledWith('r1', 'n1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['moderation'] });
  });

  it('reopenReport PATCHes status back to reviewing', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    (moderationApi.updateReport as Mock).mockResolvedValue({ id: 'r1', status: 'reviewing' });

    const { result } = renderHook(() => useReopenReport(), { wrapper: makeWrapper(client) });
    act(() => result.current.mutate({ id: 'r1' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(moderationApi.updateReport).toHaveBeenCalledWith('r1', { status: 'reviewing' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['moderation'] });
  });
});
