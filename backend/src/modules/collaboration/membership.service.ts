import { Injectable, Logger } from '@nestjs/common';
import {
  ASSIGNABLE_STORY_ROLES,
  CollaborationActivity as ActivityType,
  MAX_STORY_COLLABORATORS,
  POLICY_ACTIONS,
  StoryRole,
} from '@qalam/shared';
import type { StoryRole as StoryRoleType } from '@qalam/shared';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuditService } from '../audit/audit.service';
import { PieceNotFoundException } from '../pieces/exceptions/pieces.exceptions';
import { PiecesService } from '../pieces/pieces.service';
import { PolicyEngineService } from '../policy';
import { ActivityService } from './activity.service';
import { CollaboratorSeatService } from './collaborator-seat.service';
import {
  COLLABORATION_AUDIT_ACTIONS,
  COLLABORATION_AUDIT_TARGET,
  COLLABORATION_CAPABILITY_ACTIONS,
} from './collaboration.constants';
import {
  StoryCollaboratorLimitException,
  StoryMemberExistsException,
  StoryMembershipNotFoundException,
  StoryOwnerImmutableException,
  StoryRoleForbiddenException,
} from './collaboration.exceptions';
import { ownerMemberDto, toCapabilityDtos, toMemberDto } from './collaboration.mappers';
import { subjectOf, storyResource, type StoryFacts } from './collaboration.policy';
import { CollaborationRepository } from './collaboration.repository';
import type { AddMemberDto, ChangeRoleDto } from './dto/collaboration-request.dto';
import type {
  CapabilitiesDto,
  CollaboratorLimitDto,
  MemberDto,
} from './dto/collaboration-response.dto';

/**
 * Story membership + roles (AF6). Owns the roster and is the Policy Engine's
 * story-membership source (via {@link StoryMembershipProvider} → {@link getRole}).
 * Every mutating method authorizes through `engine.assert` FIRST (never a
 * hand-rolled permission check), then enforces business invariants (owner
 * immutability, the collaborator cap, no double-membership). Membership + the
 * activity event commit together; the audit trail and cache invalidation run
 * after commit (invalidation is mandatory — a role change must drop the affected
 * user's cached policy decisions).
 */
