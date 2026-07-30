import {
  RestrictionScope,
  RestrictionType,
  Role,
  StrikeSeverity,
  TrustLevel,
  TrustStatus,
} from '@qalam/shared';

import type { AuditService } from '../audit/audit.service';
import type { PolicyEngineService } from '../policy';
import type { NotificationsService } from '../notifications';

import type { TrustProfile } from './entities/trust-profile.entity';
import type { UserBlock } from './entities/user-block.entity';
import type { UserRestriction } from './entities/user-restriction.entity';
import type { UserStrike } from './entities/user-strike.entity';
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
  } = {},
) {
  const repo = {
    findProfile: jest.fn().mockResolvedValue(profile()),
    saveProfile: jest.fn((p: TrustProfile) => Promise.resolve(p)),
    listActiveStrikes: jest.fn().mockResolvedValue([]),
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
  const service = new TrustService(
    repo as unknown as TrustRepository,
    audit as unknown as AuditService,
    engine as unknown as PolicyEngineService,
    notifications as unknown as NotificationsService,
  );
  return { service, repo, audit, engine, notifications };
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
