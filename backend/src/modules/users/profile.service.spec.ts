import { FollowStatus } from '@qalam/shared';

import type { TransactionRunner } from '../../common/database/transaction-runner';
import type { MediaService } from '../../media/media.service';
import type { TaxonomyService } from '../taxonomy/taxonomy.service';
import { Profile } from './entities/profile.entity';
import type { FollowRepository } from './follow.repository';
import { ProfileService } from './profile.service';
import type { ProfileRepository } from './profile.repository';
import type { UsersService } from './users.service';

const OWNER = 'owner-id';

function profileRow(isPrivate: boolean): Profile {
  return Object.assign(new Profile(), {
    id: 'p1',
    userId: OWNER,
    penName: 'Owner',
    bio: 'hello world',
    isPrivate,
    followersCount: 3,
    followingCount: 1,
    piecesCount: 0,
    socialLinks: {},
    avatarKey: null,
    coverKey: null,
    websiteUrl: null,
    location: null,
    defaultLanguageId: null,
  });
}

function build(isPrivate: boolean, edge: { status: FollowStatus } | null): ProfileService {
  const profiles = {
    findByUserId: jest.fn().mockResolvedValue(profileRow(isPrivate)),
    getGenreIds: jest.fn().mockResolvedValue([]),
  } as unknown as ProfileRepository;
  const follows = { find: jest.fn().mockResolvedValue(edge) } as unknown as FollowRepository;
  const users = {
    findByUsername: jest.fn().mockResolvedValue({ id: OWNER, username: 'owner' }),
    findById: jest.fn().mockResolvedValue({ id: OWNER, username: 'owner' }),
  } as unknown as UsersService;
  const taxonomy = {
    getGenresByIds: jest.fn().mockResolvedValue([]),
  } as unknown as TaxonomyService;
  const media = {} as MediaService;
  const transactions = {} as TransactionRunner;
  return new ProfileService(profiles, follows, users, taxonomy, media, transactions);
}

describe('ProfileService.getPublicProfile (visibility, docs 13 §4.2)', () => {
  it('shows a PUBLIC profile fully to a stranger', async () => {
    const dto = await build(false, null).getPublicProfile('owner', 'stranger');
    expect(dto.restricted).toBe(false);
    expect(dto.id).toBe(OWNER); // user UUID exposed for the follow target (additive, docs/25 §8)
    expect(dto.bio).toBe('hello world');
    expect(dto.viewerRelation.isFollowing).toBe(false);
  });

  it('shows a PRIVATE profile as a teaser to a non-follower stranger', async () => {
    const dto = await build(true, null).getPublicProfile('owner', 'stranger');
    expect(dto.restricted).toBe(true);
    expect(dto.bio).toBeUndefined(); // restricted fields omitted
    expect(dto.counts.followers).toBe(3); // counts + pen name still shown
    expect(dto.penName).toBe('Owner');
  });

  it('shows a PRIVATE profile fully to an accepted follower', async () => {
    const dto = await build(true, { status: FollowStatus.Accepted }).getPublicProfile(
      'owner',
      'follower',
    );
    expect(dto.restricted).toBe(false);
    expect(dto.bio).toBe('hello world');
    expect(dto.viewerRelation.isFollowing).toBe(true);
  });

  it('reports a pending request in the viewer relation without unlocking content', async () => {
    const dto = await build(true, { status: FollowStatus.Pending }).getPublicProfile(
      'owner',
      'requester',
    );
    expect(dto.restricted).toBe(true);
    expect(dto.viewerRelation.hasPendingRequest).toBe(true);
  });

  it('shows a PRIVATE profile fully to its owner', async () => {
    const dto = await build(true, null).getPublicProfile('owner', OWNER);
    expect(dto.restricted).toBe(false);
    expect(dto.viewerRelation.isSelf).toBe(true);
  });
});
