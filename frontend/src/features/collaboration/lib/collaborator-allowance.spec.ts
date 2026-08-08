import { describe, expect, it } from 'vitest';

import { resolveCollaboratorAllowanceNotice } from './collaborator-allowance';
import type { CollaboratorLimit } from '../types/collaboration.types';

function seats(over: Partial<CollaboratorLimit> = {}): CollaboratorLimit {
  return {
    storyId: 'story-1',
    members: 0,
    pendingInvitations: 0,
    used: 0,
    limit: 3,
    remaining: 3,
    unlimited: false,
    canInvite: true,
    ...over,
  };
}

describe('resolveCollaboratorAllowanceNotice (B6)', () => {
  /**
   * The inversion regression, on the client side of the wire. `limit: 0` is a FREE story with no
   * seats; everywhere else in this product `0` means unlimited, so a reader (or a later refactor)
   * that applies the usual convention here shows a free author an uncapped allowance and no
   * upsell at all. This is the test that fails when that happens.
   */
  it('treats a FREE story (limit 0) as blocked, never as unlimited', () => {
    const notice = resolveCollaboratorAllowanceNotice(
      seats({ limit: 0, remaining: 0, unlimited: false, canInvite: false }),
    );

    expect(notice.blocked).toBe(true);
    expect(notice.free).toBe(true);
    expect(notice.headline).toBe('Collaboration isn’t included in your plan.');
    // The offer names the feature and its price — a free author has never seen it work.
    expect(notice.description).toContain('Plus includes 3 collaborators');
  });

  it('says nothing on an unlimited plan (limit -1) — no number worth counting down', () => {
    const notice = resolveCollaboratorAllowanceNotice(
      seats({ used: 12, members: 12, limit: -1, remaining: null, unlimited: true }),
    );
    expect(notice.countLabel).toBeNull();
    expect(notice.blocked).toBe(false);
  });

  it('says nothing while the allowance has not loaded', () => {
    expect(resolveCollaboratorAllowanceNotice(undefined)).toEqual({
      countLabel: null,
      pendingLabel: null,
      blocked: false,
      free: false,
      overLimit: false,
      headline: null,
      description: null,
    });
  });

  it('counts down toward a capped plan, before the wall', () => {
    const notice = resolveCollaboratorAllowanceNotice(seats({ members: 2, used: 2, remaining: 1 }));
    expect(notice.countLabel).toBe('2 of 3 collaborators');
    expect(notice.blocked).toBe(false);
  });

  it('names outstanding invitations, which the roster cannot explain on its own', () => {
    // Two people in the roster and a third seat held by an unanswered invitation: the story is
    // full while looking like it has room, and the count alone would read as a bug.
    const notice = resolveCollaboratorAllowanceNotice(
      seats({ members: 2, pendingInvitations: 1, used: 3, remaining: 0, canInvite: false }),
    );
    expect(notice.countLabel).toBe('3 of 3 collaborators');
    expect(notice.pendingLabel).toBe('1 invitation pending');
    expect(notice.blocked).toBe(true);
    expect(notice.description).toContain('revoking one frees it');
  });

  it('blocks at the cap with both real remedies, and no reset', () => {
    const notice = resolveCollaboratorAllowanceNotice(
      seats({ members: 3, used: 3, remaining: 0, canInvite: false }),
    );
    expect(notice.headline).toBe('You’ve used all 3 collaborators on this story.');
    expect(notice.description).toMatch(/remove a collaborator/i);
    expect(notice.description).toMatch(/larger plan/i);
    // The W4 defect (docs/48 §3.6): nothing here resets, so nothing may promise it will.
    expect(notice.description).not.toMatch(/reset|try again|later|next period/i);
  });

  it('keeps everyone after a downgrade and says so', () => {
    const notice = resolveCollaboratorAllowanceNotice(
      seats({ members: 5, used: 5, limit: 3, remaining: 0, canInvite: false }),
    );
    expect(notice.overLimit).toBe(true);
    expect(notice.headline).toBe('This story has 5 collaborators and your plan includes 3.');
    expect(notice.description).toContain('Everyone keeps the access they have');
  });

  it('says "1 collaborator", not "1 collaborators"', () => {
    const notice = resolveCollaboratorAllowanceNotice(
      seats({ members: 1, used: 1, limit: 1, remaining: 0, canInvite: false }),
    );
    expect(notice.countLabel).toBe('1 of 1 collaborator');
    expect(notice.headline).toBe('You’ve used all 1 collaborator on this story.');
  });
});
