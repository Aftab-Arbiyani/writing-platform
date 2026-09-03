import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { AiFinishReason, AiMessageRole } from '@qalam/shared';
import type {
  AiFeature,
  AiGenerationParams,
  AiProvider,
  AiResolvedConfig,
  AiTokenUsage,
} from '@qalam/shared';

import { aiConfig } from '../../../config/ai.config';
import { AiFeatureService } from '../ai-feature.service';
import {
  AiCapabilityUnsupportedException,
  AiContextTooLargeException,
  AiTimeoutException,
} from '../ai.exceptions';
import { AppException } from '../../../common/exceptions/app.exception';
import { AiConfigService } from '../config/ai-config.service';
import type { ContextRequest } from '../context/context-builder.port';
import { ContextRegistryService } from '../context/context-registry.service';
import { PromptRegistryService } from '../prompts/prompt-registry.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import type { ProviderCompletionRequest, ProviderMessage } from '../providers/provider.types';
import { SafetyService } from '../safety/safety.service';
import { TokenCounterService } from '../tokens/token-counter.service';
import { UsageService } from '../tokens/usage.service';
import { ModelRegistryService } from '../registry/model-registry.service';
import { AI_USAGE_METER } from '../../../common/metering/ai-usage-meter.port';
import type { AiUsageMeter } from '../../../common/metering/ai-usage-meter.port';

/** A caller's completion request (already validated by the DTO). */
export interface CompletionInput {
  userId: string;
  feature: AiFeature;
  promptKey?: string;
  promptVersion?: number;
  promptVariables?: Record<string, unknown>;
  messages?: Array<{ role: AiMessageRole; content: string }>;
  context?: ContextRequest[];
  params?: AiGenerationParams;
  jsonMode?: boolean;
  requestId?: string;
  signal?: AbortSignal;
}

/** A finished (non-streamed) completion. */
export interface CompletionOutput {
  /**
   * @deprecated Always `null` since D5 removed the conversation layer. Kept on the wire for
   * one release so a client built against the old shape keeps compiling.
   */
  conversationId: string | null;
  content: string;
  model: string;
  provider: AiProvider;
  finishReason: AiFinishReason;
  usage: AiTokenUsage;
  costUsd: number;
  /** @deprecated Always `null` since D5 — nothing is persisted to reference. */
  messageId: string | null;
}

/** One event of a streamed completion (mapped to SSE by the controller). */
export type CompletionStreamEvent =
  | { kind: 'start'; provider: AiProvider; model: string; conversationId: string | null }
  | { kind: 'delta'; text: string }
  | {
      kind: 'done';
      finishReason: AiFinishReason;
      usage: AiTokenUsage;
      costUsd: number;
      messageId: string | null;
    };

/**
 * THE completion orchestrator (AF1) — the single reuse core every AI feature
 * runs through. It composes the whole pipeline in one place so no feature
 * re-implements any of it:
 *
 *   gate (feature flag) → usage limit → resolve config → resolve model +
 *   capability check → assemble prompt (template) + context → input safety →
 *   context-window check → provider call (via the port) → output safety →
 *   cost + usage accounting.
 *
 * Every request is STATELESS since D5: the surviving surfaces (Polish, Manuscript
 * feedback, story analyses) each send their operand in full, so there is no history
 * to load and nothing to persist. `ai_usage_logs` remains the record of what ran.
 *
 * It depends only on the provider PORT, so it is entirely provider-agnostic.
 */
@Injectable()
export class AiCompletionService {
  private readonly logger = new Logger(AiCompletionService.name);

  constructor(
    @Inject(aiConfig.KEY) private readonly env: ConfigType<typeof aiConfig>,
    private readonly features: AiFeatureService,
    private readonly config: AiConfigService,
    private readonly models: ModelRegistryService,
    private readonly providers: ProviderRegistryService,
    private readonly prompts: PromptRegistryService,
    private readonly context: ContextRegistryService,
    private readonly safety: SafetyService,
    private readonly usage: UsageService,
    private readonly tokens: TokenCounterService,
    // AF5 metering seam — optional so the AI platform runs standalone (and in unit
    // tests) with no monetization module. When present it enforces the feature's premium
    // code and its per-plan allowance; the base token-cap check above always runs.
    @Optional() @Inject(AI_USAGE_METER) private readonly meter?: AiUsageMeter,
  ) {}

