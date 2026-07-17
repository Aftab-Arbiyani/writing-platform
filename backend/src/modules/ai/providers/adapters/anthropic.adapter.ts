import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { AiFinishReason, AiMessageRole, AiProvider } from '@qalam/shared';
import type { AiTokenUsage } from '@qalam/shared';

import { aiConfig } from '../../../../config/ai.config';
import { ANTHROPIC_API_VERSION } from '../../ai.constants';
import {
  AiProviderErrorException,
  AiProviderNotConfiguredException,
  AiProviderUnavailableException,
} from '../../ai.exceptions';
import type { AiProviderAdapter } from '../ai-provider.port';
import type {
  ProviderCompletionRequest,
  ProviderCompletionResult,
  ProviderStreamChunk,
} from '../provider.types';
import { safeErrorText } from './openai-compatible.adapter';
import { parseSseStream } from '../sse-parser';

/** Minimal Anthropic Messages API typings we depend on. */
interface AnthropicTextBlock {
  type?: string;
  text?: string;
}
interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
}
interface AnthropicResponse {
  content?: AnthropicTextBlock[];
  stop_reason?: string | null;
  usage?: AnthropicUsage;
  model?: string;
}
interface AnthropicStreamEvent {
  type?: string;
  message?: { usage?: AnthropicUsage };
  delta?: { type?: string; text?: string; stop_reason?: string | null };
  usage?: AnthropicUsage;
}

/**
 * Anthropic (Claude) adapter. Anthropic's Messages API differs from the OpenAI
 * shape in two ways the adapter normalizes: the system prompt is a top-level
 * `system` field (not a message role), and only `user`/`assistant` roles are
 * allowed. Everything above the adapter still speaks the neutral
 * {@link ProviderCompletionRequest}.
 */
@Injectable()
export class AnthropicAdapter implements AiProviderAdapter {
  readonly provider = AiProvider.Anthropic;

  constructor(@Inject(aiConfig.KEY) private readonly cfg: ConfigType<typeof aiConfig>) {}

  isConfigured(): boolean {
    return this.creds().apiKey.length > 0;
  }

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    const response = await this.post(request, false);
    const body = (await response.json()) as AnthropicResponse;
    const text = (body.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
    return {
      text,
      finishReason: this.mapFinishReason(body.stop_reason),
      usage: this.mapUsage(body.usage),
      model: body.model ?? request.model,
    };
  }

  async *stream(request: ProviderCompletionRequest): AsyncIterable<ProviderStreamChunk> {
    const response = await this.post(request, true);
    if (response.body === null) {
      throw new AiProviderUnavailableException(this.provider);
    }
    let inputTokens = 0;
    let outputTokens = 0;
    let finishReason: AiFinishReason | undefined;
    for await (const data of parseSseStream(response.body, request.signal)) {
      let event: AnthropicStreamEvent;
      try {
        event = JSON.parse(data) as AnthropicStreamEvent;
      } catch {
        continue;
      }
      if (event.type === 'message_start' && event.message?.usage) {
        inputTokens = event.message.usage.input_tokens ?? 0;
      } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const delta = event.delta.text ?? '';
        if (delta !== '') {
          yield { delta };
        }
      } else if (event.type === 'message_delta') {
        if (event.usage?.output_tokens != null) {
          outputTokens = event.usage.output_tokens;
        }
        if (event.delta?.stop_reason != null) {
          finishReason = this.mapFinishReason(event.delta.stop_reason);
        }
      }
    }
    const usage: AiTokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };
    yield { delta: '', finishReason: finishReason ?? AiFinishReason.Stop, usage };
  }

  private async post(request: ProviderCompletionRequest, stream: boolean): Promise<Response> {
    const { apiKey, baseUrl } = this.creds();
    if (apiKey.length === 0) {
      throw new AiProviderNotConfiguredException(this.provider);
    }
    // Anthropic separates the system prompt from the message list.
    const system = request.messages
      .filter((m) => m.role === AiMessageRole.System)
      .map((m) => m.content)
      .join('\n\n');
    const messages = request.messages
      .filter((m) => m.role === AiMessageRole.User || m.role === AiMessageRole.Assistant)
      .map((m) => ({ role: m.role, content: m.content }));

    const payload: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens,
      messages,
      // Anthropic caps temperature at 1.0 (our shared bound allows up to 2).
      temperature: Math.min(1, request.temperature),
      top_p: request.topP,
      stream,
    };
    if (system.length > 0) {
      payload.system = system;
    }
    if (request.stop.length > 0) {
      payload.stop_sequences = request.stop;
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
        },
        body: JSON.stringify(payload),
        signal: request.signal,
      });
    } catch {
      throw new AiProviderUnavailableException(this.provider);
    }
    if (!response.ok) {
      throw new AiProviderErrorException(
        this.provider,
        `${response.status} ${await safeErrorText(response)}`,
      );
    }
    return response;
  }

  private creds(): { apiKey: string; baseUrl: string } {
    return this.cfg.providers[AiProvider.Anthropic];
  }

  private mapUsage(usage: AnthropicUsage | undefined): AiTokenUsage {
    const inputTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;
    return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  }

  private mapFinishReason(reason: string | null | undefined): AiFinishReason {
    switch (reason) {
      case 'max_tokens':
        return AiFinishReason.Length;
      case 'tool_use':
        return AiFinishReason.ToolCalls;
      case 'end_turn':
      case 'stop_sequence':
      default:
        return AiFinishReason.Stop;
    }
  }
}
