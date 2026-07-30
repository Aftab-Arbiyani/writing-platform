import { ApiProperty } from '@nestjs/swagger';
import { COMMENT_MAX_LENGTH, COMMENT_MIN_LENGTH } from '@qalam/shared';
import { IsString, Length } from 'class-validator';

/**
 * `POST /pieces/:id/comments` and `POST /comments/:id/replies` body. The parent
 * (for a reply) comes from the URL, not the body — the two endpoints share this
 * shape. Body length is bounded by the shared limits (single source of truth).
 */
export class CreateCommentDto {
  @ApiProperty({
    minLength: COMMENT_MIN_LENGTH,
    maxLength: COMMENT_MAX_LENGTH,
    description: 'Comment text (plain text).',
  })
  @IsString()
  @Length(COMMENT_MIN_LENGTH, COMMENT_MAX_LENGTH)
  body!: string;
}
