import {
  ERROR_CODES,
  RestrictionScope,
  RestrictionType,
  Role,
  StrikeSeverity,
  TrustLevel,
  TrustStatus,
  UserStatus,
} from '@qalam/shared';

import type { AuditService } from '../audit/audit.service';
import type { PolicyEngineService } from '../policy';
import type { NotificationsService } from '../notifications';
import type { UsersService } from '../users/users.service';

import type { TrustProfile } from './entities/trust-profile.entity';
import type { UserBlock } from './entities/user-block.entity';
import type { UserRestriction } from './entities/user-restriction.entity';
import type { UserStrike } from './entities/user-strike.entity';
import { TRUST_AUDIT_ACTIONS } from './trust.constants';
import { TrustRepository } from './trust.repository';
import { TrustService, type TrustActor } from './trust.service';

const actor: TrustActor = { id: 'mod1', role: Role.Moderator };

const NOW = new Date('2026-07-20T00:00:00.000Z');

function profile(overrides: Partial<TrustProfile> = {}): TrustProfile {
  return {
    id: 'tp1',
    userId: 'user1',
    score: 50,
    level: TrustLevel.Member,
    activeStrikeWeight: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as TrustProfile;
}

function restriction(overrides: Partial<UserRestriction> = {}): UserRestriction {
  return {
    id: 'ur1',
    userId: 'user1',
    type: RestrictionType.Restricted,
    scope: RestrictionScope.Global,
    reason: 'because',
    issuedById: 'mod1',
    expiresAt: null,
    liftedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as UserRestriction;
}

function strike(overrides: Partial<UserStrike> = {}): UserStrike {
  return {
    id: 's1',
    userId: 'user1',
    severity: StrikeSeverity.Minor,
    reason: 'spam',
    weight: 1,
    reportId: null,
    issuedById: 'mod1',
    expiresAt: null,
    revokedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as UserStrike;
}

function block(overrides: Partial<UserBlock> = {}): UserBlock {
  return {
    id: 'b1',
    blockerId: 'user1',
    blockedId: 'user2',
    kind: 'block',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as UserBlock;
}

function makeService(
  over: {
    repo?: Partial<TrustRepository>;
    audit?: Partial<AuditService>;
    engine?: Partial<PolicyEngineService>;
    notifications?: Partial<NotificationsService>;
    users?: Partial<UsersService>;
  } = {},
) {
  const repo = {
    findProfile: jest.fn().mockResolvedValue(profile()),
    saveProfile: jest.fn((p: TrustProfile) => Promise.resolve(p)),
    listActiveStrikes: jest.fn().mockResolvedValue([]),
    listStrikesForUser: jest.fn().mockResolvedValue([]),
    findStrike: jest.fn().mockResolvedValue(strike()),
    sumActiveStrikeWeight: jest.fn().mockResolvedValue(0),
    createStrike: jest.fn((input) => Promise.resolve(strike(input))),
    revokeStrike: jest.fn(),
    listActiveRestrictions: jest.fn().mockResolvedValue([]),
    createRestriction: jest.fn((input) => Promise.resolve(restriction(input))),
    findRestriction: jest.fn().mockResolvedValue(restriction()),
    liftRestriction: jest.fn(),
    listRestrictionsForUser: jest.fn().mockResolvedValue([]),
    findBlock: jest.fn().mockResolvedValue(null),
    createBlock: jest.fn((input) => Promise.resolve(block(input))),
    deleteBlock: jest.fn(),
    isBlockedEitherWay: jest.fn().mockResolvedValue(false),
    listBlocks: jest.fn().mockResolvedValue([]),
    ...over.repo,
  };
  const audit = { record: jest.fn(), ...over.audit };
  const engine = { invalidateUser: jest.fn(), ...over.engine };
  const notifications = { create: jest.fn().mockResolvedValue(undefined), ...over.notifications };
  // A real account by default (B9, A2-4): the admin reads now prove the id exists, so a
  // spec that wants the unknown-id case overrides `findById` with `null` explicitly.
  const users = { findById: jest.fn().mockResolvedValue({ id: 'user1' }), ...over.users };
  const service = new TrustService(
    repo as unknown as TrustRepository,
    audit as unknown as AuditService,
    engine as unknown as PolicyEngineService,
    users as unknown as UsersService,
    notifications as unknown as NotificationsService,
  );
  return { service, repo, audit, engine, notifications, users };
}

describe('TrustService.computeStatus (via getSummary / resolveTrustContext)', () => {
  it('an active suspended restriction resolves to Suspended', async () => {
    const { service } = makeService({
      repo: {
        listActiveRestrictions: jest
          .fn()
          .mockResolvedValue([restriction({ type: RestrictionType.Suspended })]),
      },
    });
    const summary = await service.getSummary('user1');
    expect(summary.status).toBe(TrustStatus.Suspended);
  });

  it('picks the MOST severe active restriction when several apply', async () => {
    const { service } = makeService({
      repo: {
        listActiveRestrictions: jest
          .fn()
          .mockResolvedValue([
            restriction({ type: RestrictionType.Muted }),
            restriction({ type: RestrictionType.Shadow }),
          ]),
      },
    });
    const summary = await service.getSummary('user1');
    // Shadow (shadowed) outranks Muted.
    expect(summary.status).toBe(TrustStatus.Shadowed);
  });

  it('score >= 80 → Trusted when unrestricted', async () => {
    const { service } = makeService({
      repo: { findProfile: jest.fn().mockResolvedValue(profile({ score: 85 })) },
    });
    const ctx = await service.resolveTrustContext('user1');
    expect(ctx.status).toBe(TrustStatus.Trusted);
    expect(ctx.level).toBe(TrustLevel.Trusted);
  });

  it('score < 25 → Limited when unrestricted', async () => {
    const { service } = makeService({
      repo: { findProfile: jest.fn().mockResolvedValue(profile({ score: 10 })) },
    });
    const ctx = await service.resolveTrustContext('user1');
    expect(ctx.status).toBe(TrustStatus.Limited);
  });

  it('mid-range score → Normal when unrestricted', async () => {
    const { service } = makeService();
    const ctx = await service.resolveTrustContext('user1');
    expect(ctx.status).toBe(TrustStatus.Normal);
  });
});

describe('TrustService.resolveTrustContext', () => {
  it('returns the port shape (status, level, {type,scope}[]) and never creates a profile', async () => {
    const findProfile = jest.fn().mockResolvedValue(null);
    const saveProfile = jest.fn();
    const { service } = makeService({
      repo: {
        findProfile,
        saveProfile,
        listActiveRestrictions: jest
          .fn()
          .mockResolvedValue([
            restriction({ type: RestrictionType.Muted, scope: RestrictionScope.Comments }),
          ]),
      },
    });
    const ctx = await service.resolveTrustContext('user1');
    expect(ctx).toEqual({
      status: TrustStatus.Muted,
      level: TrustLevel.Member, // default score 50
      restrictions: [{ type: RestrictionType.Muted, scope: RestrictionScope.Comments }],
    });
    // Hot path: reads only, must not write a default profile row.
    expect(saveProfile).not.toHaveBeenCalled();
  });
});

describe('TrustService.getSummary / inspectSummary — a read is a read (B9, A2-4)', () => {
  it('writes NO profile row for a user who has never been struck', async () => {
    // The test that would have caught A2-4. `getSummary` called `getOrCreateProfile`, so
    // every read of an untouched account INSERTED a row — and since `trust_profiles` has
    // no FK to `users`, a mistyped UUID minted one for an account that does not exist.
    const saveProfile = jest.fn();
    const { service } = makeService({
      repo: { findProfile: jest.fn().mockResolvedValue(null), saveProfile },
    });

    const summary = await service.getSummary('user1');

    expect(saveProfile).not.toHaveBeenCalled();
    // And the answer is unchanged: the defaults are derived in memory, exactly as
    // `resolveTrustContext` already derived them.
    expect(summary).toEqual({
      score: 50,
      level: TrustLevel.Member,
      status: TrustStatus.Normal,
      activeStrikeWeight: 0,
      restrictions: [],
    });
  });

  it('404s an id that belongs to nobody instead of inventing a clean standing', async () => {
    const saveProfile = jest.fn();
    const { service, repo } = makeService({
      repo: { findProfile: jest.fn().mockResolvedValue(null), saveProfile },
      users: { findById: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.inspectSummary('user1')).rejects.toMatchObject({
      code: ERROR_CODES.USER_NOT_FOUND,
    });
    // Nothing was read from the trust tables either — the existence check comes first,
    // so a mistyped id cannot leave a trace of any kind.
    expect(repo.findProfile).not.toHaveBeenCalled();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it('carries the ACCOUNT status so the admin surface cannot read "good standing" for a suspended account (A2-1)', async () => {
    const { service } = makeService({
      users: {
        findById: jest.fn().mockResolvedValue({ id: 'user1', status: UserStatus.Suspended }),
      },
    });

    const summary = await service.inspectSummary('user1');

    // The trust standing is genuinely clean — a suspension writes no restriction. That
    // is precisely why the account status has to travel beside it.
    expect(summary.status).toBe(TrustStatus.Normal);
    expect(summary.accountStatus).toBe(UserStatus.Suspended);
  });

  it('leaves the SELF read without an account status — its id came from the JWT', async () => {
    const { service } = makeService();
    await expect(service.getSummary('user1')).resolves.not.toHaveProperty('accountStatus');
  });

  it('404s the restriction list for an unknown id rather than returning an empty history', async () => {
    const { service, repo } = makeService({
      users: { findById: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.listRestrictions('user1')).rejects.toMatchObject({
      code: ERROR_CODES.USER_NOT_FOUND,
    });
    expect(repo.listRestrictionsForUser).not.toHaveBeenCalled();
  });
});

describe('TrustService.listStrikes / revokeStrike — strikes are no longer write-only (B9, A2-2)', () => {
  it('lists ACTIVE and HISTORICAL strikes, so a weight can be explained', async () => {
    // The test that would have caught A2-2: nothing could read a strike back, so the
    // admin surface had to project what one WOULD do. The revoked row travels because
    // `activeStrikeWeight` counts only the live ones — a list of live strikes alone
    // could never explain a total an operator disagrees with.
    const rows = [
      strike({ id: 's1', revokedAt: null }),
      strike({ id: 's2', revokedAt: NOW }),
      strike({ id: 's3', expiresAt: new Date('2026-01-01T00:00:00.000Z') }),
    ];
    const { service } = makeService({
      repo: { listStrikesForUser: jest.fn().mockResolvedValue(rows) },
    });

    const strikes = await service.listStrikes('user1');

    expect(strikes.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(strikes[1]?.revokedAt).not.toBeNull();
  });

  it('404s the strike list for an unknown user id (A2-4)', async () => {
    const { service } = makeService({ users: { findById: jest.fn().mockResolvedValue(null) } });
    await expect(service.listStrikes('user1')).rejects.toMatchObject({
      code: ERROR_CODES.USER_NOT_FOUND,
    });
  });

  it('revokes, audits with the DECLARED StrikeRevoke action, and invalidates the cache', async () => {
    // `revokeStrike` and `TRUST_AUDIT_ACTIONS.StrikeRevoke` were both declared and never
    // called; a jest mock was the only reference to either outside its definition.
    const { service, repo, audit, engine } = makeService({
      repo: {
        findStrike: jest.fn().mockResolvedValue(strike({ id: 's1', weight: 4 })),
        sumActiveStrikeWeight: jest.fn().mockResolvedValue(0),
        findProfile: jest.fn().mockResolvedValue(profile({ score: 30, activeStrikeWeight: 4 })),
      },
    });

    const revoked = await service.revokeStrike('s1', actor);

    expect(repo.revokeStrike).toHaveBeenCalledWith('s1');
    expect(revoked.revokedAt).not.toBeNull();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: TRUST_AUDIT_ACTIONS.StrikeRevoke, targetId: 's1' }),
    );
    // A revoke can only widen what a user may do, so a cached deny must not outlive it.
    expect(engine.invalidateUser).toHaveBeenCalledWith('user1');
  });

  it('recomputes weight and score FROM THE LEDGER, not by adding the penalty back', async () => {
    // The clamp is why. A severe strike (weight 4 → 20 points) against a score of 3 lands
    // on 0, taking 3 points, not 20. Adding 20 back would hand out points the strike never
    // took; re-deriving from the remaining active weight cannot.
    const { service, repo } = makeService({
      repo: {
        findStrike: jest.fn().mockResolvedValue(strike({ id: 's1', weight: 4 })),
        sumActiveStrikeWeight: jest.fn().mockResolvedValue(1),
        findProfile: jest.fn().mockResolvedValue(profile({ score: 0, activeStrikeWeight: 5 })),
      },
    });

    await service.revokeStrike('s1', actor);

    const saved = (repo.saveProfile as jest.Mock).mock.calls[0]?.[0] as TrustProfile;
    expect(saved.activeStrikeWeight).toBe(1);
    // TRUST_SCORE_DEFAULT (50) - 1 remaining weight * 5 = 45, not 0 + 20.
    expect(saved.score).toBe(45);
    expect(saved.level).toBe(TrustLevel.Basic);
  });

  it('404s an unknown strike and 409s one already revoked', async () => {
    const { service: missing } = makeService({
      repo: { findStrike: jest.fn().mockResolvedValue(null) },
    });
    await expect(missing.revokeStrike('s1', actor)).rejects.toMatchObject({
      code: ERROR_CODES.STRIKE_NOT_FOUND,
    });

    const { service: already, repo } = makeService({
      repo: { findStrike: jest.fn().mockResolvedValue(strike({ revokedAt: NOW })) },
    });
    await expect(already.revokeStrike('s1', actor)).rejects.toMatchObject({
      code: ERROR_CODES.STRIKE_ALREADY_REVOKED,
    });
    // A silent second success would leave an operator unable to tell whether their
    // action did anything, since the ledger did not move.
    expect(repo.saveProfile).not.toHaveBeenCalled();
  });
});

describe('the two remedies stay apart (B9, A2-3)', () => {
  it('lifting a restriction does NOT reduce the active strike weight', async () => {
    // A2-3, pinned as the DESIGN rather than fixed as a defect: a lift means "you may act
    // again", not "that strike was wrong". The weight survives, so the next strike of any
    // severity re-crosses the threshold and re-applies the restriction.
    const { service, repo } = makeService({
      repo: { findRestriction: jest.fn().mockResolvedValue(restriction()) },
    });

    await service.liftRestriction('ur1', actor);

    expect(repo.saveProfile).not.toHaveBeenCalled();
    expect(repo.sumActiveStrikeWeight).not.toHaveBeenCalled();
  });

  it('and revoking the strike IS what reduces it — the same scenario, the other remedy', async () => {
    const { service, repo } = makeService({
      repo: {
        findStrike: jest.fn().mockResolvedValue(strike({ weight: 4 })),
        sumActiveStrikeWeight: jest.fn().mockResolvedValue(2),
        findProfile: jest.fn().mockResolvedValue(profile({ activeStrikeWeight: 6 })),
      },
    });

    await service.revokeStrike('s1', actor);

    const saved = (repo.saveProfile as jest.Mock).mock.calls[0]?.[0] as TrustProfile;
    expect(saved.activeStrikeWeight).toBe(2);
  });
});

describe('TrustService.issueStrike', () => {
  it('lowers the score, records the audit, and invalidates the policy cache', async () => {
    const { service, repo, audit, engine } = makeService({
      repo: {
        findProfile: jest.fn().mockResolvedValue(profile({ score: 50 })),
        sumActiveStrikeWeight: jest.fn().mockResolvedValue(2),
      },
    });
    await service.issueStrike(
      'user1',
      { severity: StrikeSeverity.Moderate, reason: 'ban evasion' },
      actor,
    );
    // moderate weight = 2, penalty 5/weight → 50 - 10 = 40.
    expect(repo.saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ score: 40, activeStrikeWeight: 2 }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'trust.strike_issue', targetId: 'user1' }),
    );
    expect(engine.invalidateUser).toHaveBeenCalledWith('user1');
  });

  it('auto-applies a global RESTRICTED restriction when weight crosses the restriction threshold', async () => {
    const { service, repo } = makeService({
      repo: {
        sumActiveStrikeWeight: jest.fn().mockResolvedValue(4), // >= 3, < 6
        listActiveRestrictions: jest.fn().mockResolvedValue([]),
      },
    });
    await service.issueStrike(
      'user1',
      { severity: StrikeSeverity.Severe, reason: 'repeat abuse' },
      actor,
    );
    expect(repo.createRestriction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: RestrictionType.Restricted,
        scope: RestrictionScope.Global,
      }),
    );
  });

  it('auto-applies a SUSPENDED restriction when weight crosses the suspension threshold', async () => {
    const { service, repo } = makeService({
      repo: {
        sumActiveStrikeWeight: jest.fn().mockResolvedValue(6), // >= 6
        listActiveRestrictions: jest.fn().mockResolvedValue([]),
      },
    });
    await service.issueStrike(
      'user1',
      { severity: StrikeSeverity.Severe, reason: 'severe abuse' },
      actor,
    );
    expect(repo.createRestriction).toHaveBeenCalledWith(
      expect.objectContaining({ type: RestrictionType.Suspended }),
    );
  });

  it('does NOT stack a duplicate auto-restriction that is already active (idempotent)', async () => {
    const { service, repo } = makeService({
      repo: {
        sumActiveStrikeWeight: jest.fn().mockResolvedValue(4),
        listActiveRestrictions: jest
          .fn()
          .mockResolvedValue([
            restriction({ type: RestrictionType.Restricted, scope: RestrictionScope.Global }),
          ]),
      },
    });
    await service.issueStrike('user1', { severity: StrikeSeverity.Severe, reason: 'again' }, actor);
    expect(repo.createRestriction).not.toHaveBeenCalled();
  });
});

describe('TrustService.applyRestriction / liftRestriction', () => {
  it('applies a restriction, audits, and invalidates the cache', async () => {
    const { service, repo, engine } = makeService();
    await service.applyRestriction(
      'user1',
      { type: RestrictionType.Muted, scope: RestrictionScope.Comments, reason: 'noise' },
      actor,
    );
    expect(repo.createRestriction).toHaveBeenCalledWith(
      expect.objectContaining({ type: RestrictionType.Muted, scope: RestrictionScope.Comments }),
    );
    expect(engine.invalidateUser).toHaveBeenCalledWith('user1');
  });

  it('lifting a missing restriction throws RESTRICTION_NOT_FOUND', async () => {
    const { service } = makeService({
      repo: { findRestriction: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.liftRestriction('missing', actor)).rejects.toMatchObject({
      code: 'RESTRICTION_NOT_FOUND',
    });
  });

  it('lifting invalidates the cache for the restriction owner', async () => {
    const { service, engine } = makeService({
      repo: {
        findRestriction: jest.fn().mockResolvedValue(restriction({ userId: 'victim' })),
      },
    });
    await service.liftRestriction('ur1', actor);
    expect(engine.invalidateUser).toHaveBeenCalledWith('victim');
  });
});

describe('TrustService blocks/mutes', () => {
  it('blocking yourself throws BLOCK_SELF', async () => {
    const { service } = makeService();
    await expect(service.block('user1', 'user1')).rejects.toMatchObject({ code: 'BLOCK_SELF' });
  });

  it('block creates the edge and invalidates the blocker cache', async () => {
    const { service, repo, engine } = makeService();
    await service.block('user1', 'user2');
    expect(repo.createBlock).toHaveBeenCalledWith(
      expect.objectContaining({ blockerId: 'user1', blockedId: 'user2', kind: 'block' }),
    );
    expect(engine.invalidateUser).toHaveBeenCalledWith('user1');
  });

  it('re-blocking an existing edge is idempotent (no second row)', async () => {
    const { service, repo } = makeService({
      repo: { findBlock: jest.fn().mockResolvedValue(block()) },
    });
    await service.block('user1', 'user2');
    expect(repo.createBlock).not.toHaveBeenCalled();
  });

  it('unblocking a missing edge throws BLOCK_NOT_FOUND', async () => {
    const { service } = makeService({
      repo: { findBlock: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.unblock('user1', 'user2')).rejects.toMatchObject({
      code: 'BLOCK_NOT_FOUND',
    });
  });

  it('isInteractionBlocked delegates to the either-way repository check', async () => {
    const isBlockedEitherWay = jest.fn().mockResolvedValue(true);
    const { service } = makeService({ repo: { isBlockedEitherWay } });
    await expect(service.isInteractionBlocked('a', 'b')).resolves.toBe(true);
    expect(isBlockedEitherWay).toHaveBeenCalledWith('a', 'b');
  });
});
