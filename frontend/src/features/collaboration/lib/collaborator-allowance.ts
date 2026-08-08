import type { CollaboratorLimit } from '../types/collaboration.types';

/**
 * What to say about a story's collaborator seat allowance (B6, docs/45 §4.11).
 *
 * Pure, so the wording and the thresholds are testable without a DOM — the same split B4's
 * `piece-allowance.ts` and W4's `subscription-status.ts` use.
 */
export interface CollaboratorAllowanceNotice {
  /** "2 of 3 collaborators" — shown beside the invite action. Null when uncapped. */
  countLabel: string | null;
  /** How much of the count is not yet accepted, e.g. "1 invitation pending". Null when none. */
  pendingLabel: string | null;
  /** True once the server says no further seat may be offered. */
  blocked: boolean;
  /** True in the free case: the plan includes no collaborators at all. */
  free: boolean;
  /** True in the downgrade case: more seats already taken than the plan allows. */
  overLimit: boolean;
  /** Heading for the blocked notice. Null when not blocked. */
  headline: string | null;
  /** Body for the blocked notice — states the remedies that exist. Null when not blocked. */
  description: string | null;
}

const NOT_BLOCKED = {
  blocked: false,
  free: false,
  overLimit: false,
  headline: null,
  description: null,
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * **`unlimited` is the only safe test for "no cap".** B6 inverts the usual sentinel — `limit === 0`
 * means a FREE story with no seats at all, and treating it as uncapped (the convention everywhere
 * else in the product) would show every free author an unlimited allowance and no upsell.
 *
 * Three distinct blocked states, because the honest sentence differs:
 *
 * - **free** — collaboration is not in the plan. This is a sales message, not an error: it says
 *   what the feature is and what unlocks it, so a free author learns the feature EXISTS rather
 *   than meeting a dead button (mobile's C-1 defect, docs/48).
 * - **overLimit** — a downgrade left the story above its new allowance. Nobody is removed
 *   (the decided rule, same as B4); the owner simply cannot add another.
 * - **at the cap** — the ordinary full case, whose remedies are removing someone or upgrading.
 *
 * Never says "try again later": no seat frees itself, so a reset remedy would be a lie (the W4
 * defect, docs/48 §3.6).
 */
export function resolveCollaboratorAllowanceNotice(
  limit: CollaboratorLimit | undefined,
): CollaboratorAllowanceNotice {
  if (limit === undefined || limit.unlimited) {
    return { countLabel: null, pendingLabel: null, ...NOT_BLOCKED };
  }

  const countLabel = `${limit.used} of ${plural(limit.limit, 'collaborator')}`;
  // Only worth saying when a seat is being held by something the owner cannot see in the roster.
  const pendingLabel =
    limit.pendingInvitations > 0
      ? `${plural(limit.pendingInvitations, 'invitation')} pending`
      : null;

  if (limit.canInvite) {
    return { countLabel, pendingLabel, ...NOT_BLOCKED };
  }

  if (limit.limit <= 0) {
    return {
      countLabel: null, // "0 of 0 collaborators" counts down from nothing; the upsell says it better.
      pendingLabel,
      blocked: true,
      free: true,
      overLimit: false,
      headline: 'Collaboration isn’t included in your plan.',
      description:
        'Invite a co-author, editor, or beta reader to write, comment, and suggest edits with ' +
        'you on this story. Plus includes 3 collaborators per story; Pro has no limit.',
    };
  }

  const overLimit = limit.used > limit.limit;
  return {
    countLabel,
    pendingLabel,
    blocked: true,
    free: false,
    overLimit,
    headline: overLimit
      ? `This story has ${plural(limit.used, 'collaborator')} and your plan includes ${limit.limit}.`
      : `You’ve used all ${plural(limit.limit, 'collaborator')} on this story.`,
    description: overLimit
      ? 'Everyone keeps the access they have. To invite someone new, remove a collaborator or ' +
        'move to a larger plan.'
      : 'Remove a collaborator to free a seat, or move to a larger plan. Invitations that haven’t ' +
        'been answered hold a seat too — revoking one frees it.',
  };
}
