import type {
  AskBookRequest,
  AskBookResponse,
  AskBookStreamEvent,
  ExplorerView,
  ExplorerViewResponse,
} from '@qalam/api-types';

import { get, post, stream } from '@/lib/api-client';

/**
 * The two STORY-SCOPED AF4 consumers (W9) — Story Explorer and Ask My Book.
 *
 * **Why these are named here and not in `features/search/api/retrieval.api.ts`**, which owns every
 * other `/ai/*` retrieval endpoint: a feature may never import another feature (docs/26 §4), and
 * these two hang off the EDITOR, not off search or discover. Search's file exists where it does for
 * exactly the same reason — it sits with `search-page` and `discover-page`, the surfaces it serves.
 * Splitting by consumer keeps both files deletable with their feature; merging them would make one
 * feature's api layer a dependency of another's panel.
 *
 * Both endpoints are owner-scoped server-side: a story that is not the caller's is `STORY_NOT_FOUND`,
 * never someone else's graph.
 */
export const storyRetrievalApi = {
  /**
   * GET /ai/explorer/:storyId/:view — one structured projection of the story knowledge graph.
   *
   * `ai.use` and nothing else: no feature flag and no LLM (`story-explorer.controller.ts`), so it is
   * the one AI surface a writer with a spent token allowance can still open.
   *
   * **An unknown `view` is not an error** — `normalizeView` falls back to `map`
   * (`story-explorer.service.ts:53`), so the eight-view set is closed on the CLIENT and a typo here
   * would silently render the whole graph rather than failing loudly. That is why the caller takes
   * an `ExplorerView` rather than a string.
   */
  explore: (
    storyId: string,
    view: ExplorerView,
    signal?: AbortSignal,
  ): Promise<ExplorerViewResponse> =>
    get<ExplorerViewResponse>(
      `/ai/explorer/${encodeURIComponent(storyId)}/${encodeURIComponent(view)}`,
      { signal },
    ),

  /** POST /ai/ask — the buffered grounded answer. Kept for parity with the DTO; the UI streams. */
  ask: (payload: AskBookRequest, signal?: AbortSignal): Promise<AskBookResponse> =>
    post<AskBookResponse>('/ai/ask', payload, { signal }),

  /**
   * POST /ai/ask/stream — the grounded answer, token by token.
   *
   * Reuses the central SSE transport wholesale: the server writes the AF1 wire (`sendSse` puts the
   * event name INSIDE the `data:` JSON as `type`), so `stream<T>()` parses these frames with no
   * AF4-specific handling. The only difference from an AF1 completion is one extra leading frame —
   * `sources`, carrying the citations — which is why this is typed as `AskBookStreamEvent` rather
   * than `AiStreamEvent`.
   *
   * **A pre-stream failure is a normal error, not an `error` frame.** The controller primes the
   * generator before opening the stream (`ask-book.controller.ts:62-68`), so `AI_FEATURE_DISABLED`,
   * `STORY_NOT_FOUND` and a spent allowance arrive as an ordinary failure envelope and surface here
   * as a thrown `ApiError` — the caller must handle both paths.
   */
  askStream: (payload: AskBookRequest, init?: RequestInit): AsyncGenerator<AskBookStreamEvent> =>
    stream<AskBookStreamEvent>('/ai/ask/stream', payload, init),
};
