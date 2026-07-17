/**
 * AI platform vocabulary (AF1 — Phase 2 AI foundation).
 *
 * This is the provider-AGNOSTIC domain vocabulary shared by the backend AI
 * module, the React apps, and the Flutter app. Like the rest of `@qalam/shared`
 * it is zero-dependency pure vocabulary: enums (`as const` objects + derived
 * union types — JSON-safe wire strings), the shapes that cross the wire, and
 * pure helpers. No provider SDK type ever leaks in here (ADR: application code
 * never depends on a provider SDK); adapters translate provider payloads into
 * these shapes at the backend edge.
 *
 * Specific model data (the catalogue of gpt/claude/gemini models with their live
 * costs + availability) is NOT here — that is backend seed data + admin-editable
 * rows (mirrors the settings catalogue pattern). Only the TYPES live here.
 */

/**
 * AI providers. The first three ship real adapters in AF1; the rest are
 * reserved extension points (config may reference them, adapters land later)
 * so adding one is "a new adapter class", never a schema or contract change.
 */
export const AiProvider = {
  OpenAI: 'openai',
  Anthropic: 'anthropic',
  Google: 'google',
  // ── Extension points (no adapter yet — reserved so config/model rows validate).
  AzureOpenAI: 'azure_openai',
  Ollama: 'ollama',
  OpenRouter: 'openrouter',
  LmStudio: 'lm_studio',
  SelfHosted: 'self_hosted',
} as const;
export type AiProvider = (typeof AiProvider)[keyof typeof AiProvider];

/** Provider adapters shipped in AF1 (have a working implementation). */
export const IMPLEMENTED_AI_PROVIDERS: readonly AiProvider[] = [
  AiProvider.OpenAI,
  AiProvider.Anthropic,
  AiProvider.Google,
];

/**
 * A model capability. Booleans on {@link AiModelMetadata} cover the common
 * gates (streaming/vision/json); the capability set carries the open-ended list
 * so a new capability (e.g. `embedding`, `tool_use`) never needs a new column.
 */
export const AiModelCapability = {
  Text: 'text',
  Vision: 'vision',
  Streaming: 'streaming',
  JsonMode: 'json_mode',
  ToolUse: 'tool_use',
  Embedding: 'embedding',
} as const;
export type AiModelCapability = (typeof AiModelCapability)[keyof typeof AiModelCapability];

/** Model availability lifecycle (admin-editable; drives model selection). */
export const AiModelAvailability = {
  Available: 'available',
  Preview: 'preview',
  Deprecated: 'deprecated',
  Disabled: 'disabled',
} as const;
export type AiModelAvailability = (typeof AiModelAvailability)[keyof typeof AiModelAvailability];

/**
 * The catalogue of AI FEATURES the platform will eventually expose. AF1 builds
 * NONE of them — this enum exists so (a) usage is attributed per feature from
 * day one, (b) feature flags are keyed off it, and (c) future features slot in
 * without a contract change. `playground` is the infra's own generic surface
 * (prompt testing / preview) so the foundation is usable without any product
 * feature turned on.
 */
export const AiFeature = {
  Grammar: 'grammar',
  Rewrite: 'rewrite',
  Summarization: 'summarization',
  CraftCoach: 'craft_coach',
  CharacterAnalysis: 'character_analysis',
  PlotAnalysis: 'plot_analysis',
  SemanticSearch: 'semantic_search',
  Recommendations: 'recommendations',
  Moderation: 'moderation',
  // Reserved future features (no flag seeded until scoped; here for usage + config).
  Expand: 'expand',
  Shorten: 'shorten',
  TitleSuggestions: 'title_suggestions',
  Synopsis: 'synopsis',
  VoiceDictation: 'voice_dictation',
  ImageGeneration: 'image_generation',
  // Infra-level generic surface (prompt testing / preview / raw completion).
  Playground: 'playground',
} as const;
export type AiFeature = (typeof AiFeature)[keyof typeof AiFeature];

/**
 * Features that get a seeded feature flag in AF1 (the brief's named set). The
 * backend seeds `feature.ai.<camel>.enabled` (disabled) for each so they are
 * dark-launchable the moment their code lands — see {@link aiFeatureFlagKey}.
 */
export const FLAGGED_AI_FEATURES: readonly AiFeature[] = [
  AiFeature.Grammar,
  AiFeature.Rewrite,
  AiFeature.Summarization,
  AiFeature.CraftCoach,
  AiFeature.CharacterAnalysis,
  AiFeature.PlotAnalysis,
  AiFeature.SemanticSearch,
  AiFeature.Recommendations,
  AiFeature.Moderation,
];

/** Master AI feature-flag key (already seeded pre-AF1). */
export const AI_MASTER_FLAG_KEY = 'feature.ai.enabled';

/**
 * Feature-flag key for a given AI feature, `feature.ai.<camelCase>.enabled`
 * (matching the existing catalogue's camelCase multiword keys). Pure +
 * deterministic so the backend catalogue seed and any client gate agree.
 */
export function aiFeatureFlagKey(feature: AiFeature): string {
  const camel = feature.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
  return `feature.ai.${camel}.enabled`;
}

/** Prompt-template category — groups templates in the registry. Open-ended set. */
export const PromptCategory = {
  Writing: 'writing',
  Analysis: 'analysis',
  Generation: 'generation',
  Moderation: 'moderation',
  Conversation: 'conversation',
  System: 'system',
} as const;
export type PromptCategory = (typeof PromptCategory)[keyof typeof PromptCategory];

/** Chat message role (provider-agnostic). `tool` reserved for future tool-use. */
export const AiMessageRole = {
  System: 'system',
  User: 'user',
  Assistant: 'assistant',
  Tool: 'tool',
} as const;
export type AiMessageRole = (typeof AiMessageRole)[keyof typeof AiMessageRole];

