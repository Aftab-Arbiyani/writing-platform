import { AiFinishReason } from '@qalam/shared';
import type { AiProvider, AiTokenUsage } from '@qalam/shared';

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
import { parseSseStream } from '../sse-parser';

/** Minimal typings for the OpenAI Chat Completions wire shape we depend on. */
interface OpenAiChoice {
  message?: { content?: string | null };
  delta?: { content?: string | null };
  finish_reason?: string | null;
}
interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}
interface OpenAiResponse {
  choices?: OpenAiChoice[];
  usage?: OpenAiUsage | null;
  model?: string;
}

/**
 * Base adapter for any OpenAI-compatible Chat Completions API — OpenAI itself
 * and (via the same wire format at a different base URL) the Azure/Ollama/
 * OpenRouter/LM Studio/self-hosted extension points. Subclasses supply only the
 * provider id and credentials; all HTTP + normalization lives here so those
 * providers are "a two-line subclass", never a reimplementation.
 */
export abstract class OpenAiCompatibleAdapter implements AiProviderAdapter {
  abstract readonly provider: AiProvider;

  /** Credentials + endpoint for this provider (read from config lazily). */
  protected abstract creds(): { apiKey: string; baseUrl: string };

  isConfigured(): boolean {
    return this.creds().apiKey.length > 0;
  }

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    const response = await this.post(request, false);
    const body = (await response.json()) as OpenAiResponse;
    const choice = body.choices?.[0];
    return {
      text: choice?.message?.content ?? '',
      finishReason: this.mapFinishReason(choice?.finish_reason),
      usage: this.mapUsage(body.usage),
      model: body.model ?? request.model,
    };
  }

  async *stream(request: ProviderCompletionRequest): AsyncIterable<ProviderStreamChunk> {
    const response = await this.post(request, true);
    if (response.body === null) {
      throw new AiProviderUnavailableException(this.provider);
    }
    let usage: AiTokenUsage | undefined;
    let finishReason: AiFinishReason | undefined;
    for await (const data of parseSseStream(response.body, request.signal)) {
      if (data === '[DONE]') {
        break;
      }
      let parsed: OpenAiResponse;
      try {
        parsed = JSON.parse(data) as OpenAiResponse;
      } catch {
        continue; // skip malformed keep-alive lines
      }
      const choice = parsed.choices?.[0];
      if (parsed.usage) {
        usage = this.mapUsage(parsed.usage);
      }
      if (choice?.finish_reason != null && choice.finish_reason !== '') {
        finishReason = this.mapFinishReason(choice.finish_reason);
      }
      const delta = choice?.delta?.content ?? '';
      if (delta !== '') {
        yield { delta };
      }
    }
    yield { delta: '', finishReason: finishReason ?? AiFinishReason.Stop, usage };
  }

  /** Issues the HTTP call, translating transport/HTTP failures to domain errors. */
  private async post(request: ProviderCompletionRequest, stream: boolean): Promise<Response> {
    const { apiKey, baseUrl } = this.creds();
    if (apiKey.length === 0) {
      throw new AiProviderNotConfiguredException(this.provider);
    }
    const payload: Record<string, unknown> = {
      model: request.model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: request.temperature,
      top_p: request.topP,
      max_tokens: request.maxTokens,
      frequency_penalty: request.frequencyPenalty,
      presence_penalty: request.presencePenalty,
      stream,
    };
    if (request.stop.length > 0) {
      payload.stop = request.stop;
    }
    if (request.jsonMode) {
      payload.response_format = { type: 'json_object' };
    }
    if (stream) {
      payload.stream_options = { include_usage: true };
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: request.signal,
      });
    } catch {
      // Network failure / DNS / connection reset — retryable.
      throw new AiProviderUnavailableException(this.provider);
    }
    if (!response.ok) {
      const detail = await safeErrorText(response);
      throw new AiProviderErrorException(this.provider, `${response.status} ${detail}`);
    }
    return response;
  }

  private mapUsage(usage: OpenAiUsage | null | undefined): AiTokenUsage {
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;
    return {
      inputTokens,
      outputTokens,
      totalTokens: usage?.total_tokens ?? inputTokens + outputTokens,
    };
  }

  private mapFinishReason(reason: string | null | undefined): AiFinishReason {
    switch (reason) {
      case 'length':
        return AiFinishReason.Length;
      case 'content_filter':
        return AiFinishReason.ContentFilter;
      case 'tool_calls':
      case 'function_call':
        return AiFinishReason.ToolCalls;
      case 'stop':
      default:
        return AiFinishReason.Stop;
    }
  }
}

/** Reads a provider error body without throwing (best-effort detail string). */
export async function safeErrorText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 500);
  } catch {
    return response.statusText;
  }
}
