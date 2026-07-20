import { Injectable } from '@nestjs/common';
import type { CommentStatus, InvitationStatus, SuggestionStatus } from '@qalam/shared';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { CollaborationActivity } from './entities/collaboration-activity.entity';
import { CollaborationComment } from './entities/collaboration-comment.entity';
import { StoryInvitation } from './entities/story-invitation.entity';
import { StoryMembership } from './entities/story-membership.entity';
import { StorySuggestion } from './entities/story-suggestion.entity';

/**
 * Data access for the five collaboration tables (docs 16 §3.3 — only
 * repositories touch query builders). `DataSource`-based so it can run inside a
 * caller-supplied transaction (`withTransaction`) or standalone. Every list is
 * keyset-paginated by over-fetching `limit + 1` (no `COUNT(*)` on hot paths).
 */
@Injectable()
export class CollaborationRepository {
  constructor(private readonly dataSource: DataSource) {}

  /** Runs `work` inside a transaction — used for multi-table writes (mutation + activity). */
  withTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(work);
  }

  private manager(manager?: EntityManager): EntityManager {
    return manager ?? this.dataSource.manager;
  }

  private memberships(manager?: EntityManager): Repository<StoryMembership> {
    return this.manager(manager).getRepository(StoryMembership);
  }

  private invitations(manager?: EntityManager): Repository<StoryInvitation> {
    return this.manager(manager).getRepository(StoryInvitation);
  }

  private comments(manager?: EntityManager): Repository<CollaborationComment> {
    return this.manager(manager).getRepository(CollaborationComment);
  }

  private suggestions(manager?: EntityManager): Repository<StorySuggestion> {
    return this.manager(manager).getRepository(StorySuggestion);
  }

  private activities(manager?: EntityManager): Repository<CollaborationActivity> {
    return this.manager(manager).getRepository(CollaborationActivity);
  }

  // ── Memberships ─────────────────────────────────────────────────────────────

  findMembership(
    storyId: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<StoryMembership | null> {
    return this.memberships(manager).findOne({ where: { storyId, userId } });
  }

  listMembers(storyId: string): Promise<StoryMembership[]> {
    return this.memberships()
      .createQueryBuilder('m')
      .where('m.story_id = :storyId', { storyId })
      .orderBy('m.created_at', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .getMany();
  }

  countMembers(storyId: string, manager?: EntityManager): Promise<number> {
    return this.memberships(manager)
      .createQueryBuilder('m')
      .where('m.story_id = :storyId', { storyId })
      .getCount();
  }

  createMembership(
    data: Partial<StoryMembership>,
    manager?: EntityManager,
  ): Promise<StoryMembership> {
    const repo = this.memberships(manager);
    return repo.save(repo.create(data));
  }

  saveMembership(entity: StoryMembership, manager?: EntityManager): Promise<StoryMembership> {
    return this.memberships(manager).save(entity);
  }

  async deleteMembership(id: string, manager?: EntityManager): Promise<void> {
    await this.memberships(manager).delete({ id });
  }

  // ── Invitations ───────────────────────────────────────────────────────────────

  findInvitationById(id: string, manager?: EntityManager): Promise<StoryInvitation | null> {
    return this.invitations(manager).findOne({ where: { id } });
  }

  findInvitationByToken(token: string): Promise<StoryInvitation | null> {
    return this.invitations().findOne({ where: { token } });
  }

  findPendingInvitation(
    storyId: string,
    inviteeId: string,
    pending: InvitationStatus,
  ): Promise<StoryInvitation | null> {
    return this.invitations().findOne({ where: { storyId, inviteeId, status: pending } });
  }

  listInvitationsForStory(storyId: string): Promise<StoryInvitation[]> {
    return this.invitations()
      .createQueryBuilder('i')
      .where('i.story_id = :storyId', { storyId })
      .orderBy('i.created_at', 'DESC')
      .addOrderBy('i.id', 'DESC')
      .getMany();
  }

  listInvitationsForInvitee(
    inviteeId: string,
    status: InvitationStatus,
  ): Promise<StoryInvitation[]> {
    return this.invitations()
      .createQueryBuilder('i')
      .where('i.invitee_id = :inviteeId', { inviteeId })
      .andWhere('i.status = :status', { status })
      .orderBy('i.created_at', 'DESC')
      .addOrderBy('i.id', 'DESC')
      .getMany();
  }

  createInvitation(
    data: Partial<StoryInvitation>,
    manager?: EntityManager,
  ): Promise<StoryInvitation> {
    const repo = this.invitations(manager);
    return repo.save(repo.create(data));
  }

  saveInvitation(entity: StoryInvitation, manager?: EntityManager): Promise<StoryInvitation> {
    return this.invitations(manager).save(entity);
  }

  // ── Comments ────────────────────────────────────────────────────────────────

  findCommentById(id: string, manager?: EntityManager): Promise<CollaborationComment | null> {
    return this.comments(manager).findOne({ where: { id } });
  }

  /** Root comments for a story (parent_id IS NULL), keyset-paginated (over-fetch limit+1). */
  listRootComments(
    storyId: string,
    options: { status?: CommentStatus; cursor: CursorPayload | null; limit: number },
  ): Promise<CollaborationComment[]> {
    const qb = this.comments()
      .createQueryBuilder('c')
      .where('c.story_id = :storyId', { storyId })
      .andWhere('c.parent_id IS NULL')
      .andWhere('c.deleted_at IS NULL')
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .limit(options.limit + 1);

    if (options.status !== undefined) {
      qb.andWhere('c.status = :status', { status: options.status });
    }
    if (options.cursor !== null) {
      qb.andWhere('(c.created_at, c.id) < (:k, :cid)', {
        k: options.cursor.k,
        cid: options.cursor.id,
      });
    }
    return qb.getMany();
  }

  /** All replies of a thread, oldest first. */
  listReplies(parentId: string): Promise<CollaborationComment[]> {
    return this.comments()
      .createQueryBuilder('c')
      .where('c.parent_id = :parentId', { parentId })
      .andWhere('c.deleted_at IS NULL')
      .orderBy('c.created_at', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .getMany();
  }

  createComment(
    data: Partial<CollaborationComment>,
    manager?: EntityManager,
  ): Promise<CollaborationComment> {
    const repo = this.comments(manager);
    return repo.save(repo.create(data));
  }

  saveComment(
    entity: CollaborationComment,
    manager?: EntityManager,
  ): Promise<CollaborationComment> {
    return this.comments(manager).save(entity);
  }

  async softDeleteComment(id: string, manager?: EntityManager): Promise<void> {
    await this.comments(manager).softDelete({ id });
  }

  // ── Suggestions ───────────────────────────────────────────────────────────────

  findSuggestionById(id: string, manager?: EntityManager): Promise<StorySuggestion | null> {
    return this.suggestions(manager).findOne({ where: { id } });
  }

  listSuggestionsForStory(
    storyId: string,
    options: { status?: SuggestionStatus; cursor: CursorPayload | null; limit: number },
  ): Promise<StorySuggestion[]> {
    const qb = this.suggestions()
      .createQueryBuilder('s')
      .where('s.story_id = :storyId', { storyId })
      .orderBy('s.created_at', 'DESC')
      .addOrderBy('s.id', 'DESC')
      .limit(options.limit + 1);

    if (options.status !== undefined) {
      qb.andWhere('s.status = :status', { status: options.status });
    }
    if (options.cursor !== null) {
      qb.andWhere('(s.created_at, s.id) < (:k, :cid)', {
        k: options.cursor.k,
        cid: options.cursor.id,
      });
    }
    return qb.getMany();
  }

  createSuggestion(
    data: Partial<StorySuggestion>,
    manager?: EntityManager,
  ): Promise<StorySuggestion> {
    const repo = this.suggestions(manager);
    return repo.save(repo.create(data));
  }

  saveSuggestion(entity: StorySuggestion, manager?: EntityManager): Promise<StorySuggestion> {
    return this.suggestions(manager).save(entity);
  }

  // ── Activities ─────────────────────────────────────────────────────────────

  createActivity(
    data: Partial<CollaborationActivity>,
    manager?: EntityManager,
  ): Promise<CollaborationActivity> {
    const repo = this.activities(manager);
    return repo.save(repo.create(data));
  }

  listActivitiesForStory(
    storyId: string,
    options: { cursor: CursorPayload | null; limit: number },
  ): Promise<CollaborationActivity[]> {
    const qb = this.activities()
      .createQueryBuilder('a')
      .where('a.story_id = :storyId', { storyId })
      .orderBy('a.created_at', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .limit(options.limit + 1);

    if (options.cursor !== null) {
      qb.andWhere('(a.created_at, a.id) < (:k, :cid)', {
        k: options.cursor.k,
        cid: options.cursor.id,
      });
    }
    return qb.getMany();
  }
}
