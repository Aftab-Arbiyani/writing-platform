import { AiMessageRole } from '@qalam/shared';
import type { AiModelMetadata } from '@qalam/shared';

import { TokenCounterService } from './token-counter.service';

describe('TokenCounterService', () => {
  const service = new TokenCounterService();

  it('estimates ~1 token per 4 characters', () => {
    expect(service.estimateTokens('')).toBe(0);
    expect(service.estimateTokens('abcd')).toBe(1);
    expect(service.estimateTokens('abcde')).toBe(2);
  });

  it('adds per-message overhead when estimating a message list', () => {
    const tokens = service.estimateMessagesTokens([{ role: AiMessageRole.User, content: 'abcd' }]);
    expect(tokens).toBe(1 + 4); // 1 content token + 4 overhead
  });

  it('computes cost from usage and model rates', () => {
    const model = {
      inputCostPerMillion: 2,
      outputCostPerMillion: 10,
    } as AiModelMetadata;
    const cost = service.costUsd(
      { inputTokens: 1_000_000, outputTokens: 500_000, totalTokens: 1_500_000 },
      model,
    );
    expect(cost).toBeCloseTo(2 + 5, 6);
  });
});
