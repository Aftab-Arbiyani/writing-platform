import { useProfileById } from '@/hooks/use-profile';

/**
 * The one resolution every id-bearing collaboration surface uses (B3, docs/45 §4).
 *
 * `MemberDto` / `InvitationDto` / `CommentDto` and their siblings carry ids only — no username,
 * pen name, or avatar (docs/49 §5). Rather than widening a dozen frozen shapes, B3 added
 * `GET /users/by-id/:id`; this hook is where the web client calls it, so `CollaboratorIdentity`
 * and the presence bar (which draws its own avatar shape) name people identically.
 *
 * **Cost.** `useProfileById` is keyed, so TanStack dedups per DISTINCT user: a long comment thread
 * costs one request per participant, not one per row.
 *
 * **Fallback.** A deleted account, a failed lookup, or an id that no longer resolves falls back to
 * a short id fragment — the same honest display these surfaces used to lead with. It is no longer
 * the default; it is the floor. A fabricated name or a blank row would both be worse.
 */
export function useCollaboratorIdentity(
  userId: string,
  isSelf = false,
): { label: string; profile: ReturnType<typeof useProfileById>['data'] } {
  // Skipped for the viewer's own row: "You" needs no network call.
  const { data: profile } = useProfileById(isSelf ? null : userId);

  return {
    label: isSelf ? 'You' : (profile?.penName ?? shortId(userId)),
    profile,
  };
}

/** First and last four of a UUID — recognisable, and obviously an id rather than a name. */
export function shortId(userId: string): string {
  return userId.length > 12 ? `${userId.slice(0, 4)}…${userId.slice(-4)}` : userId;
}
