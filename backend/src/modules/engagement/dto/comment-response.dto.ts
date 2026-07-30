import { ApiProperty } from '@nestjs/swagger';

/** Comment author summary (null when the comment is deleted). */
export class CommentAuthorDto {
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) penName!: string | null;
  @ApiProperty({ nullable: true }) avatarKey!: string | null;
}

/**
 * A single comment for the thread view. A soft-deleted comment keeps its node
 * (replies stay visible) but its `author` is null and `body` is the tombstone
 * "This comment has been deleted." — the client renders the placeholder.
 */
export class CommentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, description: 'Null for a top-level comment.' })
  parentId!: string | null;
  @ApiProperty({ description: '1 for top-level; parent.depth + 1 for a reply.' })
  depth!: number;
  @ApiProperty({ type: CommentAuthorDto, nullable: true }) author!: CommentAuthorDto | null;
  @ApiProperty() body!: string;
  @ApiProperty({ description: 'True when soft-deleted (body is the tombstone text).' })
  isDeleted!: boolean;
  @ApiProperty({ description: 'Immediate reply count (fetch via /comments/:id/replies).' })
  replyCount!: number;
  @ApiProperty({ nullable: true, description: 'Last edit time; null if never edited.' })
  editedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
