import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { AiFinishReason, AiProvider } from '@qalam/shared';
import type { AiTokenUsage } from '@qalam/shared';

import { aiConfig } from '../../../../config/ai.config';
import { AI_CHARS_PER_TOKEN } from '../../ai.constants';
import { AiProviderNotConfiguredException } from '../../ai.exceptions';
import type { AiProviderAdapter } from '../ai-provider.port';
import type {
  ProviderCompletionRequest,
  ProviderCompletionResult,
  ProviderStreamChunk,
} from '../provider.types';

/**
 * The **stub** AI provider — an inert port that streams a fixed passage instead of generating one.
 *
 * ## Why it exists
 *
 * `af2`'s last unasserted leg was "a generated suggestion arriving in the editor". The panel, its
 * gating and its editor wiring are asserted by `assistant.spec.ts`, but nothing could produce a
 * suggestion: every real adapter is credential-gated (`isConfigured()` tests an `apiKey` for
 * emptiness) and the E2E stack holds no vendor key, so the AI module had **no inert port at all** —
 * it refused. That is the same wrong premise W4 corrected for payments, where `PaymentProvider.Manual`
 * sat in the vocabulary with no adapter ([48 §3.6 W4-4]); this is its AI equivalent, built to the
 * same template ([e2e/06 §6]).
 *
 * Stubbing `/ai/completions/stream` in the browser was the alternative and is forbidden — [e2e/README
 * §invariants] rules out faking success at the app boundary. The third-party allowance ([e2e/00 §6])
 * covers running against an inert **port**, which is exactly what this is: the request travels the
 * whole real path (feature flags → orchestrator → prompt + context assembly → safety → token
 * accounting → SSE → the client's delta accumulation) and only the vendor HTTP call is replaced.
 *
 * ## Two properties this adapter is built around
 *
 * 1. **It streams, in many chunks.** A one-blob response would leave the streaming path — the part
 *    most likely to be wrong, and the part the assistant and Ask-My-Book both depend on — completely
 *    unexercised. {@link stream} emits fixed-width deltas with a small pause between them, so the
 *    client genuinely accumulates a growing answer rather than receiving it whole.
 * 2. **Its output is deterministic.** `frontend-ai-panel` has committed visual baselines, and a
 *    stub whose text varied would drift them on every run. The passage below is a constant, the
 *    chunk boundaries are a pure function of it, and nothing here reads a clock or a random source.
 *    Token counts are derived arithmetically from the text for the same reason.
 *
 * ## Safety
 *
 * **Off unless explicitly switched on**, exactly like the credential-gated providers — but gated on
 * a boolean, because there is no credential. With `AI_STUB_ENABLED` unset or anything but `'true'`,
 * `isConfigured()` is false and every call throws `AI_PROVIDER_NOT_CONFIGURED`, so a deployment that
 * does not opt in cannot reach this code and no client can influence the flag. It is registered
 * unconditionally (like every other adapter) because the *gate*, not the registration, is what makes
 * a provider unusable — and a provider that disappears from the registry answers a different error.
 *
 * Switching it on in production would serve every writer the same canned paragraph as if a model had
 * written it. There is no legitimate production use.
 */
@Injectable()
export class StubAdapter implements AiProviderAdapter {
  readonly provider = AiProvider.Stub;
  private readonly logger = new Logger(StubAdapter.name);

  constructor(@Inject(aiConfig.KEY) private readonly cfg: ConfigType<typeof aiConfig>) {}

