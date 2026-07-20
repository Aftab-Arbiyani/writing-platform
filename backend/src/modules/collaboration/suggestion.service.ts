import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  CollaborationActivity as ActivityType,
  NotificationEntityType,
  NotificationType,
  POLICY_ACTIONS,
  SuggestionStatus,
} from '@qalam/shared';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuditService } from '../audit/audit.service';
import {
  COLLABORATION_NOTIFIER,
  type CollaborationNotification,
  type CollaborationNotifier,
} from './collaboration-notifier.port';
import { PieceNotFoundException } from '../pieces/exceptions/pieces.exceptions';
import { PiecesService } from '../pieces/pieces.service';
import { PolicyEngineService } from '../policy';
import { decodeCursor } from '../../common/pagination/cursor.util';
import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import { ActivityService } from './activity.service';
import {
  COLLABORATION_AUDIT_ACTIONS,
  COLLABORATION_AUDIT_TARGET,
  COLLABORATION_PAGE_SIZE_DEFAULT,
} from './collaboration.constants';
import {
  SuggestionAlreadyResolvedException,
  SuggestionConflictException,
  SuggestionNotFoundException,
} from './collaboration.exceptions';
import { toSuggestionDto } from './collaboration.mappers';
import {
  storyResource,
  subjectOf,
  suggestionResource,
  type StoryFacts,
} from './collaboration.policy';
import { CollaborationRepository } from './collaboration.repository';
import { extractPlainText } from './content-text.util';
import type { CreateSuggestionDto, SuggestionListQueryDto } from './dto/collaboration-request.dto';
import type { SuggestionDto } from './dto/collaboration-response.dto';
import type { StorySuggestion } from './entities/story-suggestion.entity';

/**
 * Story edit suggestions / "track changes" (AF6). Creating goes through
 * `engine.assert(StorySuggest)`; accept/reject/withdraw through
 * `SuggestionResolve` — the engine's self-service rule (resource `ownerId` =
 * suggestion author) lets the author withdraw their own suggestion, while
 * co-authors/owner resolve others'. Accept marks the suggestion accepted after a
 * conflict check (the story text must still contain `originalText`); it does NOT
 * mutate the piece content — applying the edit is the writer's editor action.
 */
@Injectable()
export class SuggestionService {
  private readonly logger = new Logger(SuggestionService.name);

  constructor(
    private readonly repo: CollaborationRepository,
    private readonly pieces: PiecesService,
    private readonly engine: PolicyEngineService,
    private readonly audit: AuditService,
    private readonly activity: ActivityService,
    @Optional()
    @Inject(COLLABORATION_NOTIFIER)
    private readonly notifier?: CollaborationNotifier,
  ) {}

  async create(
    storyId: string,
    user: AuthenticatedUser,
    dto: CreateSuggestionDto,
  ): Promise<SuggestionDto> {
    const facts = await this.loadFacts(storyId);
    await this.engine.assert({
      subject: subjectOf(user),
      action: POLICY_ACTIONS.StorySuggest,
      resource: suggestionResource(storyId, storyId, facts, user.id),
    });

    const suggestion = await this.repo.withTransaction(async (manager) => {
      const created = await this.repo.createSuggestion(
        {
          storyId,
          authorId: user.id,
          anchor: { from: dto.anchor.from, to: dto.anchor.to },
          originalText: dto.originalText,
          suggestedText: dto.suggestedText,
          status: SuggestionStatus.Pending,
          resolvedById: null,
          resolvedAt: null,
        },
        manager,
      );
      await this.activity.record(
        storyId,
        user.id,
        ActivityType.SuggestionAdded,
        { suggestionId: created.id },
        manager,
      );
      return created;
    });

    await this.safeNotify({
      recipientId: facts.authorId,
      actorId: user.id,
      type: NotificationType.SuggestionReceived,
      entityType: NotificationEntityType.Suggestion,
      entityId: suggestion.id,
      data: { storyId },
    });
    await this.safeAudit(user, COLLABORATION_AUDIT_ACTIONS.SuggestionCreate, suggestion.id, {
      storyId,
    });
    return toSuggestionDto(suggestion);
  }

