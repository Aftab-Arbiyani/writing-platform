import { ERROR_CODES } from '@qalam/shared';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

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

  // ── B4 — the plan piece cap reaching the editor (docs/45 §4.9). The editor creates the draft
  //    lazily on first autosave, so this refusal lands mid-typing. It must not be reported as a
  //    generic "will retry", and it must not turn every keystroke into another 402.
  describe('when the plan piece cap refuses the create', () => {
    const capReached = new ApiError(402, {
      code: ERROR_CODES.PIECE_LIMIT_REACHED,
      message: 'Your plan allows 25 pieces and you have 25.',
      details: [{ used: 25, limit: 25 }],
    });

    function renderNewDraft() {
      return renderHook(
        () =>
          useDraftAutosave({
            pieceId: undefined,
            getSnapshot: () => ({ languageCode: 'ur', title: 'Hello', content: DOC }),
            onCreated: vi.fn(),
          }),
        { wrapper: providers() },
      );
    }

    it('reports the cap as its own status, not as a retryable save error', async () => {
      vi.mocked(piecesApi.create).mockRejectedValue(capReached);
      const { result } = renderNewDraft();
      await act(async () => {
        await result.current.flush();
      });
      expect(useEditorUiStore.getState().saveStatus).toBe('limit-error');
    });

    it('stops attempting the create instead of firing a 402 per keystroke', async () => {
      vi.mocked(piecesApi.create).mockRejectedValue(capReached);
      const { result } = renderNewDraft();
      await act(async () => {
        await result.current.flush();
        await result.current.flush();
        await result.current.flush();
      });
      expect(piecesApi.create).toHaveBeenCalledTimes(1);
    });

    it('still autosaves an EXISTING draft — the cap is on creation only', async () => {
      vi.mocked(piecesApi.update).mockResolvedValue(piece('p1'));
      const { result } = renderHook(
        () =>
          useDraftAutosave({
            pieceId: 'p1',
            getSnapshot: () => ({ languageCode: 'ur', title: 'Edited', content: DOC }),
            onCreated: vi.fn(),
          }),
        { wrapper: providers() },
      );
      await act(async () => {
        await result.current.flush();
      });
      expect(useEditorUiStore.getState().saveStatus).toBe('saved');
    });

    it('leaves an ordinary save failure retryable', async () => {
      vi.mocked(piecesApi.create).mockRejectedValue(new Error('boom'));
      const { result } = renderNewDraft();
      await act(async () => {
        await result.current.flush();
        await result.current.flush();
      });
      expect(useEditorUiStore.getState().saveStatus).toBe('error');
      expect(piecesApi.create).toHaveBeenCalledTimes(2);
    });
  });
});
