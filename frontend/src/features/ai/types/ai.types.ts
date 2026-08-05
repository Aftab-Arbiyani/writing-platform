/**
 * AI wire types (AF1). Re-exported from `@qalam/api-types` (the single wire
 * contract) so this feature imports everything AI-related from one local path —
 * never redefining a shape the backend owns.
 */
export type {
  AiCompletionMessage,
  AiCompletionRequest,
  AiCompletionResponse,
  AiConfigResponse,
  AiConversationDetail,
  AiConversationExport,
  AiConversationExportMessage,
  AiConversationSummary,
  AiFeature,
  AiFeatureFlagInfo,
  AiFeaturesResponse,
  AiFinishReason,
  AiGenerationParams,
  AiMessageDto,
  AiModelInfo,
  AiProvider,
  AiResolvedConfig,
  AiStreamEvent,
  AiTokenUsage,
  AiUsageResponse,
  AiUsageWindowSummary,
  CreateAiConversationRequest,
  UpdateAiUserOverridesRequest,
} from '@qalam/api-types';
