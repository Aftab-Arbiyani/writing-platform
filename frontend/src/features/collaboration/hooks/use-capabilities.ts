import type { PolicyActionCode } from '@qalam/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { qk } from '@/lib/query-keys';

import { collaborationApi } from '../api/collaboration.api';
import type { StoryCapability } from '../types/collaboration.types';

/**
 * The story's capability map (AF6, W3a — docs/49 §3): the Policy Engine's verdict per action,
 * which the client **reflects** rather than re-derives.
 *
 * Short stale time on purpose. Standing changes — a role change, a strike, a block — invalidate
 * the server's own 30 s decision cache, so holding a longer copy client-side would show
 * affordances the server has already stopped honoring.
 */
const CAPABILITIES_STALE = 30 * 1000;

export function useStoryCapabilities(storyId: string | undefined) {
  return useQuery({
    queryKey: qk.stories.capabilities(storyId ?? ''),
    queryFn: ({ signal }) => collaborationApi.capabilities(storyId ?? '', signal),
    enabled: Boolean(storyId),
    staleTime: CAPABILITIES_STALE,
  });
}

/** What a caller gets back: a resolved verdict plus the loading state that produced it. */
export interface CapabilityVerdict {
  /** True ONLY when the server said so. Absent, loading, or errored all read as false. */
  allowed: (action: PolicyActionCode | string) => boolean;
  /** The full decision, when one is needed (effect / reason / obligations). */
  find: (action: PolicyActionCode | string) => StoryCapability | undefined;
  /** True while the map is in flight — render affordances as pending, not as denied-forever. */
  isLoading: boolean;
  /** True when the map could not be loaded, so everything has failed closed. */
  isDenied: boolean;
}

/**
 * Reads the capability map and **fails closed**, exactly as mobile's `CapabilityGate` does: if
 * the map is loading, errored, or simply does not mention an action, the answer is `false`.
 *
 * The alternative — assuming allowed until told otherwise — flashes a control the viewer may not
 * have, and a control that appears and then vanishes reads as a bug. The server re-checks every
 * write regardless, so the cost of being wrong here is UX, not security.
 */
export function useCapability(storyId: string | undefined): CapabilityVerdict {
  const { data, isLoading, isError } = useStoryCapabilities(storyId);

  return useMemo(() => {
    const byAction = new Map<string, StoryCapability>(
      (data?.capabilities ?? []).map((capability) => [capability.action, capability]),
    );
    return {
      allowed: (action) => byAction.get(action)?.allowed === true,
      find: (action) => byAction.get(action),
      isLoading,
      isDenied: isError,
    };
  }, [data, isLoading, isError]);
}
