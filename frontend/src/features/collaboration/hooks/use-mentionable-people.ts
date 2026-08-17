import { useQueries, useQueryClient } from '@tanstack/react-query';

import { profileByIdQueryOptions } from '@/hooks/use-profile';

import type { MentionCandidate } from '../lib/mention-text';
import { useStoryMembers } from './use-members';

/**
 * Who this story's comment composer may mention (P-2, docs/48 §5.1).
 *
 * **The set is the story's own roster, and that is a safety decision, not a convenience one.**
 * `CommentService.notifyComment` notifies every id it is handed with **no access check of any kind**
 * (`comment.service.ts:250-270` — verified; the policy assert above it authorizes the *commenter*,
 * never the mentioned). So whatever a composer is willing to resolve is, in effect, who can be
 * notified about a private story. Mentioning a stranger would tell them a story exists, who is
 * discussing it, and hand them a notification linking to a comment they cannot open.
 *
 * So the candidates come from `GET /stories/:id/members`, which is exactly "people who can see this
 * story": the endpoint synthesises the **owner** row from the piece author before appending the
 * collaborators (`membership.service.ts:102`), so author + members needs no second request and no
 * client-side union.
 *
 * **Why NOT `GET /users/:username`.** The invite dialog resolves an arbitrary handle that way, and
 * P-2's row proposed the same lookup here. It cannot be used: that route resolves *anybody on the
 * platform*, which is precisely the id a mention must never be able to carry. What is reused is the
 * *lesson* of M-1 (docs/48 §3.1) — a mention is an id, and the writer confirms a person before one is
 * sent — and B3's by-id lookup, which turns each member id into the name the typeahead shows.
 *
 * **Cost.** Gated on `enabled`, so the roster resolves when the writer first types `@`, not when the
 * page loads: a reader who never mentions anyone pays nothing. Each profile shares
 * `qk.profiles.byId`, so a collaborator already named in the thread is a cache hit and a story is at
 * most `MAX_STORY_COLLABORATORS + 1` requests once per session.
 *
 * The viewer themselves is **not** filtered out. Writing "as @me noted above" is legitimate prose, and
 * the server drops self-notification anyway (`comment.service.ts:259`), so hiding your own name would
 * only make the list surprising.
 */
export interface MentionablePeople {
  candidates: MentionCandidate[];
  isLoading: boolean;
}

export function useMentionablePeople(
  storyId: string | undefined,
  enabled: boolean,
): MentionablePeople {
  const queryClient = useQueryClient();
  const members = useStoryMembers(enabled ? storyId : undefined);
  const memberIds = members.data?.map((member) => member.userId) ?? [];

  const profiles = useQueries({
    queries: memberIds.map((userId) => ({
      ...profileByIdQueryOptions(userId, queryClient),
      enabled,
    })),
  });

  // A member whose profile has not arrived (or 404s — a deleted account) is simply not offered:
  // inserting a handle the composer cannot show would put an unnamed person into the prose.
  const candidates: MentionCandidate[] = [];
  for (const profile of profiles) {
    const data = profile.data;
    if (data?.username) {
      candidates.push({
        id: data.id,
        username: data.username,
        penName: data.penName,
        avatarKey: data.avatarKey,
      });
    }
  }

  return {
    candidates,
    isLoading: members.isLoading || profiles.some((profile) => profile.isLoading),
  };
}
