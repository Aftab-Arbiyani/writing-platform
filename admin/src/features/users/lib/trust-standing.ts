import {
  STRIKE_RESTRICTION_THRESHOLD,
  STRIKE_SUSPENSION_THRESHOLD,
  STRIKE_WEIGHTS,
  TRUST_SCORE_MAX,
  TRUST_SCORE_MIN,
  TrustLevel,
  type StrikeSeverity,
} from '@qalam/shared';
import type { QTagColor } from '@qalam/ui';

import type { AdminRestriction, AdminStrike } from '../types/trust.types';

/**
 * Pure reasoning over a trust standing (AF6, row A2) — kept out of the components so the
 * escalation copy, which is the whole point of this row, can be pinned by a test at the
 * threshold boundaries.
 */

// ── Restriction lifecycle ────────────────────────────────────────────────────

/**
 * What a restriction row currently is. `GET users/:id/restrictions` returns active AND
 * historical rows in one array, so a lifted or expired restriction MUST NOT read as a live
 * sanction — this is the only place the three states are decided.
 *
 * The server's own definition of "active" is `lifted_at IS NULL AND (expires_at IS NULL OR
 * expires_at > now())`, evaluated against the DB clock (`trust.repository.ts:115`). This
 * re-derives it from the browser clock, which can disagree with the server's by seconds around
 * an expiry boundary — harmless for a label, and the reason a lifted row is checked FIRST
 * (`lifted_at` needs no clock at all).
 */
export type RestrictionState = 'active' | 'lifted' | 'expired';

export function restrictionState(
  restriction: AdminRestriction,
  now: Date = new Date(),
): RestrictionState {
  if (restriction.liftedAt !== null) {
    return 'lifted';
  }
  if (
    restriction.expiresAt !== null &&
    new Date(restriction.expiresAt).getTime() <= now.getTime()
  ) {
    return 'expired';
  }
  return 'active';
}

const STATE_TAG: Record<RestrictionState, { label: string; color: QTagColor }> = {
  // "In force" is the wording both customer clients use for a live restriction.
  active: { label: 'In force', color: 'danger' },
  lifted: { label: 'Lifted', color: 'neutral' },
  expired: { label: 'Expired', color: 'neutral' },
};

export function restrictionStateTag(state: RestrictionState): { label: string; color: QTagColor } {
  return STATE_TAG[state];
}

/** Active first, then the historical rows — the server already sorts newest-first within each. */
export function sortRestrictions(
  restrictions: readonly AdminRestriction[],
  now: Date = new Date(),
): AdminRestriction[] {
  const rank = (r: AdminRestriction): number => (restrictionState(r, now) === 'active' ? 0 : 1);
  return [...restrictions].sort((a, b) => rank(a) - rank(b));
}

// ── Strike lifecycle ─────────────────────────────────────────────────────────

/**
 * What a strike row currently is — the same three-state question `restrictionState` answers,
 * and it has to be asked for the same reason: `GET users/:id/strikes` (B9, A2-2) returns
 * active AND historical rows in one array, so a revoked or expired strike must not read as a
 * live one.
 *
 * A revoked row is checked FIRST, because `revoked_at` needs no clock at all — the expiry
 * comparison re-derives the server's `expires_at > now()` against the browser clock, which can
 * disagree by seconds at a boundary.
 *
 * **Only the `active` rows carry weight.** The server sums exactly this set
 * (`sumActiveStrikeWeight`), so the historical rows are what explain a total rather than
 * contribute to it.
 */
export type StrikeState = 'active' | 'revoked' | 'expired';

export function strikeState(strike: AdminStrike, now: Date = new Date()): StrikeState {
  if (strike.revokedAt !== null) {
    return 'revoked';
  }
  if (strike.expiresAt !== null && new Date(strike.expiresAt).getTime() <= now.getTime()) {
    return 'expired';
  }
  return 'active';
}

const STRIKE_STATE_TAG: Record<StrikeState, { label: string; color: QTagColor }> = {
  // "Counting" rather than "In force": what an active strike does is contribute its weight.
  active: { label: 'Counting', color: 'danger' },
  revoked: { label: 'Revoked', color: 'neutral' },
  expired: { label: 'Expired', color: 'neutral' },
};

export function strikeStateTag(state: StrikeState): { label: string; color: QTagColor } {
  return STRIKE_STATE_TAG[state];
}

/** Counting first, then the historical rows — the server already sorts newest-first within each. */
export function sortStrikes(
  strikes: readonly AdminStrike[],
  now: Date = new Date(),
): AdminStrike[] {
  const rank = (s: AdminStrike): number => (strikeState(s, now) === 'active' ? 0 : 1);
  return [...strikes].sort((a, b) => rank(a) - rank(b));
}

/**
 * The active weight the listed strikes account for — the client's own sum of the rows the
 * server would count.
 *
 * It exists to be COMPARED with `TrustSummaryDto.activeStrikeWeight`, not to replace it. The
 * server's figure stays authoritative; a disagreement means a strike expired between the two
 * reads, and the standing card says which number came from where rather than silently picking
 * one. Before B9 this comparison was impossible, which is why the escalation figure had to be
 * described as a projection.
 */
export function countedStrikeWeight(
  strikes: readonly AdminStrike[],
  now: Date = new Date(),
): number {
  return strikes.reduce(
    (total, strike) => (strikeState(strike, now) === 'active' ? total + strike.weight : total),
    0,
  );
}

// ── The score, against its scale ─────────────────────────────────────────────

/**
 * The reputation bands, from `trustLevelForScore` (`packages/shared/src/trust.ts`). A bare "62"
 * tells an operator nothing; "62 — Member (50–79)" tells them where it sits and how far it is
 * from the next boundary down.
 */
