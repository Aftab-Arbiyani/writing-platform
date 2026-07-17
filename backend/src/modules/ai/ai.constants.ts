/**
 * AI module constants (AF1). Small, dependency-free values shared across the
 * module. Product limits live in `@qalam/shared` (`limits.ts`) and AI vocabulary
 * defaults in `@qalam/shared` (`ai.ts`); this holds only backend-internal knobs.
 */

/**
 * Heuristic characters-per-token ratio for a provider-agnostic PRE-count (used
 * to reject over-long input before a call and to estimate context size). The
 * authoritative counts come back from the provider `usage` after the call; this
 * is only a cheap guardrail (English/Latin ≈ 4 chars/token; CJK/Indic denser, so
 * this deliberately UNDER-estimates tokens for those — the real usage still bills).
 */
export const AI_CHARS_PER_TOKEN = 4;

/**
 * SSE comment heartbeat interval — keeps proxies/load balancers from closing an
 * idle stream while the provider is still "thinking" before the first token.
 */
export const AI_SSE_HEARTBEAT_MS = 15_000;

/** Anthropic API version header value (their required `anthropic-version`). */
export const ANTHROPIC_API_VERSION = '2023-06-01';

/** Human-readable provider names for admin surfaces (keyed by AiProvider value). */
export const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  azure_openai: 'Azure OpenAI',
  ollama: 'Ollama',
  openrouter: 'OpenRouter',
  lm_studio: 'LM Studio',
  self_hosted: 'Self-hosted',
};
