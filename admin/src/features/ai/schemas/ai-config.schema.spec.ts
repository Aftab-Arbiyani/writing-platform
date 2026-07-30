import { describe, expect, it } from 'vitest';

import { aiOrgConfigSchema } from './ai-config.schema';

describe('aiOrgConfigSchema', () => {
  const valid = {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    topP: 1,
    maxTokens: 1024,
    streaming: true,
  };

  it('accepts valid org defaults', () => {
    expect(aiOrgConfigSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an out-of-range temperature', () => {
    expect(aiOrgConfigSchema.safeParse({ ...valid, temperature: 5 }).success).toBe(false);
  });

  it('rejects an unknown provider', () => {
    expect(aiOrgConfigSchema.safeParse({ ...valid, provider: 'nope' }).success).toBe(false);
  });
});
