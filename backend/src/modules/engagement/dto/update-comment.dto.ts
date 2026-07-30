import { ApiProperty } from '@nestjs/swagger';
import { COMMENT_MAX_LENGTH, COMMENT_MIN_LENGTH } from '@qalam/shared';
import { IsString, Length } from 'class-validator';

/** `PATCH /comments/:id` body — owner-only; stamps `edited_at`. */
export class UpdateCommentDto {
  @ApiProperty({ minLength: COMMENT_MIN_LENGTH, maxLength: COMMENT_MAX_LENGTH })
  @IsString()
  @Length(COMMENT_MIN_LENGTH, COMMENT_MAX_LENGTH)
  body!: string;
}