  /** One-shot completion. */
  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const prepared = await this.prepare(input);
    const adapter = this.providers.get(prepared.resolved.provider);

    let result;
    try {
      result = await adapter.complete(this.toProviderRequest(prepared, input));
    } catch (error) {
      throw this.mapCallError(error, prepared.timeout);
    }

    const content = await this.safety.checkOutput(result.text, input.userId, input.feature);
    const costUsd = this.tokens.costUsd(result.usage, prepared.modelMeta);
    await this.recordUsage(input, prepared.resolved, result.usage, costUsd);

    return {
      conversationId: null,
      content,
      model: result.model,
      provider: prepared.resolved.provider,
      finishReason: result.finishReason,
      usage: result.usage,
      costUsd,
      messageId: null,
    };
  }

  /** Streamed completion — yields start → deltas → done. */
  async *stream(input: CompletionInput): AsyncGenerator<CompletionStreamEvent> {
    const prepared = await this.prepare(input);
    const adapter = this.providers.get(prepared.resolved.provider);

    yield {
      kind: 'start',
      provider: prepared.resolved.provider,
      model: prepared.resolved.model,
      conversationId: null,
    };

    let full = '';
    let usage: AiTokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let finishReason: AiFinishReason = AiFinishReason.Stop;
    try {
      for await (const chunk of adapter.stream(this.toProviderRequest(prepared, input))) {
        if (chunk.delta !== '') {
          full += chunk.delta;
          yield { kind: 'delta', text: chunk.delta };
        }
        if (chunk.usage !== undefined) {
          usage = chunk.usage;
        }
        if (chunk.finishReason !== undefined) {
          finishReason = chunk.finishReason;
        }
      }
    } catch (error) {
      throw this.mapCallError(error, prepared.timeout);
    }

    // Output safety runs on the accumulated text (streamed text can't be recalled;
    // a blocked verdict surfaces as a stream error).
    await this.safety.checkOutput(full, input.userId, input.feature);
    const costUsd = this.tokens.costUsd(usage, prepared.modelMeta);
    await this.recordUsage(input, prepared.resolved, usage, costUsd);

    yield { kind: 'done', finishReason, usage, costUsd, messageId: null };
  }

  // ── Pipeline steps ─────────────────────────────────────────────────────────

  private async prepare(input: CompletionInput): Promise<PreparedCall> {
    /**
     * The gate — platform flags AND, since B5 (docs/45 §4.10), the caller's own
     * "turn AI off" preference. It is deliberately the FIRST thing `prepare` does,
     * and specifically ahead of the AF5 meter below:
     *
     * - `meter.checkQuota` (further down this method) is the only place an AI request
     *   touches a plan's allowance. Refusing here means an opted-out user's request costs
     *   them nothing — §4.10 requires that nothing meters, since a user who has switched
     *   AI off should not be able to be charged for a refusal.
     * - It also precedes every provider call, every prompt render and every context
     *   assembly, so a refusal spends no tokens and no upstream request either.
     *
     * Both `complete()` and `stream()` route through `prepare`, so neither can bypass
     * it, and it is the orchestrator's single gate rather than a per-controller check
     * (docs/35: every AI path runs through here).
     */
    await this.features.assertEnabled(input.feature, input.userId);
    await this.usage.assertWithinLimits(input.userId);

    const resolved = await this.config.resolveForUser(input.userId, input.params);
    const modelMeta = this.models.getModel(resolved.model);
    if (input.jsonMode === true && !modelMeta.supportsJsonMode) {
      throw new AiCapabilityUnsupportedException(modelMeta.id, 'json_mode');
    }

    const messages = await this.assembleMessages(input);

    // Input safety: sanitize/validate the last user message, then reuse the result.
    const safeUserText = await this.safety.checkInput(
      messages.at(-1)?.content ?? '',
      input.userId,
      input.feature,
    );
    const lastIndex = messages.length - 1;
    const last = lastIndex >= 0 ? messages[lastIndex] : undefined;
    if (last !== undefined) {
      messages[lastIndex] = { role: last.role, content: safeUserText };
    }

    const estimatedTokens = this.tokens.estimateMessagesTokens(messages);
    if (estimatedTokens > modelMeta.contextWindow) {
      throw new AiContextTooLargeException(estimatedTokens, modelMeta.contextWindow);
    }

    // AF5: delegate the entitlement + allowance decision to the monetization meter when
    // present. The base per-user token cap above already ran; this adds the plan's own
    // per-feature allowance without duplicating any counting.
    if (this.meter !== undefined) {
      await this.meter.checkQuota({
        userId: input.userId,
        feature: input.feature,
        provider: resolved.provider,
        model: resolved.model,
        estimatedTokens,
      });
    }

    return {
      resolved,
      modelMeta,
      messages,
      timeout: AbortSignal.timeout(this.env.requestTimeoutMs),
    };
  }

  private async assembleMessages(input: CompletionInput): Promise<ProviderMessage[]> {
    const messages: ProviderMessage[] = [];

    // 1. System prompt — from a template if named, else the base template.
    const systemKey = input.promptKey ?? 'system.base';
    const systemPrompt = this.prompts.render(
      systemKey,
      input.promptVariables ?? {},
      input.promptVersion,
    );
    if (systemPrompt.trim() !== '') {
      messages.push({ role: AiMessageRole.System, content: systemPrompt });
    }

    // 2. Assembled context fragments (pluggable providers) as a system block.
    if (input.context !== undefined && input.context.length > 0) {
      const fragments = await this.context.resolve(input.context, { userId: input.userId });
      const composed = this.context.compose(fragments);
      if (composed.trim() !== '') {
        messages.push({ role: AiMessageRole.System, content: composed });
      }
    }

    // 3. This turn's messages (raw messages, or the template `input` variable).
    if (input.messages !== undefined && input.messages.length > 0) {
      messages.push(...input.messages);
    } else if (typeof input.promptVariables?.input === 'string') {
      messages.push({ role: AiMessageRole.User, content: input.promptVariables.input });
    }

    return messages;
  }

  private toProviderRequest(
    prepared: PreparedCall,
    input: CompletionInput,
  ): ProviderCompletionRequest {
    const signal =
      input.signal !== undefined
        ? AbortSignal.any([prepared.timeout, input.signal])
        : prepared.timeout;
    return {
      model: prepared.resolved.model,
      messages: prepared.messages,
      temperature: prepared.resolved.params.temperature,
      topP: prepared.resolved.params.topP,
      maxTokens: prepared.resolved.params.maxTokens,
      frequencyPenalty: prepared.resolved.params.frequencyPenalty,
      presencePenalty: prepared.resolved.params.presencePenalty,
      stop: prepared.resolved.params.stop,
      jsonMode: input.jsonMode ?? false,
      signal,
    };
  }

  private async recordUsage(
    input: CompletionInput,
    resolved: AiResolvedConfig,
    usage: AiTokenUsage,
    costUsd: number,
  ): Promise<void> {
    await this.usage.record({
      userId: input.userId,
      feature: input.feature,
      provider: resolved.provider,
      model: resolved.model,
      usage,
      costUsd,
      conversationId: null,
      requestId: input.requestId ?? null,
    });
    /*
     * This row is the whole record. Until D5 it was mirrored into the monetization credit
     * ledger straight after, which made two write-paths for one fact; now the allowance is
     * COUNTED from these rows, so the mirror had nothing left to add and has gone with the
     * credits. The meter is ask-only.
     */
  }

  /** A timed-out call becomes AI_TIMEOUT; domain errors pass through untouched. */
  private mapCallError(error: unknown, timeout: AbortSignal): AppException | unknown {
    if (timeout.aborted) {
      return new AiTimeoutException();
    }
    if (error instanceof AppException) {
      return error;
    }
    this.logger.error(`AI completion failed: ${String(error)}`);
    return error;
  }
}

/** Internal: everything resolved before the provider call. */
interface PreparedCall {
  resolved: AiResolvedConfig;
  modelMeta: ReturnType<ModelRegistryService['getModel']>;
  messages: ProviderMessage[];
  timeout: AbortSignal;
}