@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    private readonly repo: CollaborationRepository,
    private readonly pieces: PiecesService,
    private readonly engine: PolicyEngineService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
    private readonly seats: CollaboratorSeatService,
  ) {}

  /** The story's B6 seat allowance (`GET /stories/:storyId/collaborators/limit`). */
  async getSeatAllowance(storyId: string, actor: AuthenticatedUser): Promise<CollaboratorLimitDto> {
    const facts = await this.loadFacts(storyId);
    /*
     * Authorized as StoryInvite, matching `InvitationService.listForStory` — the allowance is only
     * meaningful to the people who can spend a seat, and it is a (coarse) signal of what the owner
     * pays for, so it is not part of the roster every member can read.
     */
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryInvite,
      resource: storyResource(storyId, facts),
    });
    return this.seats.getAllowance(storyId, facts.authorId);
  }

  /**
   * The subject's effective story role, or null. The owner (piece author) has no
   * membership row — they resolve to {@link StoryRole.Owner}. This is the method
   * the Policy Engine calls through the membership port.
   */
  async getRole(storyId: string, userId: string): Promise<StoryRoleType | null> {
    const facts = await this.pieces.getStoryContext(storyId);
    if (facts !== null && facts.authorId === userId) {
      return StoryRole.Owner;
    }
    const membership = await this.repo.findMembership(storyId, userId);
    return membership?.role ?? null;
  }

  /** Full roster: the synthetic owner entry plus every collaborator row. */
  async listMembers(storyId: string, actor: AuthenticatedUser): Promise<MemberDto[]> {
    const facts = await this.loadFacts(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryView,
      resource: storyResource(storyId, facts),
    });
    const members = await this.repo.listMembers(storyId);
    return [ownerMemberDto(facts.authorId), ...members.map(toMemberDto)];
  }

  async addMember(
    storyId: string,
    actor: AuthenticatedUser,
    dto: AddMemberDto,
  ): Promise<MemberDto> {
    const facts = await this.loadFacts(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryManageMembers,
      resource: storyResource(storyId, facts, { targetUserId: dto.userId }),
    });

    this.assertAssignable(dto.role);
    if (dto.userId === facts.authorId) {
      throw new StoryMemberExistsException(); // the owner is already a "member"
    }
    if ((await this.repo.findMembership(storyId, dto.userId)) !== null) {
      throw new StoryMemberExistsException();
    }
    /*
     * B6's plan seat cap, charged to `facts.authorId` — the story's OWNER, not `actor`. This is the
     * direct-add door; `POST .../invitations` is the other one, and capping only that one would
     * leave this as the bypass (docs/45 §4.11). Checked before the flat ceiling because it binds
     * far below 20 on every tier that can hit it, so its refusal is the informative one.
     */
    await this.seats.assertCanOfferSeat(storyId, facts.authorId);
    if ((await this.repo.countMembers(storyId)) >= MAX_STORY_COLLABORATORS) {
      throw new StoryCollaboratorLimitException(MAX_STORY_COLLABORATORS);
    }

    const membership = await this.repo.withTransaction(async (manager) => {
      const created = await this.repo.createMembership(
        { storyId, userId: dto.userId, role: dto.role, invitedById: actor.id },
        manager,
      );
      await this.activity.record(
        storyId,
        actor.id,
        ActivityType.MemberJoined,
        { userId: dto.userId, role: dto.role },
        manager,
      );
      return created;
    });

    this.engine.invalidateUser(dto.userId);
    await this.safeAudit(actor, COLLABORATION_AUDIT_ACTIONS.MemberAdd, membership.id, {
      storyId,
      userId: dto.userId,
      role: dto.role,
    });
    return toMemberDto(membership);
  }

  async changeRole(
    storyId: string,
    actor: AuthenticatedUser,
    targetUserId: string,
    dto: ChangeRoleDto,
  ): Promise<MemberDto> {
    const facts = await this.loadFacts(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryManageRoles,
      resource: storyResource(storyId, facts, { targetUserId }),
    });

    this.assertAssignable(dto.role);
    if (targetUserId === facts.authorId) {
      throw new StoryOwnerImmutableException();
    }
    const membership = await this.repo.findMembership(storyId, targetUserId);
    if (membership === null) {
      throw new StoryMembershipNotFoundException();
    }
    membership.role = dto.role;

    const saved = await this.repo.withTransaction(async (manager) => {
      const result = await this.repo.saveMembership(membership, manager);
      await this.activity.record(
        storyId,
        actor.id,
        ActivityType.RoleChanged,
        { userId: targetUserId, role: dto.role },
        manager,
      );
      return result;
    });

    this.engine.invalidateUser(targetUserId);
    await this.safeAudit(actor, COLLABORATION_AUDIT_ACTIONS.RoleChange, membership.id, {
      storyId,
      userId: targetUserId,
      role: dto.role,
    });
    return toMemberDto(saved);
  }

  async removeMember(
    storyId: string,
    actor: AuthenticatedUser,
    targetUserId: string,
  ): Promise<void> {
    const facts = await this.loadFacts(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryManageMembers,
      resource: storyResource(storyId, facts, { targetUserId }),
    });

    if (targetUserId === facts.authorId) {
      throw new StoryOwnerImmutableException();
    }
    const membership = await this.repo.findMembership(storyId, targetUserId);
    if (membership === null) {
      throw new StoryMembershipNotFoundException();
    }

    await this.repo.withTransaction(async (manager) => {
      await this.repo.deleteMembership(membership.id, manager);
      await this.activity.record(
        storyId,
        actor.id,
        ActivityType.MemberLeft,
        { userId: targetUserId },
        manager,
      );
    });

    this.engine.invalidateUser(targetUserId);
    await this.safeAudit(actor, COLLABORATION_AUDIT_ACTIONS.MemberRemove, membership.id, {
      storyId,
      userId: targetUserId,
    });
  }

  async leave(storyId: string, actor: AuthenticatedUser): Promise<void> {
    const facts = await this.loadFacts(storyId);
    // Route through the engine: StoryView is granted to any participant (member,
    // owner, or a publicly-viewable story) — so leaving is authorized centrally,
    // not by a bespoke check. Owner cannot leave (must transfer/delete instead).
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryView,
      resource: storyResource(storyId, facts),
    });

    if (actor.id === facts.authorId) {
      throw new StoryOwnerImmutableException();
    }
    const membership = await this.repo.findMembership(storyId, actor.id);
    if (membership === null) {
      throw new StoryMembershipNotFoundException();
    }

    await this.repo.withTransaction(async (manager) => {
      await this.repo.deleteMembership(membership.id, manager);
      await this.activity.record(
        storyId,
        actor.id,
        ActivityType.MemberLeft,
        { userId: actor.id, self: true },
        manager,
      );
    });

    this.engine.invalidateUser(actor.id);
    await this.safeAudit(actor, COLLABORATION_AUDIT_ACTIONS.MemberLeave, membership.id, {
      storyId,
    });
  }

  /**
   * The client's permission display / restricted-state source — the engine's
   * decision for every collaboration action on this story. This is the ONLY place
   * `explain` is surfaced; the client reflects these, never re-deriving them.
   */
  async getCapabilities(storyId: string, actor: AuthenticatedUser): Promise<CapabilitiesDto> {
    const facts = await this.loadFacts(storyId);
    const decisions = await this.engine.explain(
      subjectOf(actor),
      COLLABORATION_CAPABILITY_ACTIONS,
      storyResource(storyId, facts),
    );
    return { storyId, capabilities: toCapabilityDtos(decisions) };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async loadFacts(storyId: string): Promise<StoryFacts> {
    const facts = await this.pieces.getStoryContext(storyId);
    if (facts === null) {
      throw new PieceNotFoundException();
    }
    return facts;
  }

  private assertAssignable(role: StoryRoleType): void {
    if (!ASSIGNABLE_STORY_ROLES.includes(role)) {
      throw new StoryRoleForbiddenException();
    }
  }

  private async safeAudit(
    actor: AuthenticatedUser,
    action: string,
    targetId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        action,
        targetType: COLLABORATION_AUDIT_TARGET.Membership,
        targetId,
        metadata,
      });
    } catch (error) {
      this.logger.warn(`audit failed for ${action}: ${(error as Error).message}`);
    }
  }
}
