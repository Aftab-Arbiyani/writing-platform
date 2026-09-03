import type { ExplorerView, StoryAnalysisKind } from '@qalam/api-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { resolveAvailability, type AiAvailability } from '@/lib/ai-availability';
import { getErrorMessage } from '@/lib/errors';
import { qk } from '@/lib/query-keys';

import { storyRetrievalApi } from '../api/story-retrieval.api';
import { useAiFeatures } from './use-ai-meta';

/** A graph projection is cheap and changes only when the story is re-analysed. */
const EXPLORER_STALE = 60_000;

/** One "Map this story" run is every analysis kind, folded into one graph. */
export const STORY_MAP_TOTAL_STEPS = 5;

/**
 * Whether Story Map may be opened, as far as the **flags** are concerned.
 *
 * Its reads carry `@Permissions(AiUse)` and **no feature flag**, and they render the AF3 graph with
 * no model call — so the flag gate is the master switch alone (`feature: null`). Gating on a
 * neighbouring flag would hide a surface the server would happily have served; mobile draws the same
 * distinction, in a comment, at `editor_screen.dart:241-247`.
 *
 * **It is not the whole gate.** D4 made `story_intelligence` entitlement-gated on the server (all six
 * graph reads, the map trigger, and this consumer), so the ENTITLEMENT question is answered
 * separately by `storyMapGate` in `app/routes/write.tsx`. Two questions, two answers, two remedies.
 */
export function useExplorerAvailability(): AiAvailability {
  const features = useAiFeatures();
  return resolveAvailability({ feature: null, features: features.data });
}

/**
 * One Story Map view (`GET /ai/explorer/:storyId/:view`).
 *
 * Disabled without a story id: a draft that has never synced has no server-side story, and asking
 * would only ever return `STORY_NOT_FOUND`.
 *
 * `retry: false` for the reason W5 established on the other retrieval reads — the failures that
 * matter here (`STORY_NOT_FOUND`, `AI_DISABLED`) are terminal, and retrying spends the caller's
 * rate-limit budget to be told the same thing three times.
 */
export function useStoryExplorer(args: {
  storyId: string | null;
  view: ExplorerView;
  enabled?: boolean;
}) {
  const { storyId, view, enabled = true } = args;
  const availability = useExplorerAvailability();
  return useQuery({
    queryKey: qk.retrieval.explorer(storyId ?? '', view),
    queryFn: ({ signal }) => storyRetrievalApi.explore(storyId ?? '', view, signal),
    enabled: enabled && storyId !== null && availability === 'available',
    staleTime: EXPLORER_STALE,
    retry: false,
  });
}

export interface MapStoryProgress {
  step: number;
  total: number;
  analysis: StoryAnalysisKind | null;
}

/**
 * Run "Map this story" (D5) — five analyses, streamed, folded into the graph.
 *
 * **A mutation would have been the wrong shape.** This is not a request with a response; it is a
 * job that reports five times and whose real output is a change to a resource the page is already
 * reading. So it holds progress locally and, on `done`, invalidates every explorer view for the
 * story — the views re-fetch themselves and the writer watches the map fill in.
 *
 * Invalidation is scoped to `qk.retrieval.explorer(storyId, …)` rather than `qk.retrieval.all`:
 * mapping a story cannot change a search result or a recommendation, and throwing those away would
 * re-run unrelated requests to reflect nothing.
 *
 * **A partial run is kept, not rolled back.** Every analysis folds into the graph as it completes, so
 * a run that dies at step four leaves four real analyses behind. `completed` says which, and the
 * views are refreshed either way — reporting failure while silently discarding work the writer's
 * allowance already paid for would be the worse lie.
 */
export function useMapStory(storyId: string | null) {
  const client = useQueryClient();
  const abort = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<MapStoryProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshViews = useCallback(() => {
    if (storyId === null) return;
    void client.invalidateQueries({ queryKey: qk.retrieval.explorer(storyId) });
  }, [client, storyId]);

  const run = useCallback(
    async (content: string, storyTitle?: string): Promise<void> => {
      if (storyId === null || content.trim() === '') return;
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setError(null);
      setProgress({ step: 0, total: STORY_MAP_TOTAL_STEPS, analysis: null });

      try {
        for await (const event of storyRetrievalApi.mapStory(
          storyId,
          { content, ...(storyTitle === undefined ? {} : { storyTitle }) },
          { signal: controller.signal },
        )) {
          if (event.type === 'progress') {
            setProgress({ step: event.step, total: event.total, analysis: event.analysis });
          } else if (event.type === 'error') {
            setError(event.message);
            break;
          }
        }
      } catch (cause) {
        // The pre-stream path: a refusal raised before the first analysis arrives as an ordinary
        // failure envelope, not as an `error` frame.
        setError(getErrorMessage(cause));
      } finally {
        setProgress(null);
        abort.current = null;
        refreshViews();
      }
    },
    [storyId, refreshViews],
  );

  const cancel = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
  }, []);

  return { run, cancel, progress, error, isRunning: progress !== null };
}
