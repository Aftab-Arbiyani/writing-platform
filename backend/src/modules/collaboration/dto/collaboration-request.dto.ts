import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ASSIGNABLE_STORY_ROLES,
  CommentKind,
  CommentStatus,
  MAX_COMMENT_BODY_LENGTH,
  MAX_SUGGESTION_LENGTH,
  PresenceState,
  SuggestionStatus,
} from '@qalam/shared';
import type { StoryRole } from '@qalam/shared';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  COLLABORATION_PAGE_SIZE_DEFAULT,
  COLLABORATION_PAGE_SIZE_MAX,
} from '../collaboration.constants';

const ASSIGNABLE_ROLE_VALUES = ASSIGNABLE_STORY_ROLES as readonly string[];

/** Opaque-cursor pagination query (shared by all collaboration list endpoints). */
export class CollaborationCursorQueryDto {
  @ApiPropertyOptional({ description: 'Opaque keyset cursor from a previous page.' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: COLLABORATION_PAGE_SIZE_MAX,
    default: COLLABORATION_PAGE_SIZE_DEFAULT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(COLLABORATION_PAGE_SIZE_MAX)
  limit?: number;
}

/** Comment list query — cursor + optional open/resolved status filter. */
export class CommentListQueryDto extends CollaborationCursorQueryDto {
  @ApiPropertyOptional({ enum: Object.values(CommentStatus) })
  @IsOptional()
  @IsIn(Object.values(CommentStatus))
  status?: CommentStatus;
}

/** Suggestion list query — cursor + optional status filter. */
export class SuggestionListQueryDto extends CollaborationCursorQueryDto {
  @ApiPropertyOptional({ enum: Object.values(SuggestionStatus) })
  @IsOptional()
  @IsIn(Object.values(SuggestionStatus))
  status?: SuggestionStatus;
}

/** Add a collaborator directly (owner action). */
export class AddMemberDto {
  @ApiProperty({ description: 'The user to add as a collaborator.' })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    enum: ASSIGNABLE_ROLE_VALUES,
    description: 'Assignable story role (never owner).',
  })
  @IsIn(ASSIGNABLE_ROLE_VALUES)
  role!: StoryRole;
}

/** Change a collaborator's role. */
export class ChangeRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLE_VALUES, description: 'New assignable story role.' })
  @IsIn(ASSIGNABLE_ROLE_VALUES)
  role!: StoryRole;
}

/** Invite a user to collaborate on a story. */
export class CreateInvitationDto {
  @ApiProperty({ description: 'The user being invited.' })
  @IsUUID()
  inviteeId!: string;

  @ApiProperty({ enum: ASSIGNABLE_ROLE_VALUES, description: 'Role to grant on acceptance.' })
  @IsIn(ASSIGNABLE_ROLE_VALUES)
  role!: StoryRole;
}

/** Text-range anchor for an inline comment. */
export class CommentAnchorDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  from!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  to!: number;

  @ApiPropertyOptional({ description: 'The quoted text at the anchor (display aid).' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  quote?: string;
}

/** Create a story-level or inline comment. */
export class CreateCommentDto {
  @ApiProperty({ maxLength: MAX_COMMENT_BODY_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_COMMENT_BODY_LENGTH)
  body!: string;

  @ApiPropertyOptional({ enum: Object.values(CommentKind), default: CommentKind.General })
  @IsOptional()
  @IsIn(Object.values(CommentKind))
  kind?: CommentKind;

  @ApiPropertyOptional({ type: CommentAnchorDto, description: 'Required for an inline comment.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CommentAnchorDto)
  anchor?: CommentAnchorDto;

  @ApiPropertyOptional({ type: [String], description: 'Resolved @mentioned user ids.' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  mentions?: string[];
}

/** Reply to a comment thread. */
export class CreateReplyDto {
  @ApiProperty({ maxLength: MAX_COMMENT_BODY_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_COMMENT_BODY_LENGTH)
  body!: string;

  @ApiPropertyOptional({ type: [String], description: 'Resolved @mentioned user ids.' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  mentions?: string[];
}

/** Text-range anchor for a suggestion. */
export class SuggestionAnchorDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  from!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  to!: number;
}

/** Propose an edit to a story's text. */
export class CreateSuggestionDto {
  @ApiProperty({ type: SuggestionAnchorDto })
  @ValidateNested()
  @Type(() => SuggestionAnchorDto)
  anchor!: SuggestionAnchorDto;

  @ApiProperty({
    maxLength: MAX_SUGGESTION_LENGTH,
    description: 'The current text being replaced.',
  })
  @IsString()
  @MaxLength(MAX_SUGGESTION_LENGTH)
  originalText!: string;

  @ApiProperty({ maxLength: MAX_SUGGESTION_LENGTH, description: 'The proposed replacement text.' })
  @IsString()
  @MaxLength(MAX_SUGGESTION_LENGTH)
  suggestedText!: string;
}

/** Presence heartbeat — the collaborator's current workspace state. */
export class PresenceHeartbeatDto {
  @ApiProperty({ enum: Object.values(PresenceState), default: PresenceState.Active })
  @IsIn(Object.values(PresenceState))
  state!: PresenceState;
}
