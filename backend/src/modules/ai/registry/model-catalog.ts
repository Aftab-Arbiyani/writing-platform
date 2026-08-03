import { AiModelAvailability, AiModelCapability, AiProvider } from '@qalam/shared';
import type { AiModelMetadata } from '@qalam/shared';

/**
 * The seed model catalogue (AF1) — the source of truth for which models exist,
 * mirroring the settings catalogue pattern. On boot the registry upserts each
 * entry as an `ai_models` row, preserving any admin overrides. Costs are USD per
 * 1,000,000 tokens and are illustrative seeds (admin-editable); capabilities /
 * context windows follow each vendor's published specs. Exactly one `isDefault`
 * per provider.
 *
 * Adding a model = one entry here + ship. Adding a provider's models works the
 * same way once its adapter exists.
 */
export const AI_MODEL_CATALOG: readonly AiModelMetadata[] = [
  // ── OpenAI ───────────────────────────────────────────────────────────────
  {
    id: 'gpt-4o',
    provider: AiProvider.OpenAI,
    displayName: 'GPT-4o',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    capabilities: [
      AiModelCapability.Text,
      AiModelCapability.Vision,
      AiModelCapability.Streaming,
      AiModelCapability.JsonMode,
      AiModelCapability.ToolUse,
    ],
    supportsStreaming: true,
    supportsVision: true,
    supportsJsonMode: true,
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10,
    availability: AiModelAvailability.Available,
    isDefault: true,
  },
  {
    id: 'gpt-4o-mini',
    provider: AiProvider.OpenAI,
    displayName: 'GPT-4o mini',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    capabilities: [
      AiModelCapability.Text,
      AiModelCapability.Vision,
      AiModelCapability.Streaming,
      AiModelCapability.JsonMode,
    ],
    supportsStreaming: true,
    supportsVision: true,
    supportsJsonMode: true,
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    availability: AiModelAvailability.Available,
    isDefault: false,
  },
  // ── Anthropic ──────────────────────────────────────────────────────────────
  {
    id: 'claude-3-5-sonnet-20241022',
    provider: AiProvider.Anthropic,
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    capabilities: [
      AiModelCapability.Text,
      AiModelCapability.Vision,
      AiModelCapability.Streaming,
      AiModelCapability.ToolUse,
    ],
    supportsStreaming: true,
    supportsVision: true,
    supportsJsonMode: false,
    inputCostPerMillion: 3,
    outputCostPerMillion: 15,
    availability: AiModelAvailability.Available,
    isDefault: true,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    provider: AiProvider.Anthropic,
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    capabilities: [AiModelCapability.Text, AiModelCapability.Streaming],
    supportsStreaming: true,
    supportsVision: false,
    supportsJsonMode: false,
    inputCostPerMillion: 0.8,
    outputCostPerMillion: 4,
    availability: AiModelAvailability.Available,
    isDefault: false,
  },
  // ── Google Gemini ────────────────────────────────────────────────────────
  {
    id: 'gemini-1.5-pro',
    provider: AiProvider.Google,
    displayName: 'Gemini 1.5 Pro',
    contextWindow: 2_000_000,
    maxOutputTokens: 8_192,
    capabilities: [
      AiModelCapability.Text,
      AiModelCapability.Vision,
      AiModelCapability.Streaming,
      AiModelCapability.JsonMode,
    ],
    supportsStreaming: true,
    supportsVision: true,
    supportsJsonMode: true,
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 5,
    availability: AiModelAvailability.Available,
    isDefault: true,
  },
  {
    id: 'gemini-1.5-flash',
    provider: AiProvider.Google,
    displayName: 'Gemini 1.5 Flash',
    contextWindow: 1_000_000,
    maxOutputTokens: 8_192,
    capabilities: [
      AiModelCapability.Text,
      AiModelCapability.Vision,
      AiModelCapability.Streaming,
      AiModelCapability.JsonMode,
    ],
    supportsStreaming: true,
    supportsVision: true,
    supportsJsonMode: true,
    inputCostPerMillion: 0.075,
    outputCostPerMillion: 0.3,
    availability: AiModelAvailability.Available,
    isDefault: false,
  },
  // ── Stub (test stacks only) ──────────────────────────────────────────────
  /**
   * The model the `stub` provider serves (`StubAdapter`). It has to exist here because the registry
   * is what resolves a call's model — `AiConfigService.resolveForUser` asks for the default model of
   * the resolved provider, so a stub provider with no catalogue entry throws `AI_MODEL_NOT_FOUND`
   * before any adapter is reached. Registered unconditionally for the same reason the adapter is:
   * the row is inert unless `AI_STUB_ENABLED=true` makes the provider callable.
   *
   * **Costs are zero and that is deliberate** — no vendor is billed, so a non-zero rate would put
   * invented spend in the usage ledger and the writer's cost figures. Capabilities are declared
   * honestly for what the adapter actually does: streams, answers JSON when asked, no vision.
   */
  {
    id: 'stub-1',
    provider: AiProvider.Stub,
    displayName: 'Stub (no model — fixed text)',
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    capabilities: [AiModelCapability.Text, AiModelCapability.Streaming, AiModelCapability.JsonMode],
    supportsStreaming: true,
    supportsVision: false,
    supportsJsonMode: true,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    availability: AiModelAvailability.Available,
    isDefault: true,
  },
];
