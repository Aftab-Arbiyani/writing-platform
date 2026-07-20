import {
  MAX_STORY_COLLABORATORS,
  POLICY_ACTIONS,
  PolicyEffect,
  StoryRole,
  Visibility,
} from '@qalam/shared';
import type { PolicyDecision } from '@qalam/shared';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { AuditService } from '../audit/audit.service';
import type { PiecesService } from '../pieces/pieces.service';
import type { PolicyEngineService } from '../policy';
import type { ActivityService } from './activity.service';
import type { CollaborationRepository } from './collaboration.repository';
import {
  StoryCollaboratorLimitException,
  StoryMemberExistsException,
  StoryMembershipNotFoundException,
  StoryOwnerImmutableException,
  StoryRoleForbiddenException,
} from './collaboration.exceptions';
import type { StoryMembership } from './entities/story-membership.entity';
import { MembershipService } from './membership.service';

const OWNER = 'owner-1';
const STORY = '11111111-1111-1111-1111-111111111111';

function allow(): PolicyDecision {
  return {
    effect: PolicyEffect.Allow,
    allowed: true,
    reason: 'test-allow',
    matchedRule: 'test',
    obligations: [],
  };
}

function actor(id = OWNER): AuthenticatedUser {
  return { id, role: 'user', sessionVersion: 1 };
}

