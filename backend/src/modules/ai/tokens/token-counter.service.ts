import { Injectable } from '@nestjs/common';
import { estimateAiCostUsd } from '@qalam/shared';
import type { AiModelMetadata, AiTokenUsage } from '@qalam/shared';

import { AI_CHARS_PER_TOKEN } from '../ai.constants';
import type { ProviderMessage } from '../providers/provider.types';

/**
 * Provider-agnostic token counting + cost (AF1). This produces a cheap PRE-count
 * estimate (used to reject over-long input and to guard against exceeding a
 * model's context window before a call); the AUTHORITATIVE counts always come
 * back from the provider's `usage` after the call and are what the usage
 * accountant bills. Centralized here so nothing else re-implements token math or
 * cost math (cost math itself lives in `@qalam/shared` so clients agree).
 */
@Injectable()
export class TokenCounterService {
  /** Rough token estimate for a string (see AI_CHARS_PER_TOKEN caveat). */
  estimateTokens(text: string): number {
    if (text.length === 0) {
      return 0;
    }
    return Math.ceil(text.length / AI_CHARS_PER_TOKEN);
  }

  /** Rough token estimate for a message list (+ per-message role overhead). */
  estimateMessagesTokens(messages: ProviderMessage[]): number {
    return messages.reduce((sum, message) => sum + this.estimateTokens(message.content) + 4, 0);
  }

  /** USD cost of a completed call from its (real) usage and the model's rates. */
  costUsd(usage: AiTokenUsage, model: AiModelMetadata): number {
    return estimateAiCostUsd(usage, model);
  }
}
