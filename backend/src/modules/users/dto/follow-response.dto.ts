import { ApiProperty } from '@nestjs/swagger';
import { FollowStatus } from '@qalam/shared';

/** Result of a follow action: `accepted` (public) or `pending` (private request). */
export class FollowActionResponseDto {
  @ApiProperty({ enum: Object.values(FollowStatus) })
  status!: FollowStatus;
}

/** A user row in a followers/following/requests list. */
export class UserSummaryDto {
  @ApiProperty({ description: 'User UUID — the follow target for POST/DELETE /users/:id/follow.' })
  id!: string;
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) penName!: string | null;
  @ApiProperty({ nullable: true }) avatarKey!: string | null;
}

/** A pending follow request (includes the follow id for accept/reject). */
export class FollowRequestDto {
  @ApiProperty({ description: 'Follow row id — target of accept/reject.' }) id!: string;
  @ApiProperty({ type: UserSummaryDto }) requester!: UserSummaryDto;
  @ApiProperty({ format: 'date-time' }) requestedAt!: string;
}