  async listForStory(
    storyId: string,
    actor: AuthenticatedUser,
    query: SuggestionListQueryDto,
  ): Promise<CursorPage<SuggestionDto>> {
    const facts = await this.loadFacts(storyId);
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryView,
      resource: storyResource(storyId, facts),
    });
    const limit = query.limit ?? COLLABORATION_PAGE_SIZE_DEFAULT;
    const rows = await this.repo.listSuggestionsForStory(storyId, {
      status: query.status,
      cursor: decodeCursor(query.cursor),
      limit,
    });
    const page = buildCursorPage(rows, limit, (s) => ({
      k: s.createdAt.toISOString(),
      id: s.id,
    }));
    return { items: page.items.map(toSuggestionDto), meta: page.meta };
  }

  async accept(suggestionId: string, user: AuthenticatedUser): Promise<SuggestionDto> {
    const { suggestion, facts } = await this.loadForResolve(suggestionId);
    await this.engine.assert({
      subject: subjectOf(user),
      action: POLICY_ACTIONS.SuggestionResolve,
      resource: suggestionResource(suggestion.id, suggestion.storyId, facts, suggestion.authorId),
    });

    this.assertPending(suggestion);
    await this.assertNoConflict(suggestion.storyId, facts.authorId, suggestion);

    const saved = await this.settle(
      suggestion,
      SuggestionStatus.Accepted,
      user.id,
      ActivityType.SuggestionAccepted,
    );
    await this.safeNotify({
      recipientId: suggestion.authorId,
      actorId: user.id,
      type: NotificationType.SuggestionResolved,
      entityType: NotificationEntityType.Suggestion,
      entityId: suggestion.id,
      data: { storyId: suggestion.storyId, status: SuggestionStatus.Accepted },
    });
    await this.safeAudit(user, COLLABORATION_AUDIT_ACTIONS.SuggestionAccept, suggestion.id, {
      storyId: suggestion.storyId,
    });
    return toSuggestionDto(saved);
  }

  async reject(suggestionId: string, user: AuthenticatedUser): Promise<SuggestionDto> {
    const { suggestion, facts } = await this.loadForResolve(suggestionId);
    await this.engine.assert({
      subject: subjectOf(user),
      action: POLICY_ACTIONS.SuggestionResolve,
      resource: suggestionResource(suggestion.id, suggestion.storyId, facts, suggestion.authorId),
    });

    this.assertPending(suggestion);
    const saved = await this.settle(
      suggestion,
      SuggestionStatus.Rejected,
      user.id,
      ActivityType.SuggestionRejected,
    );
    await this.safeNotify({
      recipientId: suggestion.authorId,
      actorId: user.id,
      type: NotificationType.SuggestionResolved,
      entityType: NotificationEntityType.Suggestion,
      entityId: suggestion.id,
      data: { storyId: suggestion.storyId, status: SuggestionStatus.Rejected },
    });
    await this.safeAudit(user, COLLABORATION_AUDIT_ACTIONS.SuggestionReject, suggestion.id, {
      storyId: suggestion.storyId,
    });
    return toSuggestionDto(saved);
  }

  /**
   * Withdraw a suggestion. Authorization is delegated to the engine's self-service
   * rule (`SuggestionResolve` with `ownerId` = author), so the author retracts
   * their own suggestion without a hand-rolled owner check. A single write (no
   * activity event), so no transaction.
   */
  async withdraw(suggestionId: string, user: AuthenticatedUser): Promise<SuggestionDto> {
    const { suggestion, facts } = await this.loadForResolve(suggestionId);
    await this.engine.assert({
      subject: subjectOf(user),
      action: POLICY_ACTIONS.SuggestionResolve,
      resource: suggestionResource(suggestion.id, suggestion.storyId, facts, suggestion.authorId),
    });

    this.assertPending(suggestion);
    suggestion.status = SuggestionStatus.Withdrawn;
    suggestion.resolvedById = user.id;
    suggestion.resolvedAt = new Date();
    const saved = await this.repo.saveSuggestion(suggestion);
    await this.safeAudit(user, COLLABORATION_AUDIT_ACTIONS.SuggestionWithdraw, suggestion.id, {
      storyId: suggestion.storyId,
    });
    return toSuggestionDto(saved);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async loadForResolve(
    suggestionId: string,
  ): Promise<{ suggestion: StorySuggestion; facts: StoryFacts }> {
    const suggestion = await this.repo.findSuggestionById(suggestionId);
    if (suggestion === null) {
      throw new SuggestionNotFoundException();
    }
    const facts = await this.pieces.getStoryContext(suggestion.storyId);
    if (facts === null) {
      throw new SuggestionNotFoundException(); // the story is gone
    }
    return { suggestion, facts };
  }

  private assertPending(suggestion: StorySuggestion): void {
    if (suggestion.status !== SuggestionStatus.Pending) {
      throw new SuggestionAlreadyResolvedException();
    }
  }

  /** The story text must still contain the suggestion's `originalText`, else it's a conflict. */
  private async assertNoConflict(
    storyId: string,
    ownerId: string,
    suggestion: StorySuggestion,
  ): Promise<void> {
    // Read the current content as the owner (owner sees any status → never a 404).
    const piece = await this.pieces.getById(storyId, ownerId);
    const text = extractPlainText(piece.content);
    if (!text.includes(suggestion.originalText)) {
      throw new SuggestionConflictException();
    }
  }

  private settle(
    suggestion: StorySuggestion,
    status: SuggestionStatus,
    resolverId: string,
    activityType: string,
  ): Promise<StorySuggestion> {
    suggestion.status = status;
    suggestion.resolvedById = resolverId;
    suggestion.resolvedAt = new Date();
    return this.repo.withTransaction(async (manager) => {
      const saved = await this.repo.saveSuggestion(suggestion, manager);
      await this.activity.record(
        suggestion.storyId,
        resolverId,
        activityType,
        { suggestionId: suggestion.id },
        manager,
      );
      return saved;
    });
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
    targetId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        action,
        targetType: COLLABORATION_AUDIT_TARGET.Suggestion,
        targetId,
        metadata,
      });
    } catch (error) {
      this.logger.warn(`audit failed for ${action}: ${(error as Error).message}`);
    }
  }
}