/** Conversation lifecycle (soft-delete tombstone = excluded, never returned). */
export const AiConversationStatus = {
  Active: 'active',
  Archived: 'archived',
} as const;
export type AiConversationStatus = (typeof AiConversationStatus)[keyof typeof AiConversationStatus];

/**
 * Server-sent stream event kinds (the provider-independent streaming protocol).
 * `start` opens with metadata, `delta` carries a text chunk, `progress` a
 * non-text progress signal, `error` a terminal failure (`code` from
 * ERROR_CODES), `done` closes with the final usage + finish reason.
 */
export const AiStreamEventType = {
  Start: 'start',
  Delta: 'delta',
  Progress: 'progress',
  Error: 'error',
  Done: 'done',
} as const;
export type AiStreamEventType = (typeof AiStreamEventType)[keyof typeof AiStreamEventType];

/** Why a generation stopped (normalized across providers). */
export const AiFinishReason = {
  Stop: 'stop',
  Length: 'length',
  ContentFilter: 'content_filter',
  ToolCalls: 'tool_calls',
  Cancelled: 'cancelled',
  Error: 'error',
} as const;
export type AiFinishReason = (typeof AiFinishReason)[keyof typeof AiFinishReason];

/** Aggregation window for usage accounting + limit checks. */
export const AiUsageWindow = {
  Daily: 'daily',
  Monthly: 'monthly',
  Total: 'total',
} as const;
export type AiUsageWindow = (typeof AiUsageWindow)[keyof typeof AiUsageWindow];

/**
 * Safety pipeline stages (hook points). AF1 ships the HOOKS + a permissive
 * default at each stage; it deliberately implements NO moderation POLICY — a
 * later moderation feature registers real logic behind these stages.
 */
export const AiSafetyStage = {
  InputValidation: 'input_validation',
  InputSanitization: 'input_sanitization',
  PromptValidation: 'prompt_validation',
  OutputValidation: 'output_validation',
  AbuseDetection: 'abuse_detection',
  Moderation: 'moderation',
  RateLimit: 'rate_limit',
} as const;
export type AiSafetyStage = (typeof AiSafetyStage)[keyof typeof AiSafetyStage];

/** A safety hook's verdict on an input/output. */
export const AiSafetyVerdict = {
  Allow: 'allow',
  Flag: 'flag',
  Block: 'block',
} as const;
export type AiSafetyVerdict = (typeof AiSafetyVerdict)[keyof typeof AiSafetyVerdict];

// ── Wire shapes ─────────────────────────────────────────────────────────────

/**
 * Tunable generation parameters (the AI-configuration knobs). All optional so a
 * partial override merges cleanly over org defaults; the resolver clamps each to
 * {@link AI_PARAM_BOUNDS} before a call.
 */
export interface AiGenerationParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  /** Up to a few stop sequences. */
  stop?: string[];
}

/** Inclusive bounds every generation parameter is clamped to (defensive). */
export const AI_PARAM_BOUNDS = {
  temperature: { min: 0, max: 2 },
  topP: { min: 0, max: 1 },
  maxTokens: { min: 1, max: 32768 },
  frequencyPenalty: { min: -2, max: 2 },
  presencePenalty: { min: -2, max: 2 },
  maxStopSequences: 4,
} as const;

/** Platform-wide default generation parameters (org defaults start here). */
export const AI_GENERATION_DEFAULTS: Required<Omit<AiGenerationParams, 'stop'>> & {
  stop: string[];
} = {
  temperature: 0.7,
  topP: 1,
  maxTokens: 1024,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stop: [],
};

/**
 * A registered model's metadata (the client-facing shape of a registry row).
 * `id` is the provider-native model id (e.g. `gpt-4o-mini`), unique per provider.
 */
export interface AiModelMetadata {
  id: string;
  provider: AiProvider;
  displayName: string;
  /** Max total tokens (input + output) the model accepts. */
  contextWindow: number;
  /** Max tokens the model may generate in one response. */
  maxOutputTokens: number;
  capabilities: AiModelCapability[];
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsJsonMode: boolean;
  /** USD per 1,000,000 input tokens. */
  inputCostPerMillion: number;
  /** USD per 1,000,000 output tokens. */
  outputCostPerMillion: number;
  availability: AiModelAvailability;
  /** True for the provider's default model (one per provider). */
  isDefault: boolean;
}

/** Token counts for one call (normalized across providers). */
export interface AiTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * The effective AI configuration for a call, after merging org defaults with the
 * user's overrides (and clamping). This is what the orchestrator hands the
 * provider adapter — never a provider-specific config object.
 */
export interface AiResolvedConfig {
  provider: AiProvider;
  model: string;
  params: Required<Omit<AiGenerationParams, 'stop'>> & { stop: string[] };
  streaming: boolean;
  /** Opaque, provider-agnostic safety knobs (e.g. block thresholds). */
  safety: Record<string, unknown>;
}

/**
 * Estimated USD cost of a call from its token usage and the model's rates. Pure;
 * shared so the backend accountant and any client-side estimate never diverge.
 */
export function estimateAiCostUsd(
  usage: AiTokenUsage,
  rates: Pick<AiModelMetadata, 'inputCostPerMillion' | 'outputCostPerMillion'>,
): number {
  const cost =
    (usage.inputTokens / 1_000_000) * rates.inputCostPerMillion +
    (usage.outputTokens / 1_000_000) * rates.outputCostPerMillion;
  // 6 dp is sub-cent precision — fine for per-call rows; sums stay exact enough.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Clamp a number into an inclusive range (helper for the config resolver). */
export function clampAiParam(value: number, bounds: { min: number; max: number }): number {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}
