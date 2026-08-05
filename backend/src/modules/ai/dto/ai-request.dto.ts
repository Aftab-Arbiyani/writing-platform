import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AI_CONVERSATION_TITLE_MAX,
  AI_MESSAGE_MAX_LENGTH,
  AI_PARAM_BOUNDS,
  AiConversationStatus,
  AiFeature,
  AiMessageRole,
  AiProvider,
} from '@qalam/shared';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Tunable generation params (all optional; clamped server-side too). */
export class AiGenerationParamsDto {
  @ApiPropertyOptional({
    minimum: AI_PARAM_BOUNDS.temperature.min,
    maximum: AI_PARAM_BOUNDS.temperature.max,
  })
  @IsOptional()
  @IsNumber()
  @Min(AI_PARAM_BOUNDS.temperature.min)
  @Max(AI_PARAM_BOUNDS.temperature.max)
  temperature?: number;

  @ApiPropertyOptional({ minimum: AI_PARAM_BOUNDS.topP.min, maximum: AI_PARAM_BOUNDS.topP.max })
  @IsOptional()
  @IsNumber()
  @Min(AI_PARAM_BOUNDS.topP.min)
  @Max(AI_PARAM_BOUNDS.topP.max)
  topP?: number;

  @ApiPropertyOptional({
    minimum: AI_PARAM_BOUNDS.maxTokens.min,
    maximum: AI_PARAM_BOUNDS.maxTokens.max,
  })
  @IsOptional()
  @IsInt()
  @Min(AI_PARAM_BOUNDS.maxTokens.min)
  @Max(AI_PARAM_BOUNDS.maxTokens.max)
  maxTokens?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(AI_PARAM_BOUNDS.frequencyPenalty.min)
  @Max(AI_PARAM_BOUNDS.frequencyPenalty.max)
  frequencyPenalty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(AI_PARAM_BOUNDS.presencePenalty.min)
  @Max(AI_PARAM_BOUNDS.presencePenalty.max)
  presencePenalty?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stop?: string[];
}

/** One chat message on a completion request. */
export class AiCompletionMessageDto {
  @ApiProperty({ enum: AiMessageRole })
  @IsEnum(AiMessageRole)
  role!: AiMessageRole;

  @ApiProperty({ maxLength: AI_MESSAGE_MAX_LENGTH })
  @IsString()
  @MaxLength(AI_MESSAGE_MAX_LENGTH)
  content!: string;
}

/** A named context request the server resolves via a context provider. */
export class AiContextRequestDto {
  @ApiProperty()
  @IsString()
  @MaxLength(60)
  type!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

/** `POST /ai/completions` (and `/stream`). */
export class AiCompletionRequestDto {
  @ApiProperty({ enum: AiFeature })
  @IsEnum(AiFeature)
  feature!: AiFeature;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  promptKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  promptVersion?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  promptVariables?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [AiCompletionMessageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiCompletionMessageDto)
  messages?: AiCompletionMessageDto[];

  @ApiPropertyOptional({ type: [AiContextRequestDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiContextRequestDto)
  context?: AiContextRequestDto[];

  @ApiPropertyOptional({ type: AiGenerationParamsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiGenerationParamsDto)
  params?: AiGenerationParamsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  jsonMode?: boolean;
}

/** `POST /ai/conversations`. */
export class CreateAiConversationDto {
  @ApiProperty({ enum: AiFeature })
  @IsEnum(AiFeature)
  feature!: AiFeature;

  @ApiPropertyOptional({ maxLength: AI_CONVERSATION_TITLE_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(AI_CONVERSATION_TITLE_MAX)
  title?: string;
}

/** `PATCH /ai/conversations/:id`. */
export class UpdateAiConversationDto {
  @ApiPropertyOptional({ maxLength: AI_CONVERSATION_TITLE_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(AI_CONVERSATION_TITLE_MAX)
  title?: string;

  @ApiPropertyOptional({ enum: AiConversationStatus })
  @IsOptional()
  @IsEnum(AiConversationStatus)
  status?: AiConversationStatus;
}

/** `PATCH /ai/config` — a user's own overrides. */
export class UpdateAiUserOverridesDto {
  @ApiPropertyOptional({ enum: AiProvider })
  @IsOptional()
  @IsEnum(AiProvider)
  provider?: AiProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @ApiPropertyOptional({ type: AiGenerationParamsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiGenerationParamsDto)
  params?: AiGenerationParamsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  streaming?: boolean;
}

/** `PUT /admin/ai/config` — org defaults (admin). */
export class UpdateAiOrgDefaultsDto {
  @ApiProperty({ enum: AiProvider })
  @IsEnum(AiProvider)
  provider!: AiProvider;

  @ApiProperty({ description: 'Blank => registry default model for the provider.' })
  @IsString()
  @MaxLength(120)
  model!: string;

  @ApiProperty({ type: AiGenerationParamsDto })
  @ValidateNested()
  @Type(() => AiGenerationParamsDto)
  params!: AiGenerationParamsDto;

  @ApiProperty()
  @IsBoolean()
  streaming!: boolean;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  safety?: Record<string, unknown>;
}

/** `GET /ai/conversations` query. */
export class ConversationListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ enum: AiConversationStatus })
  @IsOptional()
  @IsEnum(AiConversationStatus)
  status?: AiConversationStatus;
}

/** `POST /admin/ai/prompts/:key/preview`. */
export class AiPromptPreviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiProperty({ type: Object })
  @IsObject()
  variables!: Record<string, unknown>;
}
