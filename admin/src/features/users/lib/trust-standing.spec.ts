import {
  RestrictionScope,
  RestrictionType,
  STRIKE_RESTRICTION_THRESHOLD,
  STRIKE_SUSPENSION_THRESHOLD,
  StrikeSeverity,
  trustLevelForScore,
} from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import type { AdminRestriction } from '../types/trust.types';
import {
  bandForScore,
  projectStrike,
  restrictionState,
  sortRestrictions,
  TRUST_BANDS,
} from './trust-standing';

const NOW = new Date('2026-08-17T12:00:00.000Z');

function restriction(over: Partial<AdminRestriction> = {}): AdminRestriction {
  return {
    id: 'r1',
    userId: 'u1',
    type: RestrictionType.Muted,
    scope: RestrictionScope.Comments,
    reason: 'Harassment in comments',
    issuedById: 'mod1',
    expiresAt: null,
    liftedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

describe('restrictionState — a lifted or expired row is not a live sanction', () => {
  it('is active with no expiry and no lift', () => {
    expect(restrictionState(restriction(), NOW)).toBe('active');
  });

  it('is active while the expiry is still ahead', () => {
    expect(restrictionState(restriction({ expiresAt: '2026-08-24T12:00:00.000Z' }), NOW)).toBe(
      'active',
    );
  });

  it('is expired once the expiry has passed', () => {
    expect(restrictionState(restriction({ expiresAt: '2026-08-16T12:00:00.000Z' }), NOW)).toBe(
      'expired',
    );
  });

  it('is expired exactly AT the expiry — the server compares `expires_at > now()`', () => {
    expect(restrictionState(restriction({ expiresAt: NOW.toISOString() }), NOW)).toBe('expired');
  });

  it('is lifted whenever `liftedAt` is set, even with a future expiry', () => {
    const row = restriction({
      liftedAt: '2026-08-10T00:00:00.000Z',
      expiresAt: '2026-12-01T00:00:00.000Z',
    });
    expect(restrictionState(row, NOW)).toBe('lifted');
  });

  it('puts the active rows first — history must not lead the list', () => {
    const rows = [
      restriction({ id: 'lifted', liftedAt: '2026-08-02T00:00:00.000Z' }),
      restriction({ id: 'expired', expiresAt: '2026-08-05T00:00:00.000Z' }),
      restriction({ id: 'active' }),
    ];
    expect(sortRestrictions(rows, NOW).map((r) => r.id)).toEqual(['active', 'lifted', 'expired']);
  });
});

describe('bandForScore — the same boundaries the server tiers by', () => {
  it.each([0, 1, 24, 25, 49, 50, 62, 79, 80, 99, 100])(
    'agrees with `trustLevelForScore` at %i',
    (score) => {
      expect(bandForScore(score).level).toBe(trustLevelForScore(score));
    },
  );

  it('covers 0–100 with no gap and no overlap', () => {
    for (let score = 0; score <= 100; score += 1) {
      const hits = TRUST_BANDS.filter((band) => score >= band.min && score <= band.max);
      expect(hits).toHaveLength(1);
    }
  });
});

describe('projectStrike — the weights and thresholds are the shared constants', () => {
  it('weights minor 1, moderate 2, severe 4', () => {
    expect(projectStrike(StrikeSeverity.Minor, 0, []).weight).toBe(1);
    expect(projectStrike(StrikeSeverity.Moderate, 0, []).weight).toBe(2);
    expect(projectStrike(StrikeSeverity.Severe, 0, []).weight).toBe(4);
  });

  it('escalates to nothing below the restriction threshold', () => {
    const projection = projectStrike(StrikeSeverity.Minor, STRIKE_RESTRICTION_THRESHOLD - 2, []);
    expect(projection.projected).toBe(STRIKE_RESTRICTION_THRESHOLD - 1);
    expect(projection.outcome).toBe('none');
  });

  it('escalates to a restriction exactly AT the restriction threshold', () => {
    const projection = projectStrike(StrikeSeverity.Minor, STRIKE_RESTRICTION_THRESHOLD - 1, []);
    expect(projection.projected).toBe(STRIKE_RESTRICTION_THRESHOLD);
    expect(projection.outcome).toBe('restrict');
  });

  it('escalates to a suspension exactly AT the suspension threshold', () => {
    const projection = projectStrike(StrikeSeverity.Minor, STRIKE_SUSPENSION_THRESHOLD - 1, []);
    expect(projection.projected).toBe(STRIKE_SUSPENSION_THRESHOLD);
    expect(projection.outcome).toBe('suspend');
  });

  it('reports a suspension as already in force, so the copy does not promise a second one', () => {
    const active = [
      restriction({ type: RestrictionType.Suspended, scope: RestrictionScope.Global }),
    ];
    const projection = projectStrike(StrikeSeverity.Severe, STRIKE_SUSPENSION_THRESHOLD, active);
    expect(projection.outcome).toBe('suspend');
    expect(projection.alreadyEscalated).toBe(true);
  });

  it('does not treat a SCOPED restriction of the same type as the global one', () => {
    // `ensureGlobalRestriction` only skips when an ACTIVE row matches type AND `global` scope.
    const active = [
      restriction({ type: RestrictionType.Suspended, scope: RestrictionScope.Publishing }),
    ];
    expect(
      projectStrike(StrikeSeverity.Severe, STRIKE_SUSPENSION_THRESHOLD, active).alreadyEscalated,
    ).toBe(false);
  });
});
