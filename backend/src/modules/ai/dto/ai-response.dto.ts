import { ApiProperty } from '@nestjs/swagger';
import {
  AiConversationStatus,
  AiFeature,
  AiFinishReason,
  AiMessageRole,
  AiModelAvailability,
  AiModelCapability,
  AiProvider,
  PromptCategory,
} from '@qalam/shared';
import type { AiGenerationParams, AiModelMetadata, AiTokenUsage } from '@qalam/shared';

/** Registry model row (client view). */
export class AiModelDto implements AiModelMetadata {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: AiProvider }) provider!: AiProvider;
  @ApiProperty() displayName!: string;
  @ApiProperty() contextWindow!: number;
  @ApiProperty() maxOutputTokens!: number;
  @ApiProperty({ enum: AiModelCapability, isArray: true }) capabilities!: AiModelCapability[];
  @ApiProperty() supportsStreaming!: boolean;
  @ApiProperty() supportsVision!: boolean;
  @ApiProperty() supportsJsonMode!: boolean;
  @ApiProperty() inputCostPerMillion!: number;
  @ApiProperty() outputCostPerMillion!: number;
  @ApiProperty({ enum: AiModelAvailability }) availability!: AiModelAvailability;
  @ApiProperty() isDefault!: boolean;
}

/** A provider as the admin sees it (never includes the API key). */
export class AiProviderInfoDto {
  @ApiProperty({ enum: AiProvider }) provider!: AiProvider;
  @ApiProperty() displayName!: string;
  @ApiProperty() configured!: boolean;
  @ApiProperty() implemented!: boolean;
  @ApiProperty({ type: [AiModelDto] }) models!: AiModelDto[];
}

/** Token usage sub-object. */
export class AiTokenUsageDto implements AiTokenUsage {
  @ApiProperty() inputTokens!: number;
  @ApiProperty() outputTokens!: number;
  @ApiProperty() totalTokens!: number;
}

/** Per-feature flag state. */
export class AiFeatureFlagInfoDto {
  @ApiProperty({ enum: AiFeature }) feature!: AiFeature;
  @ApiProperty() flagKey!: string;
  @ApiProperty() enabled!: boolean;
}

/** `GET /ai/features`. */
export class AiFeaturesResponseDto {
  @ApiProperty() aiEnabled!: boolean;
  @ApiProperty({ type: [AiFeatureFlagInfoDto] }) features!: AiFeatureFlagInfoDto[];
}

/** Generation params (response view). */
export class AiParamsDto {
  @ApiProperty() temperature!: number;
  @ApiProperty() topP!: number;
  @ApiProperty() maxTokens!: number;
  @ApiProperty() frequencyPenalty!: number;
  @ApiProperty() presencePenalty!: number;
  @ApiProperty({ type: [String] }) stop!: string[];
}

/** Effective (resolved) config. */
export class AiResolvedConfigDto {
  @ApiProperty({ enum: AiProvider }) provider!: AiProvider;
  @ApiProperty() model!: string;
  @ApiProperty({ type: AiParamsDto }) params!: AiParamsDto;
  @ApiProperty() streaming!: boolean;
  @ApiProperty({ type: Object }) safety!: Record<string, unknown>;
}

/** Org defaults (response). */
export class AiOrgDefaultsDto {
  @ApiProperty({ enum: AiProvider }) provider!: AiProvider;
  @ApiProperty() model!: string;
  @ApiProperty({ type: Object }) params!: AiGenerationParams;
  @ApiProperty() streaming!: boolean;
  @ApiProperty({ type: Object }) safety!: Record<string, unknown>;
}

/** User overrides (response). */
export class AiUserOverridesDto {
  @ApiProperty({ enum: AiProvider, required: false }) provider?: AiProvider;
  @ApiProperty({ required: false }) model?: string;
  @ApiProperty({ type: Object, required: false }) params?: AiGenerationParams;
  @ApiProperty({ required: false }) streaming?: boolean;
}

/** `GET /ai/config`. */
export class AiConfigResponseDto {
  @ApiProperty({ type: AiResolvedConfigDto }) resolved!: AiResolvedConfigDto;
  @ApiProperty({ type: AiOrgDefaultsDto }) orgDefaults!: AiOrgDefaultsDto;
  @ApiProperty({ type: AiUserOverridesDto }) userOverrides!: AiUserOverridesDto;
}

/** One stored message. */
export class AiMessageDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: AiMessageRole }) role!: AiMessageRole;
  @ApiProperty() content!: string;
  @ApiProperty({ type: AiTokenUsageDto, nullable: true }) usage!: AiTokenUsage | null;
  @ApiProperty() createdAt!: string;
}

/** Conversation list-row. */
export class AiConversationSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true }) title!: string | null;
  @ApiProperty({ enum: AiFeature }) feature!: AiFeature;
  @ApiProperty({ enum: AiConversationStatus }) status!: AiConversationStatus;
  @ApiProperty() messageCount!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

/** Full conversation with messages. */
export class AiConversationDetailDto extends AiConversationSummaryDto {
  @ApiProperty({ type: [AiMessageDto] }) messages!: AiMessageDto[];
}

/** `POST /ai/completions` (non-streaming). */
export class AiCompletionResponseDto {
  @ApiProperty({ nullable: true }) conversationId!: string | null;
  @ApiProperty({ type: AiMessageDto }) message!: AiMessageDto;
  @ApiProperty() model!: string;
  @ApiProperty({ enum: AiProvider }) provider!: AiProvider;
  @ApiProperty({ enum: AiFinishReason }) finishReason!: AiFinishReason;
  @ApiProperty({ type: AiTokenUsageDto }) usage!: AiTokenUsageDto;
  @ApiProperty() estimatedCostUsd!: number;
}

/** Usage over a window. */
export class AiUsageWindowSummaryDto {
  @ApiProperty() inputTokens!: number;
  @ApiProperty() outputTokens!: number;
  @ApiProperty() totalTokens!: number;
  @ApiProperty() requests!: number;
  @ApiProperty() estimatedCostUsd!: number;
  @ApiProperty({ nullable: true }) tokenLimit!: number | null;
  @ApiProperty({ nullable: true }) usedFraction!: number | null;
}

/** Per-feature usage row. */
export class AiFeatureUsageDto {
  @ApiProperty({ enum: AiFeature }) feature!: AiFeature;
  @ApiProperty() totalTokens!: number;
  @ApiProperty() requests!: number;
}

/** `GET /ai/usage/me`. */
export class AiUsageResponseDto {
  @ApiProperty({ type: AiUsageWindowSummaryDto }) daily!: AiUsageWindowSummaryDto;
  @ApiProperty({ type: AiUsageWindowSummaryDto }) monthly!: AiUsageWindowSummaryDto;
  @ApiProperty({ type: AiUsageWindowSummaryDto }) total!: AiUsageWindowSummaryDto;
  @ApiProperty({ type: [AiFeatureUsageDto] }) byFeature!: AiFeatureUsageDto[];
}

/** A prompt template version. */
export class AiPromptTemplateDto {
  @ApiProperty() key!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ enum: PromptCategory }) category!: PromptCategory;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [String] }) variables!: string[];
  @ApiProperty() active!: boolean;
  @ApiProperty() updatedAt!: string;
}

/** `POST /admin/ai/prompts/:key/preview`. */
export class AiPromptPreviewResponseDto {
  @ApiProperty() key!: string;
  @ApiProperty() version!: number;
  @ApiProperty() rendered!: string;
  @ApiProperty() estimatedTokens!: number;
}
