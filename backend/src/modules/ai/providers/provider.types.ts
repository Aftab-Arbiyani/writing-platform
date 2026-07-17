import type { AiFinishReason, AiMessageRole, AiTokenUsage } from '@qalam/shared';

/**
 * The provider-facing types (AF1). These are the ONLY shapes an adapter sees —
 * fully normalized, provider-agnostic. Adapters translate these to/from their
 * vendor's wire format at the HTTP edge; nothing above the adapter layer ever
 * references a vendor payload. Adding a provider = a new adapter that speaks
 * these shapes, nothing else changes.
 */

/** A single normalized chat message handed to a provider. */
export interface ProviderMessage {
  role: AiMessageRole;
  content: string;
}

/**
 * A normalized completion request. Generation params are already resolved +
 * clamped by the config service; `signal` carries cancellation AND timeout (the
 * orchestrator composes an `AbortSignal.timeout` with a manual controller).
 */
export interface ProviderCompletionRequest {
  model: string;
  messages: ProviderMessage[];
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stop: string[];
  /** Ask the model for strict JSON output (caller checks capability first). */
  jsonMode: boolean;
  signal?: AbortSignal;
}

/** A completed (non-streamed) generation. */
export interface ProviderCompletionResult {
  text: string;
  finishReason: AiFinishReason;
  usage: AiTokenUsage;
  /** The model id the provider actually served (echoed back). */
  model: string;
}

/**
 * One streamed chunk. `delta` is the incremental text (possibly empty on a
 * metadata-only chunk); `finishReason`/`usage` are set on the terminal chunk
 * (many providers only report usage at the very end).
 */
export interface ProviderStreamChunk {
  delta: string;
  finishReason?: AiFinishReason;
  usage?: AiTokenUsage;
}
