import { Injectable } from '@nestjs/common';
import { POLICY_ACTIONS } from '@qalam/shared';
import type { EntityManager } from 'typeorm';

import { decodeCursor } from '../../common/pagination/cursor.util';
import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PieceNotFoundException } from '../pieces/exceptions/pieces.exceptions';
import { PiecesService } from '../pieces/pieces.service';
import { PolicyEngineService } from '../policy';
import { COLLABORATION_PAGE_SIZE_DEFAULT } from './collaboration.constants';
import { storyResource, subjectOf } from './collaboration.policy';
import { CollaborationRepository } from './collaboration.repository';
import type { CollaborationCursorQueryDto } from './dto/collaboration-request.dto';
import type { ActivityDto } from './dto/collaboration-response.dto';
import { toActivityDto } from './collaboration.mappers';

/**
 * The story collaboration activity feed (AF6). `record` is the single append
 * path — every mutating collaboration flow logs one event here (usually inside
 * the same transaction as the mutation, via the passed `manager`), so the feed
 * is a faithful, atomic history. `listForStory` is the cursor-paginated read.
 */
@Injectable()
export class ActivityService {
  constructor(
    private readonly repo: CollaborationRepository,
    private readonly pieces: PiecesService,
    private readonly engine: PolicyEngineService,
  ) {}

  /** Appends one activity event; joins the caller's transaction when `manager` is given. */
  async record(
    storyId: string,
    actorId: string,
    type: string,
    metadata: Record<string, unknown> = {},
    manager?: EntityManager,
  ): Promise<void> {
    await this.repo.createActivity({ storyId, actorId, type, metadata }, manager);
  }

  async listForStory(
    storyId: string,
    actor: AuthenticatedUser,
    query: CollaborationCursorQueryDto,
  ): Promise<CursorPage<ActivityDto>> {
    const facts = await this.pieces.getStoryContext(storyId);
    if (facts === null) {
      throw new PieceNotFoundException();
    }
    await this.engine.assert({
      subject: subjectOf(actor),
      action: POLICY_ACTIONS.StoryView,
      resource: storyResource(storyId, facts),
    });
    const limit = query.limit ?? COLLABORATION_PAGE_SIZE_DEFAULT;
    const rows = await this.repo.listActivitiesForStory(storyId, {
      cursor: decodeCursor(query.cursor),
      limit,
    });
    const page = buildCursorPage(rows, limit, (a) => ({
      k: a.createdAt.toISOString(),
      id: a.id,
    }));
    return { items: page.items.map(toActivityDto), meta: page.meta };
  }
}