export interface TrustBand {
  level: string;
  label: string;
  min: number;
  max: number;
}

/** The lowest band — also the fallback for a score outside 0–100, which the server clamps away. */
const NEW_BAND: TrustBand = {
  level: TrustLevel.New,
  label: 'New',
  min: TRUST_SCORE_MIN,
  max: 24,
};

export const TRUST_BANDS: readonly TrustBand[] = [
  { level: TrustLevel.Trusted, label: 'Trusted', min: 80, max: TRUST_SCORE_MAX },
  { level: TrustLevel.Member, label: 'Member', min: 50, max: 79 },
  { level: TrustLevel.Basic, label: 'Basic', min: 25, max: 49 },
  NEW_BAND,
];

/** The band a score falls in — the same boundaries the server applies, read from the shared file. */
export function bandForScore(score: number): TrustBand {
  return TRUST_BANDS.find((band) => score >= band.min && score <= band.max) ?? NEW_BAND;
}

/** `"50–79"` — the band as a range, for rendering beside the level. */
export function bandRange(band: TrustBand): string {
  return `${band.min}–${band.max}`;
}

// ── Escalation ───────────────────────────────────────────────────────────────

/**
 * What issuing a strike of `severity` would do, given the standing's current active weight.
 *
 * **The total is a stated figure, not a hedge.** A2 had to call it "projected" because nothing
 * could read a strike back, so the client could not check the standing's weight against the rows
 * the server sums. `GET users/:id/strikes` (B9) closes that: `countedStrikeWeight` re-derives the
 * same total from the listed rows, the standing card shows both when they disagree, and the
 * remaining gap is only the seconds between two reads — an ordinary staleness, not a blind spot.
 *
 * The thresholds are the shared constants, not literals: `>= 6` auto-applies a GLOBAL, PERMANENT
 * `suspended` restriction; `>= 3` a global permanent `restricted` one; whichever fires is
 * idempotent — an already-active restriction of that type is not stacked
 * (`trust.service.ts:maybeEscalate` / `ensureGlobalRestriction`).
 */
export type EscalationOutcome = 'none' | 'restrict' | 'suspend';

export interface StrikeProjection {
  weight: number;
  currentWeight: number;
  /** The resulting active weight — `currentWeight + weight`. */
  projected: number;
  outcome: EscalationOutcome;
  /** True when a restriction of the same type is already active, so escalation is a no-op. */
  alreadyEscalated: boolean;
}

export function projectStrike(
  severity: StrikeSeverity,
  currentWeight: number,
  activeRestrictions: readonly AdminRestriction[],
): StrikeProjection {
  const weight = STRIKE_WEIGHTS[severity] ?? 0;
  const projected = currentWeight + weight;
  const outcome: EscalationOutcome =
    projected >= STRIKE_SUSPENSION_THRESHOLD
      ? 'suspend'
      : projected >= STRIKE_RESTRICTION_THRESHOLD
        ? 'restrict'
        : 'none';
  const type = outcome === 'suspend' ? 'suspended' : 'restricted';
  const alreadyEscalated =
    outcome !== 'none' &&
    activeRestrictions.some((r) => r.type === type && r.scope === 'global' && r.liftedAt === null);

  return { weight, currentWeight, projected, outcome, alreadyEscalated };
}

/**
 * The sentence an operator must read before confirming a strike. It always states the weight, the
 * projected total, and the two thresholds — someone issuing what they think is a warning and
 * triggering a suspension is the failure this row exists to prevent.
 */
export function escalationCopy(projection: StrikeProjection): string[] {
  const { weight, currentWeight, projected, outcome, alreadyEscalated } = projection;
  const lines = [
    `This strike carries weight ${weight}. Their active strike weight becomes ${projected}, from ${currentWeight}.`,
  ];

  if (outcome === 'suspend') {
    lines.push(
      alreadyEscalated
        ? `${projected} is at or over the suspension threshold of ${STRIKE_SUSPENSION_THRESHOLD}, but a global suspension is already in force, so no new restriction is added.`
        : `${projected} reaches the suspension threshold of ${STRIKE_SUSPENSION_THRESHOLD}: the server will ALSO apply a permanent global "Suspended" restriction, automatically. Every action the Policy Engine gates is then refused.`,
    );
  } else if (outcome === 'restrict') {
    lines.push(
      alreadyEscalated
        ? `${projected} is at or over the restriction threshold of ${STRIKE_RESTRICTION_THRESHOLD}, but a global restriction is already in force, so no new restriction is added.`
        : `${projected} reaches the restriction threshold of ${STRIKE_RESTRICTION_THRESHOLD}: the server will ALSO apply a permanent global "Restricted" restriction, automatically.`,
    );
    lines.push(
      `Suspension follows automatically at ${STRIKE_SUSPENSION_THRESHOLD} — ${STRIKE_SUSPENSION_THRESHOLD - projected} more weight from here.`,
    );
  } else {
    lines.push(
      `No restriction is applied yet. A restriction follows automatically at ${STRIKE_RESTRICTION_THRESHOLD} and a suspension at ${STRIKE_SUSPENSION_THRESHOLD}.`,
    );
  }

  // Was "A strike cannot be revoked or edited once issued" until B9 gave the surface a revoke
  // (A2-2). It still cannot be EDITED, and revoking is a separate, audited action rather than an
  // undo button on this dialog — so the sentence says what is available and where, not "no undo".
  lines.push(
    'It lowers their score. A strike cannot be edited afterwards, but it can be revoked from the strike list below, which is the only thing that lowers the weight again.',
  );
  return lines;
}
