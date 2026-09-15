/**
 * AI platform vocabulary (AF1 — Phase 2 AI foundation).
 *
 * This is the provider-AGNOSTIC domain vocabulary shared by the backend AI
 * module, the React apps, and the Flutter app. Like the rest of `@umberleaf/shared`
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

import { PremiumFeature } from './monetization.js';

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
  /**
   * A **test-stack** provider that generates nothing: it streams one fixed passage so the
   * whole AI path (flags → orchestrator → SSE → client accumulation) can be asserted without a
   * vendor credential. Deliberately NOT in {@link IMPLEMENTED_AI_PROVIDERS} — same posture as
   * `PaymentProvider.Manual`, which is likewise absent from its list. Its adapter refuses every
   * call unless `AI_STUB_ENABLED=true`, so no real deployment can reach it.
   */
  Stub: 'stub',
} as const;
export type AiProvider = (typeof AiProvider)[keyof typeof AiProvider];

/**
 * Provider adapters shipped in AF1 (have a working implementation).
 *
 * **Load-bearing since AI-3** (docs/48 §3.22b): admin's AI config Select is built from this list, so
 * an operator can no longer save a provider with no adapter behind it. Before that this export had
 * zero consumers and the picker offered all nine `AiProvider` values.
 *
 * `Stub` is excluded even though it has an adapter — see its note above; it is a test-stack path and
 * offering it in a production admin UI is how every writer's suggestion becomes the same paragraph.
 * Adding a provider here is what makes it selectable, so add the adapter first.
 */
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
 * The AI features the platform actually runs. Usage is attributed per feature
 * (`ai_usage_logs.feature`), feature flags are keyed off it, and `playground` is the
 * infra's own generic surface (prompt testing / preview) so the foundation is usable
 * without any product feature turned on.
 *
 * **D5 shrank this list from twenty values to nine**, and the shape of what went is
 * worth keeping in view. Three kinds of value were removed:
 *
 * - **Never-built reservations** (`expand`, `shorten`, `title_suggestions`, `synopsis`,
 *   `voice_dictation`, `image_generation`) — no caller, no flag, no prompt, no usage row,
 *   in the tree since AF1. They cost a `AI_FEATURE_PREMIUM_CODE` row each and bought
 *   nothing; a feature that does not exist does not need vocabulary.
 * - **Vestigial AF1 codes** (`grammar`, `rewrite`, `summarization`) — mapped to
 *   `ai_writing` for totality but never called. Their real cost was that `ai-quotas.ts`
 *   had to list all three in the Polish rule purely to satisfy `uncountedPaidAiFeatures`.
 * - **The AF4 surfaces** (`semantic_search`, `recommendations`, `ask_book`) — retired as
 *   *AI features* by D5, which is not the same as retired as products. Search and
 *   recommendations still work; they are ordinary product surfaces now, gated by auth
 *   rather than by an AI flag, and they call no model. `ask_book` alone is gone entirely.
 *
 * ⚠️ Historical `ai_usage_logs` rows still carry the removed strings. Nothing renders
 * them through a totality-pinned label map (admin reads the column raw), so a stale row
 * displays its own value rather than breaking — but do not add such a map without
 * deciding what an unrecognised feature should say.
 */
export const AiFeature = {
  // AF2 — the two user-facing writing tools, sold together under `ai_writing`.
  // One flag/feature per tool; a specific action (simplify/condense/improve·aspect)
  // is a prompt-template key, never a distinct feature or flag.
  WritingAssistant: 'writing_assistant',
  CraftCoach: 'craft_coach',
  // AF3 — Story Map analyses. Each maps to a prompt template and folds into the
  // structured story knowledge graph (never plain text). One "Map this story" run
  // spends all five; they share one allowance (see `ai-quotas.ts`).
  CharacterAnalysis: 'character_analysis',
  PlotAnalysis: 'plot_analysis',
  WorldBuilding: 'world_building',
  StyleAnalysis: 'style_analysis',
  StoryTimeline: 'story_timeline',
  // Infrastructure, not a sold capability.
  Moderation: 'moderation',
  Playground: 'playground',
} as const;
export type AiFeature = (typeof AiFeature)[keyof typeof AiFeature];

/**
 * Features that get a seeded feature flag in AF1 (the brief's named set). The
 * backend seeds `feature.ai.<camel>.enabled` (disabled) for each so they are
 * dark-launchable the moment their code lands — see {@link aiFeatureFlagKey}.
 *
 * ⚠️ **Removing an entry here is a BREAKING change for mobile and a no-op for web**, because
 * the two clients disagree about what an absent flag means. Web's `resolveAvailability`
 * looks the flag up and only refuses when it is present-and-false, so a missing flag reads
 * as available; mobile's `AiFeatures.isEnabled` is `features.any(f => f.feature == id &&
 * f.enabled)`, so a missing flag reads as OFF and the surface hides itself.
 *
 * That asymmetry is why D5 removed `SemanticSearch` and `Recommendations` from this list in
 * two steps rather than one. B2 could not drop them: the server had already stopped
 * consulting them, but mobile's search screen still read the flags, so deleting the rows
 * would have taken search dark against a server perfectly willing to answer it — a failure
 * visible only on one client. The client halves closed that door first (web F1 deleted its
 * `useAiAvailability` calls, mobile M2 deleted the ids from `AiFeatureIds` outright), and
 * only then could the rows go. **A flag may leave this list only after every client has
 * stopped reading it — not merely after the server has stopped writing it.**
 */
