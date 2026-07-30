import type { AiProvider } from '@qalam/shared';

import type {
  ProviderCompletionRequest,
  ProviderCompletionResult,
  ProviderStreamChunk,
} from './provider.types';

/**
 * THE provider abstraction (AF1). Every provider — OpenAI, Anthropic, Google,
 * and the reserved extension points (Azure/Ollama/OpenRouter/LM Studio/self-
 * hosted) — implements this one port. Business logic (the completion
 * orchestrator, conversations, features) depends ONLY on this interface and is
 * therefore provider-independent: swapping providers is a config change, and
 * adding a provider is a new adapter class with zero changes above this line.
 *
 * Adapters are thin HTTP clients over each vendor's REST API (no vendor SDK is
 * imported anywhere — the "never depend on a provider SDK" rule is satisfied by
 * construction).
 */
export interface AiProviderAdapter {
  /** Which provider this adapter serves. */
  readonly provider: AiProvider;

  /** True when credentials are present so a real call can succeed. */
  isConfigured(): boolean;

  /** One-shot completion (buffers the full response). */
  complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult>;

  /**
   * Streamed completion — yields text deltas as they arrive, then a terminal
   * chunk carrying finishReason + usage. Honors `request.signal` for
   * cancellation/timeout (stops reading and releases the connection).
   */
  stream(request: ProviderCompletionRequest): AsyncIterable<ProviderStreamChunk>;
}

/**
 * Multi-provider DI token: every adapter is registered under this token so the
 * {@link ProviderRegistryService} receives them as an array and indexes them by
 * `provider`. A new adapter just adds itself to the module's providers list.
 */
export const AI_PROVIDER_ADAPTERS = Symbol('AI_PROVIDER_ADAPTERS');
