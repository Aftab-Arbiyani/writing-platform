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

import type { AdminRestriction } from '../types/trust.types';

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
 * **`projected` is a PROJECTION, not a server-confirmed figure.** The server recomputes the total
 * from the strike rows (`sumActiveStrikeWeight`), so a strike that expired since this standing was
 * fetched would make the real total lower. There is also no route that lists strikes, so the client
 * has no way to check (defect A2-2). The copy says "projected" for exactly that reason.
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
    `This strike carries weight ${weight}. Their active strike weight becomes ${projected} (projected from ${currentWeight}).`,
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

  lines.push('A strike cannot be revoked or edited once issued, and lowers their score.');
  return lines;
}
