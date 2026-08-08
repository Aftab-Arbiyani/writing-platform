import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  ASSIGNABLE_STORY_ROLES,
  CollaborationActivity as ActivityType,
  INVITATION_TTL_HOURS,
  InvitationStatus,
  MAX_STORY_COLLABORATORS,
  NotificationEntityType,
  NotificationType,
  POLICY_ACTIONS,
} from '@qalam/shared';
import { randomBytes } from 'node:crypto';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuditService } from '../audit/audit.service';
import { PieceNotFoundException } from '../pieces/exceptions/pieces.exceptions';
import { PiecesService } from '../pieces/pieces.service';
import { PolicyEngineService } from '../policy';
import { ActivityService } from './activity.service';
import {
  COLLABORATION_NOTIFIER,
  type CollaborationNotification,
  type CollaborationNotifier,
} from './collaboration-notifier.port';
import { COLLABORATION_AUDIT_ACTIONS, COLLABORATION_AUDIT_TARGET } from './collaboration.constants';
import { CollaboratorSeatService } from './collaborator-seat.service';
import {
  InvitationAlreadyRespondedException,
  InvitationExpiredException,
  InvitationNotFoundException,
  InvitationNotInviteeException,
  InvitationSelfException,
  StoryCollaboratorLimitException,
  StoryMemberExistsException,
  StoryRoleForbiddenException,
} from './collaboration.exceptions';
import { toInvitationDto, toMemberDto } from './collaboration.mappers';
import { subjectOf, storyResource, type StoryFacts } from './collaboration.policy';
import { CollaborationRepository } from './collaboration.repository';
import type { CreateInvitationDto } from './dto/collaboration-request.dto';
import type { InvitationDto, MemberDto } from './dto/collaboration-response.dto';
import type { StoryInvitation } from './entities/story-invitation.entity';

const TOKEN_BYTES = 32; // 64 hex chars — matches the entity's varchar(64).

/**
 * Story invitations (AF6). Sending an invitation goes through
 * `engine.assert(StoryInvite)` (owner / co-author). Accept / decline are
 * authorized by INVITATION ownership — the invitee acting on their own
 * invitation — which is why they carry no story-permission assert: there is no
 * `invitation.accept` policy action, and asserting a story action would wrongly
 * deny an invitee who is not yet a member of a private draft. The invitation
 * token IS the capability grant (issued only after `StoryInvite` passed).
 */
