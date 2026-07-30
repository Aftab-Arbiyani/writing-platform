import { FollowStatus } from '@qalam/shared';
import { Check, Column, Entity, Index, Unique } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A follow edge (docs 04 §3.6). `status` is the pending flag the doc anticipated
 * for approved-follows: a `pending` row is a follow request awaiting a private
 * account's approval; `accepted` is an active follow. This makes `follows`
 * mutable (accept flips the status), hence `updated_at` from QalamBaseEntity.
 *
 * `follower_id`/`followee_id` are plain FK columns (constraints + `ON DELETE
 * CASCADE` in the migration). Self-follows are blocked by a CHECK; duplicate
 * edges/requests by the unique pair.
 */
@Entity('follows')
@Unique('uq_follows', ['followerId', 'followeeId'])
@Check('chk_follows_not_self', '"follower_id" <> "followee_id"')
@Index('idx_follows_follower', ['followerId', 'createdAt']) // following list
@Index('idx_follows_followee', ['followeeId', 'createdAt']) // followers list + feed fan-in
@Index('idx_follows_pending', ['followeeId', 'status']) // incoming follow-request queue
export class Follow extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  followerId!: string;

  @Column({ type: 'uuid' })
  followeeId!: string;

  @Column({
    type: 'enum',
    enum: Object.values(FollowStatus),
    enumName: 'follow_status',
    default: FollowStatus.Accepted,
  })
  status!: FollowStatus;
}
