import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { AiProvider } from '@qalam/shared';

import { aiConfig } from '../../../../config/ai.config';
import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';

/**
 * OpenAI adapter — the reference OpenAI-compatible implementation. The Azure /
 * Ollama / OpenRouter / LM Studio / self-hosted extension points speak the same
 * wire format and would each be a subclass of {@link OpenAiCompatibleAdapter}
 * that returns their own creds — no new HTTP logic.
 */
@Injectable()
export class OpenAiAdapter extends OpenAiCompatibleAdapter {
  readonly provider = AiProvider.OpenAI;

  constructor(@Inject(aiConfig.KEY) private readonly cfg: ConfigType<typeof aiConfig>) {
    super();
  }

  protected creds(): { apiKey: string; baseUrl: string } {
    return this.cfg.providers[AiProvider.OpenAI];
  }
}
