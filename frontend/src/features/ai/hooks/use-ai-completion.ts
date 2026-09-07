import { useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AiCompletionRequest } from '@qalam/api-types';

import { ApiError } from '@/lib/api-client';

import { aiApi } from '../api/ai.api';
import { useAiStreamStore } from '../stores/ai-stream.store';

/**
 * Buffered (non-streaming) completion.
 *
 * Stateless since D5: there is no conversation to invalidate on success, because there are no
 * conversations. A completion is one request and one answer.
 */
export function useAiCompletion() {
  return useMutation({
    mutationFn: (payload: AiCompletionRequest) => aiApi.complete(payload),
  });
}

/**
 * Streaming completion. Drives the transient `useAiStreamStore` (tokens accumulate as UI
 * state); `cancel()` aborts the in-flight stream, which stops the server too.
 *
 * Nothing is invalidated when a stream settles. It used to invalidate the conversation so
 * the persisted turns would refetch — there are no persisted turns now, and no query cache
 * entry a completion can stale.
 */
export function useAiStream() {
  const controllerRef = useRef<AbortController | null>(null);

  const start = useCallback(async (payload: AiCompletionRequest): Promise<void> => {
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
  }, []);

  const cancel = useCallback((): void => {
    controllerRef.current?.abort();
  }, []);

  return { start, cancel };
}
