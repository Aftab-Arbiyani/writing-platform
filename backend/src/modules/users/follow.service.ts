import { Injectable } from '@nestjs/common';
import { FollowStatus } from '@qalam/shared';

import { TransactionRunner } from '../../common/database/transaction-runner';
import { decodeCursor } from '../../common/pagination/cursor.util';
import { buildCursorPage } from '../../common/pagination/pagination.helper';
import type { CursorPage } from '../../common/types/paginated-result';
import type {
  FollowActionResponseDto,
  FollowRequestDto,
  UserSummaryDto,
} from './dto/follow-response.dto';
import {
  AlreadyFollowingException,
  CannotFollowSelfException,
  FollowRequestNotFoundException,
  FollowRequestPendingException,
  PrivateAccountException,
  UserNotFoundException,
} from './exceptions/users.exceptions';
import type { FollowEdgeRow } from './follow.repository';
import { FollowRepository } from './follow.repository';
import { ProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';
import { UsersService } from './users.service';

/**
 * Follow state machine (docs 04 §3.6, docs 18 E2 task 3). A public target is
 * followed immediately (`accepted`); a private target creates a `pending`
 * request. Counters are maintained transactionally with the edge (docs 04 §7).
 */
@Injectable()
export class FollowService {
  constructor(
    private readonly follows: FollowRepository,
    private readonly profiles: ProfileRepository,
    private readonly profileService: ProfileService,
    private readonly users: UsersService,
    private readonly transactions: TransactionRunner,
  ) {}

  async follow(followerId: string, targetUserId: string): Promise<FollowActionResponseDto> {
    if (followerId === targetUserId) {
      throw new CannotFollowSelfException();
    }
    if ((await this.users.findById(targetUserId)) === null) {
      throw new UserNotFoundException();
    }
    // Ensure both profiles exist (counters live on them) and read target privacy.
    const targetProfile = await this.profileService.getOrCreateByUserId(targetUserId);
    await this.profileService.getOrCreateByUserId(followerId);

    const existing = await this.follows.find(followerId, targetUserId);
    if (existing?.status === FollowStatus.Accepted) {
      throw new AlreadyFollowingException();
    }
    if (existing?.status === FollowStatus.Pending) {
      throw new FollowRequestPendingException();
    }

    const status = targetProfile.isPrivate ? FollowStatus.Pending : FollowStatus.Accepted;
    await this.transactions.run(async (manager) => {
      await this.follows.create({ followerId, followeeId: targetUserId, status }, manager);
      if (status === FollowStatus.Accepted) {
        await this.profiles.incrementCounts(targetUserId, { followers: 1 }, manager);
        await this.profiles.incrementCounts(followerId, { following: 1 }, manager);
      }
    });
    return { status };
  }

  /** Unfollow (accepted) or cancel a pending request — idempotent (204 either way). */
  async unfollowOrCancel(followerId: string, targetUserId: string): Promise<void> {
    const existing = await this.follows.find(followerId, targetUserId);
    if (existing === null) {
      return;
    }
    await this.transactions.run(async (manager) => {
      await this.follows.deleteById(existing.id, manager);
      if (existing.status === FollowStatus.Accepted) {
        await this.profiles.incrementCounts(targetUserId, { followers: -1 }, manager);
        await this.profiles.incrementCounts(followerId, { following: -1 }, manager);
      }
    });
  }

  async listRequests(
    userId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<FollowRequestDto>> {
    const rows = await this.follows.listPendingRequests(userId, decodeCursor(rawCursor), limit);
    const page = buildCursorPage(rows, limit, edgeCursor);
    return { items: page.items.map(toRequestDto), meta: page.meta };
  }

  async acceptRequest(followId: string, currentUserId: string): Promise<void> {
    const request = await this.follows.findById(followId);
    if (
      request === null ||
      request.followeeId !== currentUserId ||
      request.status !== FollowStatus.Pending
    ) {
      throw new FollowRequestNotFoundException();
    }
    await this.transactions.run(async (manager) => {
      await this.follows.setStatus(request.id, FollowStatus.Accepted, manager);
      await this.profiles.incrementCounts(currentUserId, { followers: 1 }, manager);
      await this.profiles.incrementCounts(request.followerId, { following: 1 }, manager);
    });
  }

  async rejectRequest(followId: string, currentUserId: string): Promise<void> {
    const request = await this.follows.findById(followId);
    if (
      request === null ||
      request.followeeId !== currentUserId ||
      request.status !== FollowStatus.Pending
    ) {
      throw new FollowRequestNotFoundException();
    }
    await this.transactions.run((manager) => this.follows.deleteById(request.id, manager));
  }

  getFollowers(
    username: string,
    viewerUserId: string | null,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<UserSummaryDto>> {
    return this.listEdges(username, viewerUserId, rawCursor, limit, (id, c, l) =>
      this.follows.listFollowers(id, c, l),
    );
  }

  getFollowing(
    username: string,
    viewerUserId: string | null,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<UserSummaryDto>> {
    return this.listEdges(username, viewerUserId, rawCursor, limit, (id, c, l) =>
      this.follows.listFollowing(id, c, l),
    );
  }

  private async listEdges(
    username: string,
    viewerUserId: string | null,
    rawCursor: string | undefined,
    limit: number,
    fetch: (
      ownerId: string,
      cursor: ReturnType<typeof decodeCursor>,
      limit: number,
    ) => Promise<FollowEdgeRow[]>,
  ): Promise<CursorPage<UserSummaryDto>> {
    const owner = await this.users.findByUsername(username);
    if (owner === null) {
      throw new UserNotFoundException();
    }
    const profile = await this.profileService.getOrCreateByUserId(owner.id);
    await this.assertCanViewLists(profile.isPrivate, owner.id, viewerUserId);

    const rows = await fetch(owner.id, decodeCursor(rawCursor), limit);
    const page = buildCursorPage(rows, limit, edgeCursor);
    return { items: page.items.map(toSummary), meta: page.meta };
  }

  private async assertCanViewLists(
    isPrivate: boolean,
    ownerId: string,
    viewerUserId: string | null,
  ): Promise<void> {
    if (!isPrivate || viewerUserId === ownerId) {
      return;
    }
    if (viewerUserId === null || !(await this.follows.isAcceptedFollower(viewerUserId, ownerId))) {
      throw new PrivateAccountException();
    }
  }
}

const edgeCursor = (row: FollowEdgeRow): { k: string; id: string } => ({
  k: new Date(row.createdAt).toISOString(),
  id: row.followId,
});

function toSummary(row: FollowEdgeRow): UserSummaryDto {
  return { username: row.username, penName: row.penName, avatarKey: row.avatarKey };
}

function toRequestDto(row: FollowEdgeRow): FollowRequestDto {
  return {
    id: row.followId,
    requester: { username: row.username, penName: row.penName, avatarKey: row.avatarKey },
    requestedAt: new Date(row.createdAt).toISOString(),
  };
}