function membership(overrides?: Partial<StoryMembership>): StoryMembership {
  return {
    id: 'mem-1',
    storyId: STORY,
    userId: 'collab-1',
    role: StoryRole.Editor,
    invitedById: OWNER,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as StoryMembership;
}

function build() {
  const repo = {
    findMembership: jest.fn().mockResolvedValue(null),
    listMembers: jest.fn().mockResolvedValue([]),
    countMembers: jest.fn().mockResolvedValue(0),
    createMembership: jest
      .fn()
      .mockImplementation((data: Partial<StoryMembership>) => Promise.resolve(membership(data))),
    saveMembership: jest
      .fn()
      .mockImplementation((entity: StoryMembership) => Promise.resolve(entity)),
    deleteMembership: jest.fn().mockResolvedValue(undefined),
    withTransaction: jest.fn(<T>(work: (m: unknown) => Promise<T>) => work({})),
  } as unknown as jest.Mocked<CollaborationRepository>;

  const pieces = {
    getStoryContext: jest
      .fn()
      .mockResolvedValue({ authorId: OWNER, visibility: Visibility.Private, isPublished: false }),
  } as unknown as jest.Mocked<PiecesService>;

  const engine = {
    assert: jest.fn().mockResolvedValue(allow()),
    invalidateUser: jest.fn(),
    explain: jest.fn().mockResolvedValue({}),
  } as unknown as jest.Mocked<PolicyEngineService>;

  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;
  const activity = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ActivityService>;

  const service = new MembershipService(repo, pieces, engine, audit, activity);
  return { service, repo, pieces, engine, audit, activity };
}

describe('MembershipService', () => {
  describe('getRole', () => {
    it('resolves the story owner (piece author) to StoryRole.Owner without a membership row', async () => {
      const { service, repo } = build();
      await expect(service.getRole(STORY, OWNER)).resolves.toBe(StoryRole.Owner);
      expect(repo.findMembership).not.toHaveBeenCalled();
    });

    it('returns the collaborator membership role', async () => {
      const { service, repo } = build();
      repo.findMembership.mockResolvedValue(membership({ role: StoryRole.Reviewer }));
      await expect(service.getRole(STORY, 'collab-1')).resolves.toBe(StoryRole.Reviewer);
    });

    it('returns null for a non-member', async () => {
      const { service } = build();
      await expect(service.getRole(STORY, 'stranger')).resolves.toBeNull();
    });
  });

  describe('addMember', () => {
    it('asserts StoryManageMembers on the story before writing, then invalidates the new member', async () => {
      const { service, engine, activity } = build();

      await service.addMember(STORY, actor(), { userId: 'collab-9', role: StoryRole.Editor });

      expect(engine.assert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: POLICY_ACTIONS.StoryManageMembers,
          resource: expect.objectContaining({
            type: 'story',
            storyId: STORY,
            storyOwnerId: OWNER,
            targetUserId: 'collab-9',
          }),
        }),
      );
      expect(activity.record).toHaveBeenCalled();
      expect(engine.invalidateUser).toHaveBeenCalledWith('collab-9');
    });

    it('throws STORY_COLLABORATOR_LIMIT when the cap is reached (after authorizing)', async () => {
      const { service, repo, engine } = build();
      repo.countMembers.mockResolvedValue(MAX_STORY_COLLABORATORS);

      await expect(
        service.addMember(STORY, actor(), { userId: 'collab-9', role: StoryRole.Editor }),
      ).rejects.toBeInstanceOf(StoryCollaboratorLimitException);
      expect(engine.assert).toHaveBeenCalled();
      expect(repo.createMembership).not.toHaveBeenCalled();
    });

    it('throws STORY_MEMBER_EXISTS when the user is already a collaborator', async () => {
      const { service, repo } = build();
      repo.findMembership.mockResolvedValue(membership());

      await expect(
        service.addMember(STORY, actor(), { userId: 'collab-1', role: StoryRole.Editor }),
      ).rejects.toBeInstanceOf(StoryMemberExistsException);
    });

    it('rejects adding the owner (already a member)', async () => {
      const { service } = build();
      await expect(
        service.addMember(STORY, actor(), { userId: OWNER, role: StoryRole.Editor }),
      ).rejects.toBeInstanceOf(StoryMemberExistsException);
    });
  });

  describe('changeRole', () => {
    it('asserts StoryManageRoles and invalidates the affected user', async () => {
      const { service, repo, engine } = build();
      repo.findMembership.mockResolvedValue(membership({ userId: 'collab-1' }));

      await service.changeRole(STORY, actor(), 'collab-1', { role: StoryRole.CoAuthor });

      expect(engine.assert).toHaveBeenCalledWith(
        expect.objectContaining({ action: POLICY_ACTIONS.StoryManageRoles }),
      );
      expect(engine.invalidateUser).toHaveBeenCalledWith('collab-1');
    });

    it('refuses to change the owner role (STORY_OWNER_IMMUTABLE)', async () => {
      const { service } = build();
      await expect(
        service.changeRole(STORY, actor(), OWNER, { role: StoryRole.CoAuthor }),
      ).rejects.toBeInstanceOf(StoryOwnerImmutableException);
    });

    it('throws STORY_MEMBERSHIP_NOT_FOUND for a non-member target', async () => {
      const { service, repo } = build();
      repo.findMembership.mockResolvedValue(null);
      await expect(
        service.changeRole(STORY, actor(), 'stranger', { role: StoryRole.CoAuthor }),
      ).rejects.toBeInstanceOf(StoryMembershipNotFoundException);
    });
  });

  describe('removeMember', () => {
    it('deletes the membership and invalidates the removed user', async () => {
      const { service, repo, engine } = build();
      repo.findMembership.mockResolvedValue(membership({ userId: 'collab-1' }));

      await service.removeMember(STORY, actor(), 'collab-1');

      expect(engine.assert).toHaveBeenCalledWith(
        expect.objectContaining({ action: POLICY_ACTIONS.StoryManageMembers }),
      );
      expect(repo.deleteMembership).toHaveBeenCalled();
      expect(engine.invalidateUser).toHaveBeenCalledWith('collab-1');
    });

    it('refuses to remove the owner', async () => {
      const { service } = build();
      await expect(service.removeMember(STORY, actor(), OWNER)).rejects.toBeInstanceOf(
        StoryOwnerImmutableException,
      );
    });
  });

  describe('leave', () => {
    it('asserts StoryView and lets a collaborator leave', async () => {
      const { service, repo, engine } = build();
      repo.findMembership.mockResolvedValue(membership({ userId: 'collab-1' }));

      await service.leave(STORY, actor('collab-1'));

      expect(engine.assert).toHaveBeenCalledWith(
        expect.objectContaining({ action: POLICY_ACTIONS.StoryView }),
      );
      expect(repo.deleteMembership).toHaveBeenCalled();
      expect(engine.invalidateUser).toHaveBeenCalledWith('collab-1');
    });

    it('does not let the owner leave', async () => {
      const { service } = build();
      await expect(service.leave(STORY, actor(OWNER))).rejects.toBeInstanceOf(
        StoryOwnerImmutableException,
      );
    });
  });

  describe('assignable-role guard', () => {
    it('rejects assigning a non-assignable role', async () => {
      const { service } = build();
      await expect(
        service.addMember(STORY, actor(), { userId: 'collab-9', role: StoryRole.Owner }),
      ).rejects.toBeInstanceOf(StoryRoleForbiddenException);
    });
  });
});
