import {
  PERMISSIONS,
  POLICY_ACTIONS,
  PolicyEffect,
  PolicyObligation,
  RestrictionScope,
  RestrictionType,
  Role,
  StoryRole,
  TrustLevel,
  TrustStatus,
  Visibility,
} from '@qalam/shared';

import type { PermissionResolver } from '../permissions/permission.resolver';
import { PolicyCacheService } from './policy-cache.service';
import { PolicyEngineService } from './policy-engine.service';
import type {
  PolicyResource,
  StoryMembershipPort,
  TrustContext,
  TrustStatusPort,
} from './policy.types';

const OWNER = 'owner-user';
const OTHER = 'other-user';
const STORY = 'story-1';

function resolverFor(grants: string[]): PermissionResolver {
  return {
    resolve: jest.fn(async () => new Set<string>(grants)),
  } as unknown as PermissionResolver;
}

function normalTrust(): TrustContext {
  return { status: TrustStatus.Normal, level: TrustLevel.Member, restrictions: [] };
}

function makeEngine(options: {
  grants?: string[];
  trust?: (userId: string) => TrustContext;
  role?: (storyId: string, userId: string) => StoryRole | null;
  blocked?: boolean;
}): PolicyEngineService {
  const engine = new PolicyEngineService(
    resolverFor(options.grants ?? [PERMISSIONS.CollaborationUse]),
    new PolicyCacheService(),
  );
  const trustPort: TrustStatusPort = {
    getTrustContext: async (userId) => (options.trust ?? normalTrust)(userId),
    isInteractionBlocked: async () => options.blocked ?? false,
  };
  const membershipPort: StoryMembershipPort = {
    getStoryRole: async (storyId, userId) => (options.role ?? (() => null))(storyId, userId),
  };
  engine.registerTrustPort(trustPort);
  engine.registerMembershipPort(membershipPort);
  return engine;
}

const storyResource: PolicyResource = {
  type: 'story',
  id: STORY,
  storyId: STORY,
  ownerId: OWNER,
  storyOwnerId: OWNER,
  visibility: Visibility.Private,
  isPublished: false,
};

