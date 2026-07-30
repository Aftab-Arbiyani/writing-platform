import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { piecesApi } from '../api/pieces.api';
import { useEditorUiStore } from '../stores/editor-ui.store';
import type { Piece, TipTapDoc } from '../types/piece.types';
import { useDraftAutosave, type DraftSnapshot } from './use-draft-autosave';

vi.mock('../api/pieces.api', () => ({ piecesApi: { create: vi.fn(), update: vi.fn() } }));

function providers() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const DOC: TipTapDoc = { type: 'doc', content: [] };
const piece = (id: string): Piece => ({ id }) as Piece;

describe('useDraftAutosave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorUiStore.getState().reset();
  });

  it('creates the draft on the first save, then PATCHes on the next', async () => {
    vi.mocked(piecesApi.create).mockResolvedValue(piece('new-1'));
    vi.mocked(piecesApi.update).mockResolvedValue(piece('new-1'));
    const onCreated = vi.fn();
    const snapshot: DraftSnapshot = { languageCode: 'ur', title: 'Hello', content: DOC };

    const { result } = renderHook(
      () => useDraftAutosave({ pieceId: undefined, getSnapshot: () => snapshot, onCreated }),
      { wrapper: providers() },
    );

    await act(async () => {
      await result.current.flush();
    });
    expect(piecesApi.create).toHaveBeenCalledWith({
      languageCode: 'ur',
      title: 'Hello',
      content: DOC,
    });
    expect(onCreated).toHaveBeenCalledWith('new-1');
    expect(useEditorUiStore.getState().saveStatus).toBe('saved');

    await act(async () => {
      await result.current.flush();
    });
    expect(piecesApi.create).toHaveBeenCalledTimes(1);
    expect(piecesApi.update).toHaveBeenCalledWith('new-1', {
      title: 'Hello',
      content: DOC,
      languageCode: 'ur',
    });
  });

  it('does not create a draft without a language', async () => {
    const { result } = renderHook(
      () =>
        useDraftAutosave({
          pieceId: undefined,
          getSnapshot: () => ({ languageCode: '', title: '', content: DOC }),
          onCreated: vi.fn(),
        }),
      { wrapper: providers() },
    );
    await act(async () => {
      const id = await result.current.flush();
      expect(id).toBeUndefined();
    });
    expect(piecesApi.create).not.toHaveBeenCalled();
  });

  it('PATCHes an existing draft', async () => {
    vi.mocked(piecesApi.update).mockResolvedValue(piece('p1'));
    const { result } = renderHook(
      () =>
        useDraftAutosave({
          pieceId: 'p1',
          getSnapshot: () => ({ languageCode: 'hi', title: 'T', content: DOC }),
          onCreated: vi.fn(),
        }),
      { wrapper: providers() },
    );
    await act(async () => {
      await result.current.flush();
    });
    expect(piecesApi.create).not.toHaveBeenCalled();
    expect(piecesApi.update).toHaveBeenCalledWith('p1', {
      title: 'T',
      content: DOC,
      languageCode: 'hi',
    });
  });
});
