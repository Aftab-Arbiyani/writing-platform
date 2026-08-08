import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { publishingApi } from '../api/publishing.api';

/**
 * Content snapshots — a story's read-only version history (AF6, W3c — docs/49 §5).
 *
 * A snapshot is identified by its `version` and its `reason` (`publish` / `manual` / `pre_edit` /
 * `review` / `restore`). There is no label: the create handler takes no body and hard-codes
 * `manual`, so the `label` mobile sent was discarded silently (defects P-7/P-8).
 */
const SNAPSHOTS_STALE = 30 * 1000;

/**
 * This story's version history, newest first — `{ items, total, visible, hidden, limit, unlimited }`
 * (B7, docs/45 §4.12), not a bare array.
 *
 * `items` is clamped to the depth the story OWNER's plan shows; `total` is what is really stored.
 * Read the count from `total` and never from `items.length`, which is the clamped number and would
 * report a thirty-two-version story as having five.
 */
export function useStorySnapshots(storyId: string | undefined) {
  return useQuery({
    queryKey: qk.stories.snapshots(storyId ?? ''),
    queryFn: ({ signal }) => publishingApi.snapshots(storyId ?? '', signal),
    enabled: Boolean(storyId),
    staleTime: SNAPSHOTS_STALE,
  });
}

export function useSnapshotActions(storyId: string) {
  const client = useQueryClient();

  /** Capture — no body. The reason is the server's (`manual`), not the caller's. */
  const createSnapshot = useMutation({
    mutationFn: () => publishingApi.createSnapshot(storyId),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: qk.stories.snapshots(storyId) }),
        client.invalidateQueries({ queryKey: qk.stories.history(storyId) }),
      ]);
    },
  });

  /**
   * Revert — restores a version's content onto the live piece, and answers the **piece**, not the
   * snapshot (P-1).
   *
   * Because it rewrites the body, it must drop the piece caches as well as the version list: the
   * editor hydrates TipTap from `qk.pieces.detail` once and then autosaves the whole document with
   * no stale-write check, so a cached pre-revert body would be PATCHed straight back over the
   * restored text. Same hazard, and the same fix, as accepting a suggestion (C-13).
   */
  const revert = useMutation({
    mutationFn: (snapshotId: string) => publishingApi.revert(storyId, snapshotId),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: qk.stories.snapshots(storyId) }),
        client.invalidateQueries({ queryKey: qk.stories.history(storyId) }),
        client.invalidateQueries({ queryKey: qk.pieces.all }),
      ]);
    },
  });

  return { createSnapshot, revert };
}
