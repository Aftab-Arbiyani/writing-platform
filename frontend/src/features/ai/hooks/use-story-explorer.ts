import type { ExplorerView } from '@qalam/api-types';
import { useQuery } from '@tanstack/react-query';

import { resolveAvailability, type AiAvailability } from '@/lib/ai-availability';
import { qk } from '@/lib/query-keys';

import { storyRetrievalApi } from '../api/story-retrieval.api';
import { useAiFeatures, useAiUsage } from './use-ai-meta';

/** A graph projection is cheap and changes only when the story is re-analysed. */
const EXPLORER_STALE = 60_000;

/**
 * Whether the Story Explorer may be opened (W9).
 *
 * Its route carries `@Permissions(AiUse)` and **no feature flag**, and it renders the AF3 graph with
 * no model call — so its gate is the master AI switch alone (`feature: null`). Gating it on a
 * neighbouring flag would hide a surface the server would happily have served, and gating it on the
 * token allowance would lock a writer out of reading their own story graph for spending tokens
 * somewhere else. Mobile draws the same distinction, in a comment, at `editor_screen.dart:241-247`.
 */
export function useExplorerAvailability(): AiAvailability {
  const features = useAiFeatures();
  const usage = useAiUsage();
  return resolveAvailability({ feature: null, features: features.data, usage: usage.data });
}

/**
 * One Story Explorer view (`GET /ai/explorer/:storyId/:view`).
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