  isConfigured(): boolean {
    return this.cfg.stub.enabled;
  }

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    this.assertConfigured();
    const { text, finishReason } = this.bodyFor(request);
    return {
      text,
      finishReason,
      usage: this.usageFor(request, text),
      model: request.model,
    };
  }

  /**
   * Emit the passage as a realistic multi-chunk stream: fixed-width deltas, then a terminal chunk
   * carrying `finishReason` + `usage` — the shape every real adapter here produces (usage last,
   * because that is when providers report it).
   *
   * `request.signal` is honoured between chunks and while pausing, so a writer pressing **Stop**
   * (or a closed request, or the orchestrator's timeout) ends the stream promptly instead of
   * running it out. On abort it returns without a terminal chunk, matching `parseSseStream`'s
   * behaviour on the real adapters — the orchestrator finalizes on what it received.
   */
  async *stream(request: ProviderCompletionRequest): AsyncIterable<ProviderStreamChunk> {
    this.assertConfigured();
    const { text, finishReason } = this.bodyFor(request);
    for (const chunk of chunkText(text)) {
      await pause(STUB_CHUNK_DELAY_MS, request.signal);
      if (request.signal?.aborted === true) {
        return;
      }
      yield { delta: chunk };
    }
    yield { delta: '', finishReason, usage: this.usageFor(request, text) };
  }

  /**
   * The response body, and the finish reason that honestly describes it.
   *
   * JSON is served when the caller asked for it — either through `jsonMode` or by instructing it in
   * the prompt, which is how AF3's story analyses ask (their templates demand JSON without setting
   * the flag, and their parser recovers the outermost object from the reply). The object is valid
   * but **schema-agnostic**: AF3's readers are field-tolerant, so an unrecognised shape degrades to
   * an empty structured result rather than a crash. A caller that needs a specific schema back has
   * to teach this method that schema — see the hand-off note in [e2e/06 §6].
   *
   * A caller whose `maxTokens` cannot hold the reply gets it **actually truncated** and
   * `finishReason: 'length'`, rather than the full text with a contradictory label — the truncation
   * branch is part of what a client consuming this port has to handle.
   */
  private bodyFor(request: ProviderCompletionRequest): {
    text: string;
    finishReason: AiFinishReason;
  } {
    const full = this.wantsJson(request) ? STUB_JSON_TEXT : STUB_PASSAGE;
    const budgetChars = request.maxTokens * AI_CHARS_PER_TOKEN;
    if (full.length <= budgetChars) {
      return { text: full, finishReason: AiFinishReason.Stop };
    }
    return { text: full.slice(0, Math.max(0, budgetChars)), finishReason: AiFinishReason.Length };
  }

  private wantsJson(request: ProviderCompletionRequest): boolean {
    if (request.jsonMode) {
      return true;
    }
    return request.messages.some((message) => /\bJSON\b/.test(message.content));
  }

  /**
   * Deterministic token counts — `ceil(chars / AI_CHARS_PER_TOKEN)`, the same rough ratio
   * `TokenCounterService` uses. Non-zero numbers matter because usage accounting, the AF5 credit
   * debit and the writer's allowance bar all read them; a stubbed zero would make the metering path
   * look exercised when nothing was recorded.
   */
  private usageFor(request: ProviderCompletionRequest, text: string): AiTokenUsage {
    const inputChars = request.messages.reduce((total, m) => total + m.content.length, 0);
    const inputTokens = Math.ceil(inputChars / AI_CHARS_PER_TOKEN);
    const outputTokens = Math.ceil(text.length / AI_CHARS_PER_TOKEN);
    return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new AiProviderNotConfiguredException(this.provider);
    }
    // Loud on every call, like the manual payment adapter: a stack serving canned text as model
    // output should say so in its logs, every time, not once at boot.
    this.logger.warn(
      'stub AI provider served a completion — no model generated this text and no vendor was called',
    );
  }
}

/**
 * The one passage this provider ever returns as prose.
 *
 * It says what it is, in the writer's own panel, because this text can reach a draft: the assistant
 * applies an accepted suggestion straight into the document, so a paragraph that read like real
 * prose could be published as if a model had written it. Constant — a visual baseline depends on it.
 */
export const STUB_PASSAGE =
  'This paragraph came from the stub AI provider, not from a language model. ' +
  'It is a fixed passage streamed one fragment at a time so the assistant, its accumulation of ' +
  'deltas, and the accept path can all be exercised end to end without calling a vendor. ' +
  'Nothing here was generated, and nothing about it will change between runs.';

/** The JSON-mode reply — valid, deterministic, and deliberately schema-agnostic (see `bodyFor`). */
export const STUB_JSON_TEXT = JSON.stringify({
  stub: true,
  summary: 'Generated by the stub AI provider — no model produced this object.',
  items: [],
  confidence: 0,
});

/**
 * Characters per delta. Deliberately a character width rather than a word count: real provider
 * deltas are sub-word token fragments, and a width also guarantees many chunks for text with no
 * spaces in it at all — a JSON reply would otherwise arrive as the single blob this exists to avoid.
 */
const STUB_CHUNK_CHARS = 28;

/**
 * Pause between deltas. Enough that the client observes a stream in flight (so its "Thinking…" and
 * growing-text states are both reachable) while adding well under a second to a whole call.
 */
const STUB_CHUNK_DELAY_MS = 25;

/**
 * Split text into fixed-width deltas. Pure and total — same text in, same chunks out, always — and
 * the concatenation of the chunks is byte-identical to the input, which is the property the client's
 * accumulation relies on.
 */
export function chunkText(text: string, chunkChars = STUB_CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkChars) {
    chunks.push(text.slice(i, i + chunkChars));
  }
  return chunks;
}

/** `setTimeout` that resolves early when `signal` aborts, and never leaves a timer behind. */
async function pause(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted === true) {
    return;
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
