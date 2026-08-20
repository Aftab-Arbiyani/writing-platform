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
  /**
   * AI is usable by this caller: the platform master flag AND their own B5 switch.
   * When `false`, every entry in `features` is `false` too — this is the one value a
   * client needs in order to hide its AI affordances.
   */
  @ApiProperty() aiEnabled!: boolean;

  /**
   * B5 (docs/45 §4.10) — the caller's OWN "turn AI off" switch, reported separately so
   * a client can tell the two causes of `aiEnabled: false` apart and offer the right
   * remedy: "you turned AI off — turn it back on in settings" versus an administrator's
   * platform switch, which the reader cannot do anything about. Precedence is
   * admin-off-beats-user-on, so `userAiEnabled: true` with `aiEnabled: false` simply
   * means the platform flag is down.
   */
  @ApiProperty({ description: 'Whether the caller has AI turned on for their own account.' })
  userAiEnabled!: boolean;

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

/**
 * One message inside an export document — **deliberately not `AiMessageDto`** (docs/48 §3.12, W8-3).
 *
 * The export omits `id` and flattens token usage to a single nullable number, so the same
 * conversation publishes its messages in two shapes depending on the route. That asymmetry is kept,
 * not repaired: the export is a portable document a reader saves, where a server-side message id is
 * noise and `{inputTokens, outputTokens, totalTokens}` is more structure than the document needs;
 * and `GET :id/export` has shipped on both clients, so aligning it would break a payload in the
 * field to satisfy a symmetry nothing asked for. Mobile decodes it as opaque JSON
 * (`ai_remote_data_source.dart:131-135`) and web types it separately.
 *
 * What was actually wrong was that the shape existed **only inside a service method** — the route
 * returned `Record<string, unknown>`, so Swagger recorded nothing, `@qalam/api-types` carried a
 * hand-written mirror, and the §3.11 contract guard had to excuse both as UNMIRRORED. Declared here,
 * the second shape is a contract instead of an accident, and the guard pins it like any other.
 */
export class AiConversationExportMessageDto {
  @ApiProperty({ enum: AiMessageRole }) role!: AiMessageRole;
  @ApiProperty() content!: string;
  /** Flat and nullable, unlike `AiMessageDto.usage` — see the class note. */
  @ApiProperty({ nullable: true, type: Number }) totalTokens!: number | null;
  @ApiProperty() createdAt!: string;
}

/** `GET /ai/conversations/:id/export` — the portable JSON document (W8-3 / W8-4). */
export class AiConversationExportDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: AiFeature }) feature!: AiFeature;
  @ApiProperty({ nullable: true, type: String }) title!: string | null;
  @ApiProperty({ enum: AiConversationStatus }) status!: AiConversationStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty({ type: [AiConversationExportMessageDto] })
  messages!: AiConversationExportMessageDto[];
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
