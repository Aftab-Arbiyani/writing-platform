import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { AiFinishReason, AiMessageRole, AiProvider } from '@qalam/shared';
import type { AiTokenUsage } from '@qalam/shared';

import { aiConfig } from '../../../../config/ai.config';
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

/** Minimal Google Gemini (generateContent) typings we depend on. */
interface GeminiPart {
  text?: string;
}
interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}
interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
  modelVersion?: string;
}

/**
 * Google Gemini adapter. Gemini's API puts the model in the URL, uses
 * `user`/`model` roles (assistant → model), a top-level `systemInstruction`, and
 * a `generationConfig` block. The adapter maps the neutral request onto that
 * shape; callers never see any of it.
 */
@Injectable()
export class GeminiAdapter implements AiProviderAdapter {
  readonly provider = AiProvider.Google;

  constructor(@Inject(aiConfig.KEY) private readonly cfg: ConfigType<typeof aiConfig>) {}

  isConfigured(): boolean {
    return this.creds().apiKey.length > 0;
  }

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResult> {
    const response = await this.post(request, false);
    const body = (await response.json()) as GeminiResponse;
    const candidate = body.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    return {
      text,
      finishReason: this.mapFinishReason(candidate?.finishReason),
      usage: this.mapUsage(body.usageMetadata),
      model: body.modelVersion ?? request.model,
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
      let parsed: GeminiResponse;
      try {
        parsed = JSON.parse(data) as GeminiResponse;
      } catch {
        continue;
      }
      const candidate = parsed.candidates?.[0];
      if (parsed.usageMetadata) {
        usage = this.mapUsage(parsed.usageMetadata);
      }
      if (candidate?.finishReason != null && candidate.finishReason !== '') {
        finishReason = this.mapFinishReason(candidate.finishReason);
      }
      const delta = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
      if (delta !== '') {
        yield { delta };
      }
    }
    yield { delta: '', finishReason: finishReason ?? AiFinishReason.Stop, usage };
  }

  private async post(request: ProviderCompletionRequest, stream: boolean): Promise<Response> {
    const { apiKey, baseUrl } = this.creds();
    if (apiKey.length === 0) {
      throw new AiProviderNotConfiguredException(this.provider);
    }
    const systemText = request.messages
      .filter((m) => m.role === AiMessageRole.System)
      .map((m) => m.content)
      .join('\n\n');
    const contents = request.messages
      .filter((m) => m.role !== AiMessageRole.System)
      .map((m) => ({
        role: m.role === AiMessageRole.Assistant ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const generationConfig: Record<string, unknown> = {
      temperature: request.temperature,
      topP: request.topP,
      maxOutputTokens: request.maxTokens,
    };
    if (request.stop.length > 0) {
      generationConfig.stopSequences = request.stop;
    }
    if (request.jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }
    const payload: Record<string, unknown> = { contents, generationConfig };
    if (systemText.length > 0) {
      payload.systemInstruction = { parts: [{ text: systemText }] };
    }

    const method = stream ? 'streamGenerateContent' : 'generateContent';
    const query = stream ? '?alt=sse' : '';
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/models/${request.model}:${method}${query}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
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
    return this.cfg.providers[AiProvider.Google];
  }

  private mapUsage(usage: GeminiUsage | undefined): AiTokenUsage {
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;
    return {
      inputTokens,
      outputTokens,
      totalTokens: usage?.totalTokenCount ?? inputTokens + outputTokens,
    };
  }

  private mapFinishReason(reason: string | null | undefined): AiFinishReason {
    switch (reason) {
      case 'MAX_TOKENS':
        return AiFinishReason.Length;
      case 'SAFETY':
      case 'RECITATION':
      case 'PROHIBITED_CONTENT':
        return AiFinishReason.ContentFilter;
      case 'STOP':
      default:
        return AiFinishReason.Stop;
    }
  }
}
