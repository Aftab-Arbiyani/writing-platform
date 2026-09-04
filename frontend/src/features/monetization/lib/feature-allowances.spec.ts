import { PlanTier, QuotaWindow } from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import type { FeatureQuotaResponse } from '../types/monetization.types';
import { allowanceFor, allowanceLine, normalizeAllowances } from './feature-allowances';
import { firstTierIncluding, planAllowanceLines } from './plan-allowances';

function quota(over: Partial<FeatureQuotaResponse> = {}): FeatureQuotaResponse {
  return {
    limitKey: 'polishActionsPerDay',
    label: 'Polish',
    window: QuotaWindow.Daily,
    used: 12,
    limit: 30,
    remaining: 18,
    unlimited: false,
    resetsAt: null,
    ...over,
  };
}

/**
 * The sentinel, which is the only thing here that can be wrong in a way nobody notices.
 *
 * Across `PlanLimits`, `0` means UNLIMITED — the ordinary convention this platform uses everywhere
 * except `maxCollaborators`. A component that took the raw number would render "12 of 0" or divide
 * by it, and an enterprise plan's generosity would display as a spent allowance. The server already
 * resolves this; these make the guarantee total, because a payload can disagree with itself.
 */
describe('normalizeAllowances — 0 is unlimited, never a limit of zero', () => {
  it('reports a real limit as itself', () => {
    const [allowance] = normalizeAllowances([quota()]);

    expect(allowance?.limit).toBe(30);
    expect(allowance?.remaining).toBe(18);
  });

  it('turns an unlimited allowance into a null limit, not a zero one', () => {
    const [allowance] = normalizeAllowances([
      quota({ unlimited: true, limit: null, remaining: null }),
    ]);

    expect(allowance?.limit).toBeNull();
    expect(allowance?.remaining).toBeNull();
    expect(allowanceLine(allowance!)).toBe('Unlimited');
  });

  it('treats a bare 0 limit as unlimited even when the flag disagrees', () => {
    // A stale or hand-written payload can carry `limit: 0` without `unlimited: true`. Trusting the
    // number would invent a wall on the tier that has none.
    const [allowance] = normalizeAllowances([quota({ unlimited: false, limit: 0 })]);

    expect(allowance?.limit).toBeNull();
  });

  it('recomputes remaining rather than trusting it', () => {
    // `remaining` and `limit` are two numbers that can disagree, and the one a reader sees should
    // follow from the one drawn on the bar.
    const [allowance] = normalizeAllowances([quota({ used: 28, limit: 30, remaining: 99 })]);

    expect(allowance?.remaining).toBe(2);
  });

  it('never reports a negative remaining, even past the cap', () => {
    // A reservation can overshoot: "Map this story" spends five analyses at once.
    const [allowance] = normalizeAllowances([quota({ used: 34, limit: 30, remaining: -4 })]);

    expect(allowance?.remaining).toBe(0);
  });

  it('answers an absent quotas array as no allowances, not a crash', () => {
    // Monetization ships dark-launchable, and a server mid-deploy may not send `quotas` at all.
    expect(normalizeAllowances(undefined)).toEqual([]);
    expect(normalizeAllowances(null)).toEqual([]);
  });
});

describe('allowanceLine — what the writer actually reads', () => {
  it('counts actions in the window, not tokens', () => {
    expect(allowanceLine(normalizeAllowances([quota()])[0]!)).toBe('12 of 30 today');
  });

  it('says "this month" for a monthly window', () => {
    const [allowance] = normalizeAllowances([
      quota({
        limitKey: 'storyAnalysesPerMonth',
        label: 'Story analyses',
        window: QuotaWindow.Monthly,
      }),
    ]);

    expect(allowanceLine(allowance!)).toBe('12 of 30 this month');
  });
});

describe('allowanceFor', () => {
  it('finds an allowance by its limit key', () => {
    const allowances = normalizeAllowances([quota(), quota({ limitKey: 'feedbackReportsPerDay' })]);

    expect(allowanceFor(allowances, 'feedbackReportsPerDay')?.key).toBe('feedbackReportsPerDay');
  });

  it('answers null for a key the server did not report', () => {
    // The hint that consumes this must render nothing rather than a zero — an absent allowance means
    // "no limit" or "monetization is dark", and both should be silent.
    expect(allowanceFor(normalizeAllowances([quota()]), 'storyAnalysesPerMonth')).toBeNull();
  });
});

/**
 * The plan card's lines, derived from `AI_QUOTA_RULES` rather than listed.
 *
 * A second list in the UI would be a copy to keep in step, and the failure is silent: a new
 * allowance key would ship enforced and invisible, so writers would hit a wall the pricing page
 * never mentioned.
 */
describe('planAllowanceLines', () => {
  it('names every allowance rule, in the writer’s units', () => {
    const lines = planAllowanceLines({
      limits: { polishActionsPerDay: 100, feedbackReportsPerDay: 20, storyAnalysesPerMonth: 20 },
    } as never);

    expect(lines).toEqual([
      '100 polish a day',
      '20 manuscript feedback a day',
      '20 story analyses a month',
    ]);
  });

  it('reads 0 as unlimited, which is the whole sentinel', () => {
    const lines = planAllowanceLines({
      limits: { polishActionsPerDay: 0, feedbackReportsPerDay: 0, storyAnalysesPerMonth: 0 },
    } as never);

    for (const line of lines) {
      expect(line).toMatch(/^Unlimited /);
    }
  });

  it('reads an ABSENT key as unlimited too, rather than as none', () => {
    // The enterprise shape, and the one an operator reaches by clearing a row: an omitted ordinary
    // key resolves to unlimited, and rendering "0 a day" there would invert what the plan sells.
    const lines = planAllowanceLines({ limits: {} } as never);

    expect(lines.every((line) => line.startsWith('Unlimited'))).toBe(true);
  });
});

describe('firstTierIncluding — the tier a lock names', () => {
  it('finds the CHEAPEST tier granting a code, not the first one checked', () => {
    expect(firstTierIncluding('ai_writing')).toBe(PlanTier.Plus);
    expect(firstTierIncluding('story_intelligence')).toBe(PlanTier.Pro);
  });

  it('answers null for a code no tier grants', () => {
    // Five of the eight premium codes are in no tier's default set. Inventing a tier would send the
    // reader to a plans page that does not sell what they were just refused.
    expect(firstTierIncluding('marketplace')).toBeNull();
  });
});
