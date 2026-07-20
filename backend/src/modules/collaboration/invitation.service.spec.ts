import {
  INVITATION_TTL_HOURS,
  InvitationStatus,
  MAX_STORY_COLLABORATORS,
  NotificationType,
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
import type { CollaborationNotifier } from './collaboration-notifier.port';
import type { CollaborationRepository } from './collaboration.repository';
import {
  InvitationAlreadyRespondedException,
  InvitationExpiredException,
  InvitationNotFoundException,
  InvitationNotInviteeException,
  InvitationSelfException,
  StoryMemberExistsException,
} from './collaboration.exceptions';
import type { StoryInvitation } from './entities/story-invitation.entity';
import type { StoryMembership } from './entities/story-membership.entity';
import { InvitationService } from './invitation.service';

const OWNER = 'owner-1';
const INVITER = OWNER;
const INVITEE = 'invitee-1';
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

function user(id: string): AuthenticatedUser {
  return { id, role: 'user', sessionVersion: 1 };
}

function invitation(overrides?: Partial<StoryInvitation>): StoryInvitation {
  return {
    id: 'inv-1',
    storyId: STORY,
    inviterId: INVITER,
    inviteeId: INVITEE,
    role: StoryRole.Editor,
    status: InvitationStatus.Pending,
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000),
    respondedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as StoryInvitation;
}

function build() {
  const repo = {
    findMembership: jest.fn().mockResolvedValue(null),
    countMembers: jest.fn().mockResolvedValue(0),
    createMembership: jest
      .fn()
      .mockImplementation((data: Partial<StoryMembership>) =>
        Promise.resolve({ id: 'mem-1', createdAt: new Date(), updatedAt: new Date(), ...data }),
      ),
    findInvitationById: jest.fn().mockResolvedValue(null),
    listInvitationsForStory: jest.fn().mockResolvedValue([]),
    listInvitationsForInvitee: jest.fn().mockResolvedValue([]),
    createInvitation: jest
      .fn()
      .mockImplementation((data: Partial<StoryInvitation>) =>
        Promise.resolve({ id: 'inv-1', createdAt: new Date(), updatedAt: new Date(), ...data }),
      ),
    saveInvitation: jest.fn().mockImplementation((e: StoryInvitation) => Promise.resolve(e)),
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
  } as unknown as jest.Mocked<PolicyEngineService>;

  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;
  const activity = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ActivityService>;
  const notifier = {
    notify: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<CollaborationNotifier>;

  const service = new InvitationService(repo, pieces, engine, audit, activity, notifier);
  return { service, repo, pieces, engine, audit, activity, notifier };
}

describe('InvitationService', () => {
  describe('invite', () => {
    it('asserts StoryInvite (targeting the invitee), issues a 64-char token with a TTL, and notifies the invitee', async () => {
      const { service, repo, engine, notifier } = build();

      const before = Date.now();
      await service.invite(STORY, user(INVITER), { inviteeId: INVITEE, role: StoryRole.Editor });

      expect(engine.assert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: POLICY_ACTIONS.StoryInvite,
          resource: expect.objectContaining({ storyId: STORY, targetUserId: INVITEE }),
        }),
      );
      const created = repo.createInvitation.mock.calls[0]?.[0] as Partial<StoryInvitation>;
      expect(created.token).toHaveLength(64);
      expect(created.status).toBe(InvitationStatus.Pending);
      const ttlMs = INVITATION_TTL_HOURS * 3_600_000;
      expect((created.expiresAt as Date).getTime()).toBeGreaterThanOrEqual(before + ttlMs - 5_000);
      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: INVITEE,
          type: NotificationType.CollaborationInvite,
        }),
      );
    });

    it('rejects a self-invite (INVITATION_SELF)', async () => {
      const { service } = build();
      await expect(
        service.invite(STORY, user(INVITER), { inviteeId: INVITER, role: StoryRole.Editor }),
      ).rejects.toBeInstanceOf(InvitationSelfException);
    });

    it('rejects inviting the story owner (STORY_MEMBER_EXISTS)', async () => {
      const { service } = build();
      await expect(
        service.invite(STORY, user('co-author'), { inviteeId: OWNER, role: StoryRole.Editor }),
      ).rejects.toBeInstanceOf(StoryMemberExistsException);
    });

    it('rejects inviting an existing collaborator (STORY_MEMBER_EXISTS)', async () => {
      const { service, repo } = build();
      repo.findMembership.mockResolvedValue({ id: 'mem-1' } as StoryMembership);
      await expect(
        service.invite(STORY, user(INVITER), { inviteeId: INVITEE, role: StoryRole.Editor }),
      ).rejects.toBeInstanceOf(StoryMemberExistsException);
    });
  });

  describe('accept', () => {
    it('creates the membership, marks accepted, invalidates the invitee, and notifies the inviter', async () => {
      const { service, repo, engine, notifier } = build();
      repo.findInvitationById.mockResolvedValue(invitation());

      const member = await service.accept('inv-1', user(INVITEE));

      expect(repo.createMembership).toHaveBeenCalledWith(
        expect.objectContaining({ storyId: STORY, userId: INVITEE, role: StoryRole.Editor }),
        expect.anything(),
      );
      const savedInvite = repo.saveInvitation.mock.calls[0]?.[0] as StoryInvitation;
      expect(savedInvite.status).toBe(InvitationStatus.Accepted);
      expect(engine.invalidateUser).toHaveBeenCalledWith(INVITEE);
      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: INVITER,
          type: NotificationType.InvitationAccepted,
        }),
      );
      expect(member.role).toBe(StoryRole.Editor);
    });

    it('rejects a non-invitee (INVITATION_NOT_INVITEE)', async () => {
      const { service, repo } = build();
      repo.findInvitationById.mockResolvedValue(invitation());
      await expect(service.accept('inv-1', user('someone-else'))).rejects.toBeInstanceOf(
        InvitationNotInviteeException,
      );
    });

    it('rejects an already-responded invitation (INVITATION_ALREADY_RESPONDED)', async () => {
      const { service, repo } = build();
      repo.findInvitationById.mockResolvedValue(invitation({ status: InvitationStatus.Declined }));
      await expect(service.accept('inv-1', user(INVITEE))).rejects.toBeInstanceOf(
        InvitationAlreadyRespondedException,
      );
    });

    it('marks an expired invitation expired and throws INVITATION_EXPIRED', async () => {
      const { service, repo } = build();
      repo.findInvitationById.mockResolvedValue(
        invitation({ expiresAt: new Date(Date.now() - 1_000) }),
      );
      await expect(service.accept('inv-1', user(INVITEE))).rejects.toBeInstanceOf(
        InvitationExpiredException,
      );
      const saved = repo.saveInvitation.mock.calls[0]?.[0] as StoryInvitation;
      expect(saved.status).toBe(InvitationStatus.Expired);
      expect(repo.createMembership).not.toHaveBeenCalled();
    });

    it('rejects when the collaborator cap is reached', async () => {
      const { service, repo } = build();
      repo.findInvitationById.mockResolvedValue(invitation());
      repo.countMembers.mockResolvedValue(MAX_STORY_COLLABORATORS);
      await expect(service.accept('inv-1', user(INVITEE))).rejects.toThrow();
      expect(repo.createMembership).not.toHaveBeenCalled();
    });

    it('throws INVITATION_NOT_FOUND for a missing invitation', async () => {
      const { service, repo } = build();
      repo.findInvitationById.mockResolvedValue(null);
      await expect(service.accept('nope', user(INVITEE))).rejects.toBeInstanceOf(
        InvitationNotFoundException,
      );
    });
  });

  describe('decline', () => {
    it('marks the invitation declined (invitee only)', async () => {
      const { service, repo } = build();
      repo.findInvitationById.mockResolvedValue(invitation());
      const dto = await service.decline('inv-1', user(INVITEE));
      expect(dto.status).toBe(InvitationStatus.Declined);
    });
  });

  describe('revoke', () => {
    it('asserts StoryInvite and marks the invitation revoked', async () => {
      const { service, repo, engine } = build();
      repo.findInvitationById.mockResolvedValue(invitation());
      const dto = await service.revoke('inv-1', user(OWNER));
      expect(engine.assert).toHaveBeenCalledWith(
        expect.objectContaining({ action: POLICY_ACTIONS.StoryInvite }),
      );
      expect(dto.status).toBe(InvitationStatus.Revoked);
    });

    it('rejects revoking an already-responded invitation', async () => {
      const { service, repo } = build();
      repo.findInvitationById.mockResolvedValue(invitation({ status: InvitationStatus.Accepted }));
      await expect(service.revoke('inv-1', user(OWNER))).rejects.toBeInstanceOf(
        InvitationAlreadyRespondedException,
      );
    });
  });
});
