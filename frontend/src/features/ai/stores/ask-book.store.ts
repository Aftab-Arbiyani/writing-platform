import { create } from 'zustand';
import type { AiTokenUsage, AskCitation } from '@qalam/api-types';

import type { AiStreamStatus } from './ai-stream.store';

/**
 * Transient Ask My Book streaming state (AF4/W9) — the answer as it arrives, plus the citations it
 * is grounded in.
 *
 * **Why this is a sibling of `ai-stream.store.ts` and not an extension of it.** The delta/done/error
 * handling really is the same, and the TRANSPORT is shared wholesale — `stream<T>()` in the api
 * client parses these frames with no AF4-specific code, which is the part worth not forking. The
 * state is a different matter, for three reasons that each break on their own:
 *
 * 1. **Both streams can be live at once.** The assistant and this share one drawer, and the writer
 *    can start an ask while a suggestion is still generating. One store means one `text` buffer, and
 *    the second stream's deltas would append to the first's answer.
 * 2. **The panel's availability gate reads `errorCode`.** `WritingAssistantPanel.resolve()` treats a
 *    mid-flight failure as authoritative for a tab; a shared code would let a spent allowance on the
 *    ask wall off the assistant, and vice versa.
 * 3. **The field sets diverge in both directions.** `sources` has no AF1 counterpart, and
 *    `provider`/`model`/`finishReason` are never forwarded on this stream (`ask-book.service.ts`
 *    re-emits only `start`/`delta`/`done`). Widening one store would give each half fields the
 *    other's protocol cannot populate.
 *
 * The status vocabulary is imported rather than restated, so the two surfaces stay describable in
 * the same words.
 */
interface AskBookState {
  status: AiStreamStatus;
  answer: string;
  /**
   * The evidence the answer is grounded in. Arrives on the `sources` frame BEFORE the first token
   * (`ask-book.service.ts:91`), so it is renderable while the answer is still being written — the
   * one thing that makes a grounded answer verifiable rather than merely asserted.
   */
  citations: AskCitation[];
  /** The retrieval's aggregate confidence (0..1), carried on the same `sources` frame. */
  confidence: number;
  conversationId: string | null;
  usage: AiTokenUsage | null;
  errorCode: string | null;
  begin: () => void;
  onSources: (citations: AskCitation[], confidence: number) => void;
  onStart: (conversationId: string | null) => void;
  appendDelta: (text: string) => void;
  onDone: (args: { usage: AiTokenUsage | null; conversationId: string | null }) => void;
  onError: (code: string) => void;
  onCancelled: () => void;
  reset: () => void;
}

const initial = {
  status: 'idle' as AiStreamStatus,
  answer: '',
  citations: [] as AskCitation[],
  confidence: 0,
  conversationId: null,
  usage: null,
  errorCode: null,
};

export const useAskBookStore = create<AskBookState>((set) => ({
  ...initial,
  begin: () => set({ ...initial, status: 'streaming' }),
  onSources: (citations, confidence) => set({ citations, confidence }),
  // `start` may carry a null conversationId (the ask was not bound to one); that is a real value,
  // not a missing one, so it is written through rather than coalesced away.
  onStart: (conversationId) => set({ status: 'streaming', conversationId }),
  appendDelta: (text) => set((state) => ({ answer: state.answer + text })),
  onDone: ({ usage, conversationId }) =>
    set((state) => ({
      status: 'done',
      usage,
      conversationId: conversationId ?? state.conversationId,
    })),
  onError: (code) => set({ status: 'error', errorCode: code }),
  // Cancelling keeps whatever arrived: a half-written answer the writer chose to stop is still
  // theirs to read, and its citations were complete before the first token.
  onCancelled: () => set({ status: 'cancelled' }),
  reset: () => set({ ...initial }),
}));
