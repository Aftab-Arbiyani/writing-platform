/**
 * AI platform wire contract (AF1) — the request/response shapes the React apps
 * and Flutter consume over `/api/v1/ai/*` and `/api/v1/admin/ai/*`.
 *
 * The provider-agnostic VOCABULARY (enums, `AiModelMetadata`, `AiGenerationParams`,
 * `AiResolvedConfig`, cost helper) lives in `@qalam/shared` and is re-exported
 * here so a client imports everything AI-wire-related from one package — never
 * duplicating the shapes. This file adds only the DTO envelopes that are specific
 * to the HTTP surface. These are handwritten until the backend emits `openapi.json`
 * and the generated types supersede them (same policy as `./manual`).
 */
export type {
  AiConversationStatus,
  AiFeature,
  AiFinishReason,
  AiGenerationParams,
  AiMessageRole,
  AiModelAvailability,
  AiModelCapability,
  AiModelMetadata,
  AiProvider,
  AiResolvedConfig,
  AiSafetyStage,
  AiSafetyVerdict,
  AiStreamEventType,
  AiTokenUsage,
  AiUsageWindow,
  PromptCategory,
} from '@qalam/shared';

import type {
  AiConversationStatus,
  AiFeature,
  AiFinishReason,
  AiGenerationParams,
  AiMessageRole,
  AiModelMetadata,
  AiProvider,
  AiResolvedConfig,
  AiStreamEventType,
  AiTokenUsage,
  PromptCategory,
} from '@qalam/shared';

// ── Registry ────────────────────────────────────────────────────────────────

/** A configured provider as the admin sees it (never includes the API key). */
export interface AiProviderInfo {
  provider: AiProvider;
  displayName: string;
  /** Whether credentials are present so the provider can actually be called. */
  configured: boolean;
  /** Whether an adapter implementation ships for this provider. */
  implemented: boolean;
  /** Registered models offered by this provider. */
  models: AiModelMetadata[];
}

/** A single registry model row (client view of `AiModelMetadata`). */
export type AiModelInfo = AiModelMetadata;

// ── Configuration ─────────────────────────────────────────────────────────────

/** Org-wide defaults (admin-owned) — the baseline every call inherits. */
export interface AiOrgDefaults {
  provider: AiProvider;
  model: string;
  params: AiGenerationParams;
  streaming: boolean;
  safety: Record<string, unknown>;
}

/** A user's overrides (may be partial; unset fields fall back to org defaults). */
export interface AiUserOverrides {
  provider?: AiProvider;
  model?: string;
  params?: AiGenerationParams;
  streaming?: boolean;
}

/** `GET /ai/config` — the caller's effective config plus its sources. */
export interface AiConfigResponse {
  resolved: AiResolvedConfig;
  orgDefaults: AiOrgDefaults;
  userOverrides: AiUserOverrides;
}

/** `PATCH /ai/config` — a user upserting their overrides. */
export type UpdateAiUserOverridesRequest = AiUserOverrides;

/** `PUT /admin/ai/config` — an admin replacing the org defaults. */
export type UpdateAiOrgDefaultsRequest = AiOrgDefaults;

// ── Feature flags ─────────────────────────────────────────────────────────────

/** A per-feature AI flag's effective state for the caller. */
export interface AiFeatureFlagInfo {
  feature: AiFeature;
  flagKey: string;
  enabled: boolean;
}

/** `GET /ai/features` — which AI features are on for the caller. */
export interface AiFeaturesResponse {
  /** Master switch (`feature.ai.enabled`) AND the caller's own B5 switch. */
  aiEnabled: boolean;
  /**
   * B5 (docs/45 §4.10) — the caller's OWN "turn AI off" preference, so a client can
   * distinguish "you turned AI off" (remedy: settings) from an administrator's
   * platform switch (remedy: none). Precedence is admin-off-beats-user-on.
   */
  userAiEnabled: boolean;
  features: AiFeatureFlagInfo[];
}

// ── Prompts ───────────────────────────────────────────────────────────────────

/** A prompt template (a specific version) as clients/admin see it. */
export interface AiPromptTemplateInfo {
  key: string;
  version: number;
  category: PromptCategory;
  description: string;
  /** Declared variables the template expects. */
  variables: string[];
  /** Whether this is the active version for its key. */
  active: boolean;
  updatedAt: string;
}

/** `POST /admin/ai/prompts/:key/preview` — render a template with sample vars. */
export interface AiPromptPreviewRequest {
  version?: number;
  variables: Record<string, unknown>;
}

/** Rendered preview result. */
export interface AiPromptPreviewResponse {
  key: string;
  version: number;
  rendered: string;
  /** Estimated token count of the rendered prompt. */
  estimatedTokens: number;
}

// ── Conversations ─────────────────────────────────────────────────────────────

/** One stored message in a conversation. */
export interface AiMessageDto {
  id: string;
  role: AiMessageRole;
  content: string;
  /** Token usage for assistant messages (null for user/system). */
  usage: AiTokenUsage | null;
  createdAt: string;
}

