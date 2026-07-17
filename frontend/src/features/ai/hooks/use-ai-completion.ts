import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AiCompletionRequest, AiCompletionResponse } from '@qalam/api-types';

import { ApiError } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

import { aiApi } from '../api/ai.api';
import { useAiStreamStore } from '../stores/ai-stream.store';

/** Buffered (non-streaming) completion. Invalidates the conversation on success. */
export function useAiCompletion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: AiCompletionRequest) => aiApi.complete(payload),
    onSuccess: (result: AiCompletionResponse) => {
      if (result.conversationId !== null) {
        void client.invalidateQueries({ queryKey: qk.ai.conversation(result.conversationId) });
      }
    },
  });
}

/**
 * Streaming completion. Drives the transient `useAiStreamStore` (tokens accumulate
 * as UI state); on completion the settled conversation is invalidated so the
 * persisted turns refetch. `cancel()` aborts the in-flight stream (server stops).
 */
export function useAiStream() {
  const client = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (payload: AiCompletionRequest): Promise<void> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const store = useAiStreamStore.getState();
      store.begin();
      try {
        for await (const event of aiApi.stream(payload, { signal: controller.signal })) {
          switch (event.type) {
            case 'start':
              store.onStart(event);
              break;
            case 'delta':
              if (event.text !== undefined && event.text !== '') store.appendDelta(event.text);
              break;
            case 'done':
              store.onDone(event);
              if (payload.conversationId !== undefined) {
                void client.invalidateQueries({
                  queryKey: qk.ai.conversation(payload.conversationId),
                });
              }
              break;
            case 'error':
              store.onError(event.code ?? 'AI_STREAM_ERROR');
              break;
            default:
              break;
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          useAiStreamStore.getState().onCancelled();
          return;
        }
        useAiStreamStore.getState().onError(err instanceof ApiError ? err.code : 'AI_STREAM_ERROR');
      }
    },
    [client],
  );

  const cancel = useCallback((): void => {
    controllerRef.current?.abort();
  }, []);

  return { start, cancel };
}
