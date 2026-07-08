import { FollowStatus } from '@qalam/shared';
import type { EntityManager } from 'typeorm';

import type { TransactionRunner } from '../../common/database/transaction-runner';
import type { Follow } from './entities/follow.entity';
import { Profile } from './entities/profile.entity';
import {
  AlreadyFollowingException,
  CannotFollowSelfException,
  FollowRequestNotFoundException,
  FollowRequestPendingException,
} from './exceptions/users.exceptions';
import type { FollowRepository } from './follow.repository';
import { FollowService } from './follow.service';
import type { ProfileRepository } from './profile.repository';
import type { ProfileService } from './profile.service';
import type { UsersService } from './users.service';

/** Runs the tx callback immediately with a dummy manager (no real DB in unit tests). */
const txRunner = {
  run: (work: (m: EntityManager) => Promise<unknown>) => work({} as EntityManager),
};
const profile = (isPrivate: boolean): Profile => Object.assign(new Profile(), { isPrivate });

interface Mocks {
  follows: jest.Mocked<
    Pick<FollowRepository, 'find' | 'findById' | 'create' | 'setStatus' | 'deleteById'>
  >;
  profiles: jest.Mocked<Pick<ProfileRepository, 'incrementCounts'>>;
  profileService: jest.Mocked<Pick<ProfileService, 'getOrCreateByUserId'>>;
  users: jest.Mocked<Pick<UsersService, 'findById'>>;
}

function build(overrides: Partial<{ target: Profile; existing: unknown }> = {}): {
  service: FollowService;
  m: Mocks;
} {
  const m: Mocks = {
    follows: {
      find: jest.fn().mockResolvedValue(overrides.existing ?? null),
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      setStatus: jest.fn(),
      deleteById: jest.fn(),
    } as unknown as Mocks['follows'],
    profiles: { incrementCounts: jest.fn() } as unknown as Mocks['profiles'],
    profileService: {
      getOrCreateByUserId: jest.fn().mockResolvedValue(overrides.target ?? profile(false)),
    } as unknown as Mocks['profileService'],
    users: { findById: jest.fn().mockResolvedValue({ id: 'target' }) } as unknown as Mocks['users'],
  };
  const service = new FollowService(
    m.follows as unknown as FollowRepository,
    m.profiles as unknown as ProfileRepository,
    m.profileService as unknown as ProfileService,
    m.users as unknown as UsersService,
    txRunner as unknown as TransactionRunner,
  );
  return { service, m };
}

describe('FollowService', () => {
  it('rejects following yourself', async () => {
    const { service } = build();
    await expect(service.follow('u1', 'u1')).rejects.toBeInstanceOf(CannotFollowSelfException);
  });

  it('follows a PUBLIC account immediately and bumps both counts', async () => {
    const { service, m } = build({ target: profile(false) });
    await expect(service.follow('follower', 'target')).resolves.toEqual({
      status: FollowStatus.Accepted,
    });
    expect(m.follows.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: FollowStatus.Accepted }),
      expect.anything(),
    );
    expect(m.profiles.incrementCounts).toHaveBeenCalledWith(
      'target',
      { followers: 1 },
      expect.anything(),
    );
    expect(m.profiles.incrementCounts).toHaveBeenCalledWith(
      'follower',
      { following: 1 },
      expect.anything(),
    );
  });

  it('creates a PENDING request for a PRIVATE account and does NOT change counts', async () => {
    const { service, m } = build({ target: profile(true) });
    await expect(service.follow('follower', 'target')).resolves.toEqual({
      status: FollowStatus.Pending,
    } as unknown as Follow);
    expect(m.follows.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: FollowStatus.Pending }),
      expect.anything(),
    );
    expect(m.profiles.incrementCounts).not.toHaveBeenCalled();
  });

  it('rejects a duplicate follow / duplicate request', async () => {
    const accepted = build({ existing: { status: FollowStatus.Accepted } });
    await expect(accepted.service.follow('f', 'target')).rejects.toBeInstanceOf(
      AlreadyFollowingException,
    );
    const pending = build({ existing: { status: FollowStatus.Pending } });
    await expect(pending.service.follow('f', 'target')).rejects.toBeInstanceOf(
      FollowRequestPendingException,
    );
  });

  it('accepts a pending request → status accepted + counts bumped', async () => {
    const { service, m } = build();
    m.follows.findById.mockResolvedValue({
      id: 'req1',
      followeeId: 'me',
      followerId: 'them',
      status: FollowStatus.Pending,
    } as unknown as Follow);
    await service.acceptRequest('req1', 'me');
    expect(m.follows.setStatus).toHaveBeenCalledWith(
      'req1',
      FollowStatus.Accepted,
      expect.anything(),
    );
    expect(m.profiles.incrementCounts).toHaveBeenCalledWith(
      'me',
      { followers: 1 },
      expect.anything(),
    );
    expect(m.profiles.incrementCounts).toHaveBeenCalledWith(
      'them',
      { following: 1 },
      expect.anything(),
    );
  });

  it("rejects accepting someone else's request (no leak)", async () => {
    const { service, m } = build();
    m.follows.findById.mockResolvedValue({
      id: 'req1',
      followeeId: 'other',
      followerId: 'them',
      status: FollowStatus.Pending,
    } as unknown as Follow);
    await expect(service.acceptRequest('req1', 'me')).rejects.toBeInstanceOf(
      FollowRequestNotFoundException,
    );
  });

  it('unfollow of an accepted edge decrements counts; missing edge is a no-op', async () => {
    const present = build({ existing: { id: 'e1', status: FollowStatus.Accepted } });
    await present.service.unfollowOrCancel('follower', 'target');
    expect(present.m.follows.deleteById).toHaveBeenCalled();
    expect(present.m.profiles.incrementCounts).toHaveBeenCalledWith(
      'target',
      { followers: -1 },
      expect.anything(),
    );

    const absent = build({ existing: null });
    await absent.service.unfollowOrCancel('follower', 'target');
    expect(absent.m.follows.deleteById).not.toHaveBeenCalled();
  });
});
