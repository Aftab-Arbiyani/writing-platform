import { describe, expect, it } from 'vitest';

import { resolvePieceAllowanceNotice } from './piece-allowance';
import type { PieceLimit } from '../types/piece.types';

function limit(over: Partial<PieceLimit> = {}): PieceLimit {
  return { used: 0, limit: 25, remaining: 25, unlimited: false, canCreate: true, ...over };
}

describe('resolvePieceAllowanceNotice (B4)', () => {
  it('counts down toward a capped plan', () => {
    expect(resolvePieceAllowanceNotice(limit({ used: 24, remaining: 1 })).countLabel).toBe(
      '24 of 25 pieces',
    );
  });

  it('says nothing on an unlimited plan — there is no number to count down', () => {
    const notice = resolvePieceAllowanceNotice(
      limit({ used: 900, limit: 0, remaining: null, unlimited: true }),
    );
    expect(notice.countLabel).toBeNull();
    expect(notice.blocked).toBe(false);
  });

  it('says nothing while the allowance has not loaded', () => {
    expect(resolvePieceAllowanceNotice(undefined)).toEqual({
      countLabel: null,
      blocked: false,
      overLimit: false,
      headline: null,
      description: null,
    });
  });

  it('blocks at the cap, and still shows the count', () => {
    const notice = resolvePieceAllowanceNotice(limit({ used: 25, remaining: 0, canCreate: false }));
    expect(notice.blocked).toBe(true);
    expect(notice.overLimit).toBe(false);
    expect(notice.countLabel).toBe('25 of 25 pieces');
    expect(notice.headline).toBe('You’ve used all 25 pieces on your plan.');
  });

  it('names the over-limit case honestly instead of pretending it is the same thing', () => {
    const notice = resolvePieceAllowanceNotice(
      limit({ used: 100, remaining: 0, canCreate: false }),
    );
    expect(notice.overLimit).toBe(true);
    expect(notice.headline).toBe('You have 100 pieces and your plan includes 25.');
  });

  it('offers delete and upgrade as the remedies, never a reset', () => {
    const notice = resolvePieceAllowanceNotice(limit({ used: 25, remaining: 0, canCreate: false }));
    expect(notice.description).toMatch(/delete a piece/i);
    expect(notice.description).toMatch(/larger plan/i);
    expect(notice.description).not.toMatch(/reset|wait|later/i);
  });

  it('defers to the server verdict rather than recomputing it', () => {
    // Server says yes at 25 of 25 (an override, a mid-flight plan change) — the client agrees.
    expect(resolvePieceAllowanceNotice(limit({ used: 25, remaining: 0 })).blocked).toBe(false);
  });
});
