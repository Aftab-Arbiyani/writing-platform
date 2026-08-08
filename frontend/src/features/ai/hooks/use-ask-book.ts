import { AiFeature } from '@qalam/shared';
import type { AskBookRequest } from '@qalam/api-types';
import { useCallback, useEffect, useRef } from 'react';

import { ApiError } from '@/lib/api-client';

import { storyRetrievalApi } from '../api/story-retrieval.api';
import { useAskBookStore } from '../stores/ask-book.store';

/** The feature flag `POST /ai/ask[/stream]` is gated by, on top of `ai.use`. */
export const ASK_BOOK_FEATURE = AiFeature.AskBook;

/**
 * Ask My Book (AF4/W9) — stream a grounded answer about one story, with stop.
 *
 * The transport is the shared SSE reader; this only maps frames onto the ask store. Two frames need
 * handling the AF1 assistant does not have:
 *
 * - **`sources` arrives first**, before any token, so the citations render while the answer is still
 *   being written rather than appearing after it.
 * - **A pre-stream failure never becomes an `error` frame.** The controller primes the generator
 *   before opening the stream (`ask-book.controller.ts:62-68`), so `AI_FEATURE_DISABLED`,
 *   `STORY_NOT_FOUND` and a denied entitlement arrive as a thrown `ApiError` with the same stable
 *   code an in-stream failure would have carried — which is why both paths land on `onError` and the
 *   panel's availability gate can read one field either way.
 *
 * `cancel()` aborts the request, which closes the connection; the server wires `req` 'close' to its
 * own AbortController (`ask-book.controller.ts:59-60`), so stopping here stops generation there
 * rather than merely hiding it.
 */
export function useAskBook() {
  const controllerRef = useRef<AbortController | null>(null);

  // A drawer tab unmounts when the writer closes the panel or navigates away from the editor. Without
  // this the request keeps running — and keeps metering — with nothing left to render it.
  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const ask = useCallback(async (payload: AskBookRequest): Promise<void> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const store = useAskBookStore.getState();
    store.begin();
    try {
      for await (const event of storyRetrievalApi.askStream(payload, {
        signal: controller.signal,
      })) {
        switch (event.type) {
          case 'sources':
            store.onSources(event.citations ?? [], event.confidence ?? 0);
            break;
          case 'start':
            store.onStart(event.conversationId ?? null);
            break;
          case 'delta':
            if (event.text !== undefined && event.text !== '') store.appendDelta(event.text);
            break;
          case 'done':
            store.onDone({
              usage: event.usage ?? null,
              conversationId: event.conversationId ?? null,
            });
            break;
          case 'error':
            store.onError(event.code ?? 'AI_STREAM_ERROR');
            break;
          default:
            break;
        }
      }
      /**
       * Settle a stream that closed without a terminal frame.
       *
       * A dropped connection mid-answer ends the iteration with no `done` and no `error`, and
       * without this the tab stays in `streaming` forever: spinner on the Ask button, no Try again,
       * no way back except closing the drawer. Mobile guards the same case in its `onDone`
       * (`ask_book_controller.dart:98-101`); the AF1 assistant is not exposed to it, because a
       * completion that produced no `done` also produced no partial text worth keeping.
       */
      if (useAskBookStore.getState().status === 'streaming') {
        useAskBookStore.getState().onDone({ usage: null, conversationId: null });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        useAskBookStore.getState().onCancelled();
        return;
      }
      useAskBookStore.getState().onError(err instanceof ApiError ? err.code : 'AI_STREAM_ERROR');
    }
  }, []);

  const cancel = useCallback((): void => {
    controllerRef.current?.abort();
  }, []);

  return { ask, cancel };
}