export const FLAGGED_AI_FEATURES: readonly AiFeature[] = [
  AiFeature.WritingAssistant,
  AiFeature.CraftCoach,
  AiFeature.CharacterAnalysis,
  AiFeature.PlotAnalysis,
  AiFeature.WorldBuilding,
  AiFeature.StyleAnalysis,
  AiFeature.StoryTimeline,
  AiFeature.Moderation,
];

/**
 * Which PREMIUM code (if any) each AI feature is sold under — the one place the
 * answer lives (D3, [45 §4](../../../docs/45_WebClientRoadmap.md) row D3, decided
 * by the owner 2026-08-08: **the free tier gets no AI writing; AI writing is paid**).
 *
 * `Record<AiFeature, …>` is load-bearing and is the totality pin: a value added to
 * {@link AiFeature} without a row here is a COMPILE ERROR, never a silent hole. That
 * direction matters more than it looks — the failure mode this forecloses is a future
 * AI feature shipping ungated because nobody remembered a gate existed. A new feature
 * must *declare* that it is free; it can never default to free by omission.
 *
 * **Where the map stops, and why.** Two features map to `ai_writing` — Polish
 * (`writing_assistant`, whose actions are prompt-template keys, not distinct features)
 * and Manuscript feedback (`craft_coach`). Five map to `story_intelligence` — **D4,
 * decided 2026-08-21** (48 §5.2): the story analyses that fold into a story's knowledge
 * graph, sold as Story Map. `moderation` and `playground` map to `null` because they are
 * infrastructure, not a sold capability.
 *
 * **D5 removed every other row**, and one class of removal is worth naming: the AF4
 * surfaces (`semantic_search`, `recommendations`, `ask_book`) used to sit here as
 * deliberate `null`s, carrying a warning that a client must not gate on them. That
 * warning is now enforced by construction rather than by comment — search and
 * recommendations are no longer AI features at all, so there is no flag and no premium
 * code left for a client to gate on by mistake.
 *
 * A `null` here means "no premium code", NOT "no gating" — the AI feature flag
 * (`aiFeatureFlagKey`) still applies to every feature regardless of this map, and every
 * sold feature additionally spends a per-feature allowance (`ai-quotas.ts`). The old
 * third gate, the `ai_budget` credit balance asserted by the usage meter, is gone: D5
 * removed the credit economy, so a generation now asserts only the code its feature is
 * sold behind.
 */
export const AI_FEATURE_PREMIUM_CODE = {
  // ── Paid: Polish & feedback (D3) ─────────────────────────────────────────────
  [AiFeature.WritingAssistant]: PremiumFeature.AiWriting,
  [AiFeature.CraftCoach]: PremiumFeature.AiWriting,
  // ── Paid: Story Map (D4, decided 2026-08-21) ─────────────────────────────────
  [AiFeature.CharacterAnalysis]: PremiumFeature.StoryIntelligence,
  [AiFeature.PlotAnalysis]: PremiumFeature.StoryIntelligence,
  [AiFeature.WorldBuilding]: PremiumFeature.StoryIntelligence,
  [AiFeature.StyleAnalysis]: PremiumFeature.StoryIntelligence,
  [AiFeature.StoryTimeline]: PremiumFeature.StoryIntelligence,
  // ── Infrastructure ───────────────────────────────────────────────────────────
  [AiFeature.Moderation]: null,
  [AiFeature.Playground]: null,
} satisfies Record<AiFeature, PremiumFeature | null>;

/**
 * The totality test for {@link AI_FEATURE_PREMIUM_CODE}, pinned at COMPILE TIME because
 * `@umberleaf/shared` is pure vocabulary with no test runner — `pnpm typecheck` is its suite.
 *
 * `satisfies` (rather than a `Record<…>` annotation) is what makes this a real test
 * instead of a tautology: it keeps `keyof typeof` as the map's LITERAL keys, so the
 * mutual-extends check below compares the two sets in both directions. A missing feature
 * and a stale key that outlived its `AiFeature` value both fail the build here.
 */
type MutuallyExtends<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

export const AI_FEATURE_PREMIUM_CODE_IS_TOTAL: MutuallyExtends<
  keyof typeof AI_FEATURE_PREMIUM_CODE,
  AiFeature
> = true;

/**
 * The premium code an AI request must be entitled to, or `null` when the feature is
 * not sold behind one. The ONLY correct way to read {@link AI_FEATURE_PREMIUM_CODE} —
 * callers must not index the record directly, so the answer stays in one place.
 */
export function premiumCodeForAiFeature(feature: AiFeature): PremiumFeature | null {
  return AI_FEATURE_PREMIUM_CODE[feature];
}

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
