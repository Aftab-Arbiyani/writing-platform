import { PRESENCE_TTL_SECONDS, PresenceState } from '@qalam/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { qk } from '@/lib/query-keys';

import { collaborationApi } from '../api/collaboration.api';

/**
 * Story presence (AF6, W3a) — who else is in this workspace right now.
 *
 * **Polled, not pushed**, and that is a platform fact rather than a shortcut: the backend has no
 * websocket layer, so mobile polls too (docs/49 §6, an explicit non-goal of this epic).
 *
 * The poll and the heartbeat are both derived from `PRESENCE_TTL_SECONDS`, the server's own drop-off
 * window: beat at a third of the TTL so a single lost beat never makes the viewer vanish from
 * everyone else's roster, and refetch at half of it so a departure surfaces within one window.
 */
const TTL_MS = PRESENCE_TTL_SECONDS * 1000;
const POLL_MS = Math.round(TTL_MS / 2);
const HEARTBEAT_MS = Math.round(TTL_MS / 3);

export function useStoryPresence(storyId: string | undefined) {
  return useQuery({
    queryKey: qk.stories.presence(storyId ?? ''),
    queryFn: ({ signal }) => collaborationApi.presence(storyId ?? '', signal),
    enabled: Boolean(storyId),
    refetchInterval: POLL_MS,
    // Presence is worthless when stale — never serve a cached roster as fresh.
    staleTime: 0,
  });
}

/**
 * Announces the viewer while the workspace is open. Best-effort by design: a failed beat is
 * swallowed, because the only consequence is ageing off a roster, and an error toast for
 * "we didn't tell others you're here" would be noise.
 *
 * Beating stops when the tab is hidden, so a backgrounded tab does not hold a phantom presence.
 */
export function usePresenceHeartbeat(storyId: string | undefined, enabled = true): void {
  const beat = useMutation({
    mutationFn: (state: PresenceState) => collaborationApi.heartbeat(storyId ?? '', state),
    // Swallow — see above. Without this an offline tab logs an unhandled rejection per beat.
    onError: () => undefined,
  });

  useEffect(() => {
    if (!storyId || !enabled) return;

    const send = (): void => {
      if (document.visibilityState === 'hidden') return;
      beat.mutate(PresenceState.Active);
    };

    send();
    const timer = window.setInterval(send, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', send);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', send);
    };
    // `beat` is a stable mutation handle; re-running on it would restart the interval each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, enabled]);
}