@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly repo: CollaborationRepository,
    private readonly pieces: PiecesService,
    private readonly engine: PolicyEngineService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
    private readonly seats: CollaboratorSeatService,
    @Optional()
    @Inject(COLLABORATION_NOTIFIER)
    private readonly notifier?: CollaborationNotifier,
  ) {}

  async invite(
    storyId: string,
    inviter: AuthenticatedUser,
    dto: CreateInvitationDto,
  ): Promise<InvitationDto> {
    const facts = await this.loadFacts(storyId);
    await this.engine.assert({
      subject: subjectOf(inviter),
      action: POLICY_ACTIONS.StoryInvite,
      resource: storyResource(storyId, facts, { targetUserId: dto.inviteeId }),
    });

    if (!ASSIGNABLE_STORY_ROLES.includes(dto.role)) {
      throw new StoryRoleForbiddenException();
    }
    if (dto.inviteeId === inviter.id) {
      throw new InvitationSelfException();
    }
    if (dto.inviteeId === facts.authorId) {
      throw new StoryMemberExistsException(); // the owner is already a member
    }
    if ((await this.repo.findMembership(storyId, dto.inviteeId)) !== null) {
      throw new StoryMemberExistsException();
    }
    /*
     * B6's plan seat cap, charged to `facts.authorId` — the story's OWNER, not `inviter`. A Pro
     * co-author inviting into a Free author's story is spending the free author's (zero) seats.
     * The count includes invitations already outstanding, so issuing them is what consumes the
     * allowance; without that an owner could queue any number and blow past the cap on landing.
     */
    await this.seats.assertCanOfferSeat(storyId, facts.authorId);

    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 3_600_000);

    const invitation = await this.repo.withTransaction(async (manager) => {
      const created = await this.repo.createInvitation(
        {
          storyId,
          inviterId: inviter.id,
          inviteeId: dto.inviteeId,
          role: dto.role,
          status: InvitationStatus.Pending,
          token,
          expiresAt,
          respondedAt: null,
        },
        manager,
      );
      await this.activity.record(
        storyId,
        inviter.id,
        ActivityType.InvitationSent,
        { inviteeId: dto.inviteeId, role: dto.role },
        manager,
      );
      return created;
    });

    await this.safeNotify({
      recipientId: dto.inviteeId,
      actorId: inviter.id,
      type: NotificationType.CollaborationInvite,
      entityType: NotificationEntityType.Invitation,
      entityId: invitation.id,
      data: { storyId, role: dto.role },
    });
    await this.safeAudit(inviter, COLLABORATION_AUDIT_ACTIONS.InvitationSend, invitation.id, {
      storyId,
      inviteeId: dto.inviteeId,
      role: dto.role,
    });
    return toInvitationDto(invitation);
  }

  /** Every invitation on a story (management view). */
  async listForStory(storyId: string, actor: AuthenticatedUser): Promise<InvitationDto[]> {
    const facts = await this.loadFacts(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryInvite,
      resource: storyResource(storyId, facts),
    });
    const rows = await this.repo.listInvitationsForStory(storyId);
    return rows.map(toInvitationDto);
  }

  /** The caller's own pending invitation inbox. */
  async listMine(inviteeId: string): Promise<InvitationDto[]> {
    const rows = await this.repo.listInvitationsForInvitee(inviteeId, InvitationStatus.Pending);
    return rows.map(toInvitationDto);
  }

  /**
   * Accept an invitation → become a collaborator. Authorized by invitation
   * ownership (the invitee). The invitation lifecycle guards run before creating
   * the membership; membership + invitation update + activity commit atomically.
   */
  async accept(invitationId: string, user: AuthenticatedUser): Promise<MemberDto> {
    const invitation = await this.loadPending(invitationId, user.id);
    const facts = await this.pieces.getStoryContext(invitation.storyId);
    if (facts === null) {
      throw new InvitationNotFoundException(); // the story is gone
    }

    if (invitation.inviteeId === facts.authorId) {
      throw new StoryMemberExistsException();
    }
    if ((await this.repo.findMembership(invitation.storyId, invitation.inviteeId)) !== null) {
      throw new StoryMemberExistsException();
    }
    /*
     * B6 re-check (docs/45 §4.11). An invitation issued while the owner was on Pro must not stay
     * acceptable after they downgrade — the cap is enforced when the seat is actually taken, not
     * only when it was offered. Its own exception, and its own copy: the invitee did nothing wrong,
     * cannot buy a seat on someone else's plan, and must not be shown an upsell for one.
     */
    await this.seats.assertCanClaimSeat(invitation.storyId, facts.authorId);
    if ((await this.repo.countMembers(invitation.storyId)) >= MAX_STORY_COLLABORATORS) {
      throw new StoryCollaboratorLimitException(MAX_STORY_COLLABORATORS);
    }

    invitation.status = InvitationStatus.Accepted;
    invitation.respondedAt = new Date();

    const membership = await this.repo.withTransaction(async (manager) => {
      await this.repo.saveInvitation(invitation, manager);
      const created = await this.repo.createMembership(
        {
          storyId: invitation.storyId,
          userId: invitation.inviteeId,
          role: invitation.role,
          invitedById: invitation.inviterId,
        },
        manager,
      );
      await this.activity.record(
        invitation.storyId,
        invitation.inviteeId,
        ActivityType.InvitationAccepted,
        { role: invitation.role, invitationId: invitation.id },
        manager,
      );
      return created;
    });

    this.engine.invalidateUser(invitation.inviteeId);
    await this.safeNotify({
      recipientId: invitation.inviterId,
      actorId: invitation.inviteeId,
      type: NotificationType.InvitationAccepted,
      entityType: NotificationEntityType.Story,
      entityId: invitation.storyId,
      data: { storyId: invitation.storyId, role: invitation.role },
    });
    await this.safeAudit(user, COLLABORATION_AUDIT_ACTIONS.InvitationAccept, invitation.id, {
      storyId: invitation.storyId,
      role: invitation.role,
    });
    return toMemberDto(membership);
  }

  /** Decline an invitation (invitee only). */
  async decline(invitationId: string, user: AuthenticatedUser): Promise<InvitationDto> {
    const invitation = await this.loadPending(invitationId, user.id);
    invitation.status = InvitationStatus.Declined;
    invitation.respondedAt = new Date();
    const saved = await this.repo.saveInvitation(invitation);
    await this.safeAudit(user, COLLABORATION_AUDIT_ACTIONS.InvitationDecline, invitation.id, {
      storyId: invitation.storyId,
    });
    return toInvitationDto(saved);
  }

  /** Revoke a pending invitation (inviter / owner). Authorized via `engine.assert(StoryInvite)`. */
  async revoke(invitationId: string, actor: AuthenticatedUser): Promise<InvitationDto> {
    const invitation = await this.repo.findInvitationById(invitationId);
    if (invitation === null) {
      throw new InvitationNotFoundException();
    }
    const facts = await this.pieces.getStoryContext(invitation.storyId);
    if (facts === null) {
      throw new InvitationNotFoundException();
    }
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryInvite,
      resource: storyResource(invitation.storyId, facts, { targetUserId: invitation.inviteeId }),
    });

    if (invitation.status !== InvitationStatus.Pending) {
      throw new InvitationAlreadyRespondedException();
    }
    invitation.status = InvitationStatus.Revoked;
    invitation.respondedAt = new Date();
    const saved = await this.repo.saveInvitation(invitation);
    await this.safeAudit(actor, COLLABORATION_AUDIT_ACTIONS.InvitationRevoke, invitation.id, {
      storyId: invitation.storyId,
      inviteeId: invitation.inviteeId,
    });
    return toInvitationDto(saved);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Loads a pending invitation addressed to `userId`, or throws the right guard. */
  private async loadPending(invitationId: string, userId: string): Promise<StoryInvitation> {
    const invitation = await this.repo.findInvitationById(invitationId);
    if (invitation === null) {
      throw new InvitationNotFoundException();
    }
    if (invitation.inviteeId !== userId) {
      throw new InvitationNotInviteeException();
    }
    if (invitation.status !== InvitationStatus.Pending) {
      throw new InvitationAlreadyRespondedException();
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      invitation.status = InvitationStatus.Expired;
      await this.repo.saveInvitation(invitation);
      throw new InvitationExpiredException();
    }
    return invitation;
  }

  private async loadFacts(storyId: string): Promise<StoryFacts> {
    const facts = await this.pieces.getStoryContext(storyId);
    if (facts === null) {
      throw new PieceNotFoundException();
    }
    return facts;
  }

  private async safeNotify(input: CollaborationNotification): Promise<void> {
    if (this.notifier === undefined) {
      return;
    }
    try {
      await this.notifier.notify(input);
    } catch (error) {
      this.logger.warn(`notification failed: ${(error as Error).message}`);
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
        targetType: COLLABORATION_AUDIT_TARGET.Invitation,
        targetId,
        metadata,
      });
    } catch (error) {
      this.logger.warn(`audit failed for ${action}: ${(error as Error).message}`);
    }
  }
}