describe('PolicyEngineService', () => {
  describe('ownership', () => {
    it('lets the story owner do anything on their story', async () => {
      const engine = makeEngine({});
      const decision = await engine.evaluate({
        subject: { userId: OWNER, role: Role.User },
        action: POLICY_ACTIONS.StoryManageMembers,
        resource: storyResource,
      });
      expect(decision.effect).toBe(PolicyEffect.Allow);
      expect(decision.matchedRule).toBe('ownership');
    });

    it('denies a stranger a write on a private story (default-deny)', async () => {
      const engine = makeEngine({});
      const decision = await engine.evaluate({
        subject: { userId: OTHER, role: Role.User },
        action: POLICY_ACTIONS.StoryEdit,
        resource: storyResource,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.matchedRule).toBe('default-deny');
    });
  });

  describe('story roles', () => {
    it('lets a beta reader comment but not edit', async () => {
      const engine = makeEngine({ role: () => StoryRole.BetaReader });
      const subject = { userId: OTHER, role: Role.User } as const;
      const canComment = await engine.evaluate({
        subject,
        action: POLICY_ACTIONS.StoryComment,
        resource: storyResource,
      });
      const canEdit = await engine.evaluate({
        subject,
        action: POLICY_ACTIONS.StoryEdit,
        resource: storyResource,
      });
      expect(canComment.effect).toBe(PolicyEffect.Allow);
      expect(canEdit.allowed).toBe(false);
      expect(canEdit.matchedRule).toBe('story-role');
    });

    it('lets an editor edit but not manage members', async () => {
      const engine = makeEngine({ role: () => StoryRole.Editor });
      const subject = { userId: OTHER, role: Role.User } as const;
      expect(
        (
          await engine.evaluate({
            subject,
            action: POLICY_ACTIONS.StoryEdit,
            resource: storyResource,
          })
        ).effect,
      ).toBe(PolicyEffect.Allow);
      const manage = await engine.evaluate({
        subject,
        action: POLICY_ACTIONS.StoryManageMembers,
        resource: storyResource,
      });
      expect(manage.allowed).toBe(false);
    });

    it('lets a co-author invite others', async () => {
      const engine = makeEngine({ role: () => StoryRole.CoAuthor });
      const decision = await engine.evaluate({
        subject: { userId: OTHER, role: Role.User },
        action: POLICY_ACTIONS.StoryInvite,
        resource: storyResource,
      });
      expect(decision.effect).toBe(PolicyEffect.Allow);
    });
  });

  describe('trust standing', () => {
    it('suspends every action for a suspended user', async () => {
      const engine = makeEngine({
        trust: () => ({ status: TrustStatus.Suspended, level: TrustLevel.New, restrictions: [] }),
      });
      const decision = await engine.evaluate({
        subject: { userId: OWNER, role: Role.User },
        action: POLICY_ACTIONS.StoryEdit,
        resource: storyResource,
      });
      expect(decision.effect).toBe(PolicyEffect.Suspended);
      expect(decision.allowed).toBe(false);
    });

    it('blocks writes but allows reads for a read-only user', async () => {
      const engine = makeEngine({
        trust: () => ({ status: TrustStatus.ReadOnly, level: TrustLevel.Basic, restrictions: [] }),
      });
      const subject = { userId: OWNER, role: Role.User } as const;
      const write = await engine.evaluate({
        subject,
        action: POLICY_ACTIONS.StoryEdit,
        resource: storyResource,
      });
      const read = await engine.evaluate({
        subject,
        action: POLICY_ACTIONS.StoryView,
        resource: storyResource,
      });
      expect(write.effect).toBe(PolicyEffect.ReadOnly);
      expect(read.effect).toBe(PolicyEffect.Allow);
    });

    it('mutes commenting for a muted user', async () => {
      const engine = makeEngine({
        trust: () => ({ status: TrustStatus.Muted, level: TrustLevel.Basic, restrictions: [] }),
      });
      const decision = await engine.evaluate({
        subject: { userId: OWNER, role: Role.User },
        action: POLICY_ACTIONS.StoryComment,
        resource: storyResource,
      });
      expect(decision.effect).toBe(PolicyEffect.Muted);
    });

    it('shadow-restricts writes with a shadow-only obligation', async () => {
      const engine = makeEngine({
        trust: () => ({ status: TrustStatus.Shadowed, level: TrustLevel.New, restrictions: [] }),
      });
      const decision = await engine.evaluate({
        subject: { userId: OWNER, role: Role.User },
        action: POLICY_ACTIONS.StoryComment,
        resource: storyResource,
      });
      expect(decision.effect).toBe(PolicyEffect.ConditionalAccess);
      expect(decision.allowed).toBe(true);
      expect(decision.obligations).toContain(PolicyObligation.ShadowOnly);
    });

    it('applies a scoped temporary restriction to matching writes', async () => {
      const engine = makeEngine({
        trust: () => ({
          status: TrustStatus.Limited,
          level: TrustLevel.Basic,
          restrictions: [{ type: RestrictionType.Restricted, scope: RestrictionScope.Publishing }],
        }),
      });
      const decision = await engine.evaluate({
        subject: { userId: OWNER, role: Role.User },
        action: POLICY_ACTIONS.PublicationPublish,
        resource: storyResource,
      });
      expect(decision.effect).toBe(PolicyEffect.TemporaryRestriction);
    });
  });

  describe('blocks', () => {
    it('blocks an interaction with a blocking user', async () => {
      const engine = makeEngine({ blocked: true });
      const decision = await engine.evaluate({
        subject: { userId: OTHER, role: Role.User },
        action: POLICY_ACTIONS.StoryComment,
        resource: { ...storyResource, targetUserId: OWNER },
      });
      expect(decision.effect).toBe(PolicyEffect.Blocked);
    });
  });

  describe('staff permission path', () => {
    it('lets a platform approver approve a review via permission', async () => {
      const engine = makeEngine({ grants: [PERMISSIONS.PublishingApprove] });
      const decision = await engine.evaluate({
        subject: { userId: OTHER, role: Role.Moderator },
        action: POLICY_ACTIONS.ReviewApprove,
        resource: { ...storyResource, storyOwnerId: OWNER },
      });
      expect(decision.effect).toBe(PolicyEffect.Allow);
      expect(decision.matchedRule).toBe('permission');
    });
  });

  describe('visibility (non-member reads)', () => {
    it('lets a stranger view a published public story', async () => {
      const engine = makeEngine({});
      const decision = await engine.evaluate({
        subject: { userId: OTHER, role: Role.User },
        action: POLICY_ACTIONS.StoryView,
        resource: {
          type: 'story',
          id: STORY,
          storyId: STORY,
          ownerId: OWNER,
          storyOwnerId: OWNER,
          visibility: Visibility.Public,
          isPublished: true,
        },
      });
      expect(decision.effect).toBe(PolicyEffect.Allow);
      expect(decision.matchedRule).toBe('visibility');
    });

    it('denies a stranger a private story view', async () => {
      const engine = makeEngine({});
      const decision = await engine.evaluate({
        subject: { userId: OTHER, role: Role.User },
        action: POLICY_ACTIONS.StoryView,
        resource: storyResource,
      });
      expect(decision.allowed).toBe(false);
    });
  });

  describe('self service', () => {
    it('lets a comment author delete their own comment', async () => {
      const engine = makeEngine({});
      const decision = await engine.evaluate({
        subject: { userId: OTHER, role: Role.User },
        action: POLICY_ACTIONS.CommentDelete,
        resource: {
          type: 'comment',
          id: 'comment-1',
          ownerId: OTHER,
          storyId: STORY,
          storyOwnerId: OWNER,
        },
      });
      expect(decision.effect).toBe(PolicyEffect.Allow);
      expect(decision.matchedRule).toBe('self-action');
    });
  });

  describe('assert', () => {
    it('throws for a denied action', async () => {
      const engine = makeEngine({});
      await expect(
        engine.assert({
          subject: { userId: OTHER, role: Role.User },
          action: POLICY_ACTIONS.StoryEdit,
          resource: storyResource,
        }),
      ).rejects.toMatchObject({ code: 'POLICY_DENIED' });
    });

    it('returns the decision for a permitted action', async () => {
      const engine = makeEngine({});
      const decision = await engine.assert({
        subject: { userId: OWNER, role: Role.User },
        action: POLICY_ACTIONS.StoryEdit,
        resource: storyResource,
      });
      expect(decision.allowed).toBe(true);
    });
  });

  describe('cache', () => {
    it('reuses a cached decision and clears it on invalidateUser', async () => {
      const resolver = resolverFor([PERMISSIONS.CollaborationUse]);
      const engine = new PolicyEngineService(resolver, new PolicyCacheService());
      engine.registerTrustPort({
        getTrustContext: async () => normalTrust(),
        isInteractionBlocked: async () => false,
      });
      const req = {
        subject: { userId: OWNER, role: Role.User },
        action: POLICY_ACTIONS.StoryEdit,
        resource: storyResource,
      } as const;
      await engine.evaluate(req);
      await engine.evaluate(req);
      expect(resolver.resolve).toHaveBeenCalledTimes(1);
      engine.invalidateUser(OWNER);
      await engine.evaluate(req);
      expect(resolver.resolve).toHaveBeenCalledTimes(2);
    });
  });

  describe('explain', () => {
    it('returns a decision per action for a capability display', async () => {
      const engine = makeEngine({ role: () => StoryRole.Reviewer });
      const map = await engine.explain(
        { userId: OTHER, role: Role.User },
        [POLICY_ACTIONS.StoryComment, POLICY_ACTIONS.StoryEdit, POLICY_ACTIONS.StorySuggest],
        storyResource,
      );
      expect(map[POLICY_ACTIONS.StoryComment]?.allowed).toBe(true);
      expect(map[POLICY_ACTIONS.StorySuggest]?.allowed).toBe(true);
      expect(map[POLICY_ACTIONS.StoryEdit]?.allowed).toBe(false);
    });
  });
});
