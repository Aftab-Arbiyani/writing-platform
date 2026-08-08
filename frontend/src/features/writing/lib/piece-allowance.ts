import type { PieceLimit } from '../types/piece.types';

/**
 * What to say about the author's plan piece allowance (B4, docs/45 §4.9).
 *
 * Pure, so the wording and the thresholds are testable without a DOM — the same split
 * `lib/subscription-status.ts` uses for the W4 banner.
 */
export interface PieceAllowanceNotice {
  /** "24 of 25 pieces" — the count shown beside the create action. Null when uncapped. */
  countLabel: string | null;
  /** True once the server says no more pieces may be created. */
  blocked: boolean;
  /** True in the downgrade case: more pieces already held than the plan allows. */
  overLimit: boolean;
  /** Heading for the blocked notice. Null when not blocked. */
  headline: string | null;
  /** Body for the blocked notice — states both remedies. Null when not blocked. */
  description: string | null;
}

const NOT_BLOCKED = { blocked: false, overLimit: false, headline: null, description: null };

/**
 * An unlimited plan gets NO count: "900 of unlimited pieces" is noise, and a number that never
 * approaches anything is not information. A capped plan always gets one, whether or not it is
 * close to the cap — surfacing it only near the limit is how an author gets surprised by it.
 *
 * The blocked copy never says "wait" or "try again later". Nothing here resets; the two things
 * that actually free the author are deleting a piece and changing plan, so those are the two
 * things it says. (Offering a reset date instead is the W4 defect, docs/48 §3.6.)
 */
export function resolvePieceAllowanceNotice(limit: PieceLimit | undefined): PieceAllowanceNotice {
  if (limit === undefined || limit.unlimited) {
    return { countLabel: null, ...NOT_BLOCKED };
  }

  const countLabel = `${limit.used} of ${limit.limit} pieces`;
  if (limit.canCreate) {
    return { countLabel, ...NOT_BLOCKED };
  }

  const overLimit = limit.used > limit.limit;
  return {
    countLabel,
    blocked: true,
    overLimit,
    headline: overLimit
      ? `You have ${limit.used} pieces and your plan includes ${limit.limit}.`
      : `You’ve used all ${limit.limit} pieces on your plan.`,
    description:
      'Everything you’ve written stays exactly where it is — published, readable and editable. ' +
      'To start something new, delete a piece to free a slot, or move to a larger plan.',
  };
}
