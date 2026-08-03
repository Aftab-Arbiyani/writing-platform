import { registerAs } from '@nestjs/config';
import {
  AI_DEFAULT_DAILY_TOKEN_LIMIT,
  AI_DEFAULT_MONTHLY_TOKEN_LIMIT,
  AI_STREAM_TIMEOUT_MS,
  AiProvider,
} from '@qalam/shared';

/**
 * AI platform config (AF1). Provider credentials are SECRETS — env only, never a
 * default value that could leak a real key, never sent to a client. A provider
 * with a blank `apiKey` is treated as "not configured" (the registry reports it
 * and calls to it fail `AI_PROVIDER_NOT_CONFIGURED`), so the whole subsystem is
 * inert until keys are supplied — matching the disabled `feature.ai.enabled` flag.
 *
 * Base URLs are overridable so the OpenAI-compatible extension points (Azure,
 * Ollama, OpenRouter, LM Studio, self-hosted) work by pointing an adapter at a
 * different host — no code change. `defaultModel` blank => the model registry
 * picks the default model for `defaultProvider`.
 */
export const aiConfig = registerAs('ai', () => ({
  defaultProvider: (process.env.AI_DEFAULT_PROVIDER ?? AiProvider.OpenAI) as AiProvider,
  defaultModel: process.env.AI_DEFAULT_MODEL ?? '',
  /** Overall per-call time budget (provider call + stream), ms. */
  requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? AI_STREAM_TIMEOUT_MS),
  /** Default per-user token allowances (org defaults; admin-configurable at runtime). */
  dailyTokenLimit: Number(process.env.AI_DAILY_TOKEN_LIMIT ?? AI_DEFAULT_DAILY_TOKEN_LIMIT),
  monthlyTokenLimit: Number(process.env.AI_MONTHLY_TOKEN_LIMIT ?? AI_DEFAULT_MONTHLY_TOKEN_LIMIT),
  /** Per-provider credentials + endpoint. Blank apiKey => provider not configured. */
  providers: {
    [AiProvider.OpenAI]: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    },
    [AiProvider.Anthropic]: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      baseUrl: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1',
    },
    [AiProvider.Google]: {
      apiKey: process.env.GOOGLE_AI_API_KEY ?? '',
      baseUrl: process.env.GOOGLE_AI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
    },
    // ── Extension points (OpenAI-compatible HTTP; adapters land later) ────────
    [AiProvider.AzureOpenAI]: {
      apiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
      baseUrl: process.env.AZURE_OPENAI_BASE_URL ?? '',
    },
    [AiProvider.Ollama]: {
      apiKey: process.env.OLLAMA_API_KEY ?? '',
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
    },
    [AiProvider.OpenRouter]: {
      apiKey: process.env.OPENROUTER_API_KEY ?? '',
      baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    },
    [AiProvider.LmStudio]: {
      apiKey: process.env.LM_STUDIO_API_KEY ?? '',
      baseUrl: process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1',
    },
    [AiProvider.SelfHosted]: {
      apiKey: process.env.SELF_HOSTED_AI_API_KEY ?? '',
      baseUrl: process.env.SELF_HOSTED_AI_BASE_URL ?? '',
    },
    /**
     * The stub provider holds no credential — its gate is `stub.enabled` below. The entry exists
     * so every `AiProvider` resolves in this map, which is indexed by the *resolved* default
     * provider (`AiHealthIndicator`); the permanently-blank key also keeps the credential-based
     * readiness answer truthful, since there is no live provider behind it.
     */
    [AiProvider.Stub]: { apiKey: '', baseUrl: '' },
  },
  /**
   * The **stub** provider (`StubAdapter`) — streams one fixed passage instead of generating.
   *
   * Gated on an explicit boolean rather than a credential, because there is none to hold; the
   * effect is the same as a blank `apiKey` above, which is that the provider is inert until a
   * deployment opts in. Mirrors `payments.manual.enabled` (payments.config.ts) exactly, including
   * the reason it exists: an E2E stack needs a working AI path with no third party in it. **Off by
   * default, and it must stay that way outside a test stack** — with it on and
   * `AI_DEFAULT_PROVIDER=stub`, every writer's suggestion is the same canned paragraph.
   */
  stub: {
    enabled: process.env.AI_STUB_ENABLED === 'true',
  },
}));