/** Conversation list-row (no messages). */
export interface AiConversationSummary {
  id: string;
  title: string | null;
  feature: AiFeature;
  status: AiConversationStatus;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Full conversation with its message history. */
export interface AiConversationDetail extends AiConversationSummary {
  messages: AiMessageDto[];
}

/** `POST /ai/conversations` — start a conversation. */
export interface CreateAiConversationRequest {
  feature: AiFeature;
  title?: string;
}

/**
 * `PATCH /ai/conversations/:id` — rename and/or set lifecycle status.
 *
 * Added by W8 (docs/48 §3.12, W8-4): `UpdateAiConversationDto` has accepted both keys since AF1, but
 * no interface here declared them, so no typed client had a type for the body. Same direction as
 * `CreateSubscriptionRequest.region` and `jsonMode` — a shipped capability invisible to consumers
 * rather than a break.
 *
 * Note what `status: 'archived'` does and does not do: it persists, and it does **not** hide the
 * conversation, because the list query has no status predicate (W8-2). Do not build an archive
 * affordance on this until that is fixed.
 */
export interface UpdateAiConversationRequest {
  title?: string;
  status?: AiConversationStatus;
}

/**
 * One message inside an export document. NOT `AiMessageDto`: the export route builds its own shape
 * (`conversation.service.ts:134-139`) with no `id` and token usage flattened to one nullable number
 * (docs/48 §3.12, W8-3).
 */
export interface AiConversationExportMessage {
  role: AiMessageRole;
  content: string;
  totalTokens: number | null;
  createdAt: string;
}

/**
 * `GET /ai/conversations/:id/export` — the portable JSON document.
 *
 * Hand-written from `conversation.service.ts:127-140` because the handler returns
 * `Promise<Record<string, unknown>>`, so there is no DTO for the §3.11 guard to pin this against.
 */
export interface AiConversationExport {
  id: string;
  feature: AiFeature;
  title: string | null;
  status: AiConversationStatus;
  createdAt: string;
  updatedAt: string;
  messages: AiConversationExportMessage[];
}

// ── Completion / streaming ────────────────────────────────────────────────────

/** A caller-supplied message on a completion request. */
export interface AiCompletionMessage {
  role: AiMessageRole;
  content: string;
}

/**
 * `POST /ai/completions` (or `/ai/completions/stream`) — a generation request.
 * Callers reference a prompt template by key OR pass raw messages; context is
 * assembled server-side from the named context requests. API keys never appear
 * here — the client never talks to a provider.
 */
export interface AiCompletionRequest {
  feature: AiFeature;
  /** Continue an existing conversation (optional). */
  conversationId?: string;
  /** Prompt template to render as the system/instruction prompt (optional). */
  promptKey?: string;
  promptVersion?: number;
  /** Variables for the prompt template. */
  promptVariables?: Record<string, unknown>;
  /** Raw chat messages (used when not driving purely from a template). */
  messages?: AiCompletionMessage[];
  /** Named context requests the server resolves into the prompt (see context builders). */
  context?: Array<{ type: string; params?: Record<string, unknown> }>;
  /** Per-call overrides on top of resolved config (clamped server-side). */
  params?: AiGenerationParams;
  /**
   * Ask the provider for a JSON-only response.
   *
   * Found by `api-types.contract.spec.ts` on its first run (docs/48 §3.11): `AiCompletionRequestDto`
   * has accepted it since AF1 and it runs all the way through — controller → `ai-completion.service`
   * → the OpenAI/Gemini/stub adapters, which reject it with a clear error when the model does not
   * support it. Only this interface never mentioned it, so no typed client could reach a shipped
   * capability. Same direction as `CreateSubscriptionRequest.region` (W4-2's sweep): invisible rather
   * than breaking, and the same root cause.
   */
  jsonMode?: boolean;
}

/** Non-streaming completion result. */
export interface AiCompletionResponse {
  conversationId: string | null;
  message: AiMessageDto;
  model: string;
  provider: AiProvider;
  finishReason: AiFinishReason;
  usage: AiTokenUsage;
  estimatedCostUsd: number;
}

/**
 * One Server-Sent Event on the streaming endpoint. The `type` is the SSE
 * `event:` name; this is the `data:` JSON payload. `start` carries model/provider,
 * `delta` a text chunk, `progress` a phase label, `done` the final usage +
 * finish reason, `error` a stable `code` from ERROR_CODES.
 */
export interface AiStreamEvent {
  type: AiStreamEventType;
  /** Present on `delta`. */
  text?: string;
  /** Present on `progress`. */
  phase?: string;
  /** Present on `start`. */
  model?: string;
  provider?: AiProvider;
  conversationId?: string | null;
  /** Present on `done`. */
  finishReason?: AiFinishReason;
  usage?: AiTokenUsage;
  estimatedCostUsd?: number;
  messageId?: string;
  /** Present on `error` — a stable ERROR_CODES string. */
  code?: string;
  message_?: string;
}

// ── Usage / token accounting ──────────────────────────────────────────────────

/** Usage rolled up over a window. */
export interface AiUsageWindowSummary {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  estimatedCostUsd: number;
  /** The configured cap for this window (null = unlimited). */
  tokenLimit: number | null;
  /** Fraction of the cap consumed (0–1; null when unlimited). */
  usedFraction: number | null;
}

/** `GET /ai/usage/me` — the caller's own usage. */
export interface AiUsageResponse {
  daily: AiUsageWindowSummary;
  monthly: AiUsageWindowSummary;
  total: AiUsageWindowSummary;
  /** Per-feature breakdown of lifetime usage. */
  byFeature: Array<{ feature: AiFeature; totalTokens: number; requests: number }>;
}
