import { Column, Entity, Index } from 'typeorm';
import { InvitationStatus } from '@qalam/shared';
import type { StoryRole } from '@qalam/shared';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A pending/settled invitation to collaborate on a story (AF6). Created by a
 * collaborator with `story.invite` authority (owner / co-author); accepted or
 * declined by the invitee, or revoked by the inviter/owner. Auto-expires after
 * {@link INVITATION_TTL_HOURS}.
 *
 * `token` is a single-use opaque secret (`randomBytes` hex) — unique so a link
 * resolves to exactly one invitation. `storyId` / `inviterId` / `inviteeId` are
 * plain uuids (no FK — module isolation). The `(inviteeId, status)` index backs
 * the "my pending invitations" inbox.
 */
@Entity('story_invitations')
@Index('uq_story_invitation_token', ['token'], { unique: true })
@Index('idx_story_invitation_invitee', ['inviteeId', 'status'])
@Index('idx_story_invitation_story', ['storyId', 'status'])
export class StoryInvitation extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  storyId!: string;

  @Column({ type: 'uuid' })
  inviterId!: string;

  @Column({ type: 'uuid' })
  inviteeId!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: StoryRole;

  @Column({ type: 'varchar', length: 20, default: InvitationStatus.Pending })
  status!: InvitationStatus;

  /** Single-use opaque acceptance secret (64 hex chars). */
  @Column({ type: 'varchar', length: 64 })
  token!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  /** When the invitee accepted/declined or the inviter revoked (null while pending). */
  @Column({ type: 'timestamptz', nullable: true })
  respondedAt!: Date | null;
}
