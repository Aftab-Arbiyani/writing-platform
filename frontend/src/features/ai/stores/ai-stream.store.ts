import { create } from 'zustand';
import type { AiFinishReason, AiProvider, AiStreamEvent, AiTokenUsage } from '@qalam/api-types';

/**
 * Transient AI-streaming UI state (AF1). Streamed tokens are CLIENT/UI state — the
 * settled result is persisted server-side (conversation) and read back via
 * TanStack Query, never mirrored here (docs/12). Subscribe with narrow selectors.
 */
export type AiStreamStatus = 'idle' | 'streaming' | 'done' | 'error' | 'cancelled';

interface AiStreamState {
  status: AiStreamStatus;
  text: string;
  provider: AiProvider | null;
  model: string | null;
  conversationId: string | null;
  finishReason: AiFinishReason | null;
  usage: AiTokenUsage | null;
  errorCode: string | null;
  begin: () => void;
  onStart: (event: AiStreamEvent) => void;
  appendDelta: (text: string) => void;
  onDone: (event: AiStreamEvent) => void;
  onError: (code: string) => void;
  onCancelled: () => void;
  reset: () => void;
}

const initial = {
  status: 'idle' as AiStreamStatus,
  text: '',
  provider: null,
  model: null,
  conversationId: null,
  finishReason: null,
  usage: null,
  errorCode: null,
};

export const useAiStreamStore = create<AiStreamState>((set) => ({
  ...initial,
  begin: () => set({ ...initial, status: 'streaming' }),
  onStart: (event) =>
    set({
      provider: event.provider ?? null,
      model: event.model ?? null,
      conversationId: event.conversationId ?? null,
    }),
  appendDelta: (text) => set((state) => ({ text: state.text + text })),
  onDone: (event) =>
    set({
      status: 'done',
      finishReason: event.finishReason ?? null,
      usage: event.usage ?? null,
    }),
  onError: (code) => set({ status: 'error', errorCode: code }),
  onCancelled: () => set({ status: 'cancelled' }),
  reset: () => set({ ...initial }),
}));
