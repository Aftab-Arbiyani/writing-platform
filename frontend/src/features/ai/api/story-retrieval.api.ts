import type {
  ExplorerView,
  ExplorerViewResponse,
  MapStoryRequest,
  StoryMapStreamEvent,
} from '@qalam/api-types';

import { get, stream } from '@/lib/api-client';

/**
 * Story Map's endpoints (was the two story-scoped AF4 consumers).
 *
 * **Why these are named here and not in `features/search/api/retrieval.api.ts`**, which owns the
 * other `/ai/*` retrieval endpoints: a feature may never import another feature (docs/26 §4), and
 * these hang off the EDITOR, not off search or discover. Splitting by consumer keeps both files
 * deletable with their feature.
 *
 * **D5 deleted the Ask My Book pair** (`POST /ai/ask`, `POST /ai/ask/stream`) — both routes are gone
 * server-side (B2) — and added the map trigger.
 *
 * Everything here is owner-scoped server-side: a story that is not the caller's is
 * `STORY_NOT_FOUND`, never someone else's graph.
 */
export const storyRetrievalApi = {
  /**
   * GET /ai/explorer/:storyId/:view — one structured projection of the story knowledge graph.
   *
   * `ai.use` and no feature flag, and it reaches no model (`story-explorer.controller.ts`), so it is
   * the one surface here that spends no allowance at all.
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

  /**
   * POST /story-intelligence/:storyId/map/stream — run every analysis and fold each into the graph.
   *
   * **This is what makes Story Map a feature rather than a viewer.** Until D5 no client could reach
   * `POST /story-intelligence/:storyId/analyze`, so the graph the eight explorer views project was
   * always empty — a whole surface rendering "nothing here yet" forever (48 §3.22d).
   *
   * SSE because it is five sequential model calls: long enough to sit behind a proxy timeout, and
   * long enough that a writer wants to watch it move.
   *
   * **A pre-stream failure is an ordinary error, not an `error` frame.** The service raises before
   * the first analysis — most usefully `QUOTA_EXCEEDED`, which reserves the whole run so a writer
   * short of allowance is refused up front rather than left with a graph built three-fifths of the
   * way. Callers must handle both paths.
   */
  mapStory: (
    storyId: string,
    payload: MapStoryRequest,
    init?: RequestInit,
  ): AsyncGenerator<StoryMapStreamEvent> =>
    stream<StoryMapStreamEvent>(
      `/story-intelligence/${encodeURIComponent(storyId)}/map/stream`,
      payload,
      init,
    ),
};
