import { Injectable } from '@nestjs/common';
import { FollowStatus } from '@qalam/shared';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { Follow } from './entities/follow.entity';

/** A user row in a followers/following/requests list (joined, no N+1). */
export interface FollowEdgeRow {
  /** The follow row id (needed for accept/reject on request lists). */
  followId: string;
  userId: string;
  username: string;
  penName: string | null;
  avatarKey: string | null;
  isPrivate: boolean;
  createdAt: Date;
}

/** Data access for `follows` (docs 16 §3.3). List queries join users + profiles once. */
@Injectable()
export class FollowRepository {
  constructor(private readonly dataSource: DataSource) {}

  private manager(manager?: EntityManager): EntityManager {
    return manager ?? this.dataSource.manager;
  }

  private repo(manager?: EntityManager): Repository<Follow> {
    return this.manager(manager).getRepository(Follow);
  }

  find(followerId: string, followeeId: string, manager?: EntityManager): Promise<Follow | null> {
    return this.repo(manager).findOne({ where: { followerId, followeeId } });
  }

  findById(id: string, manager?: EntityManager): Promise<Follow | null> {
    return this.repo(manager).findOne({ where: { id } });
  }

  /** True if `followerId` has an ACCEPTED follow of `followeeId`. */
  async isAcceptedFollower(
    followerId: string,
    followeeId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const count = await this.repo(manager).count({
      where: { followerId, followeeId, status: FollowStatus.Accepted },
    });
    return count > 0;
  }

  create(data: Partial<Follow>, manager?: EntityManager): Promise<Follow> {
    const repo = this.repo(manager);
    return repo.save(repo.create(data));
  }

  async setStatus(id: string, status: FollowStatus, manager: EntityManager): Promise<void> {
    await manager.getRepository(Follow).update({ id }, { status });
  }

  async deleteById(id: string, manager: EntityManager): Promise<void> {
    await manager.getRepository(Follow).delete({ id });
  }

  /** Accepted followers of `followeeId` (keyset over follows.created_at,id DESC; over-fetches limit+1). */
  listFollowers(
    followeeId: string,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<FollowEdgeRow[]> {
    return this.edgeQuery(
      'f.followee_id = :target',
      'f.follower_id',
      followeeId,
      FollowStatus.Accepted,
      cursor,
      limit,
    );
  }

  /** Accounts `followerId` follows (accepted). */
  listFollowing(
    followerId: string,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<FollowEdgeRow[]> {
    return this.edgeQuery(
      'f.follower_id = :target',
      'f.followee_id',
      followerId,
      FollowStatus.Accepted,
      cursor,
      limit,
    );
  }

  /** Incoming pending follow requests for `followeeId` (the requester's summary). */
  listPendingRequests(
    followeeId: string,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<FollowEdgeRow[]> {
    return this.edgeQuery(
      'f.followee_id = :target',
      'f.follower_id',
      followeeId,
      FollowStatus.Pending,
      cursor,
      limit,
    );
  }

  /**
   * Shared join: pick the "other" side of the edge (`otherColumn`) and hydrate its
   * user + profile in one query. Keyset paginates over (created_at, id) DESC.
   */
  private edgeQuery(
    targetPredicate: string,
    otherColumn: string,
    target: string,
    status: FollowStatus,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<FollowEdgeRow[]> {
    const qb: SelectQueryBuilder<Follow> = this.manager()
      .getRepository(Follow)
      .createQueryBuilder('f')
      .innerJoin('users', 'u', `u.id = ${otherColumn}`)
      .innerJoin('profiles', 'p', 'p.user_id = u.id')
      .where(targetPredicate, { target })
      .andWhere('f.status = :status', { status })
      .orderBy('f.created_at', 'DESC')
      .addOrderBy('f.id', 'DESC')
      .limit(limit + 1)
      .select([
        'f.id AS "followId"',
        'u.id AS "userId"',
        'u.username AS "username"',
        'p.pen_name AS "penName"',
        'p.avatar_key AS "avatarKey"',
        'p.is_private AS "isPrivate"',
        'f.created_at AS "createdAt"',
      ]);

    if (cursor !== null) {
      qb.andWhere('(f.created_at, f.id) < (:k, :cid)', { k: cursor.k, cid: cursor.id });
    }
    return qb.getRawMany<FollowEdgeRow>();
  }
}
