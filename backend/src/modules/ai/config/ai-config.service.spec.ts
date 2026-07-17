import { AiModelAvailability, AiProvider } from '@qalam/shared';
import type { AiModelMetadata } from '@qalam/shared';
import type { Repository } from 'typeorm';

import type { aiConfig } from '../../../config/ai.config';
import type { ModelRegistryService } from '../registry/model-registry.service';
import { AiConfigService } from './ai-config.service';
import type { AiConfigOverride } from './entities/ai-config-override.entity';
import type { AiOrgConfig } from './entities/ai-org-config.entity';

type Env = ReturnType<typeof aiConfig>;

const model: AiModelMetadata = {
  id: 'gpt-4o',
  provider: AiProvider.OpenAI,
  displayName: 'GPT-4o',
  contextWindow: 128_000,
  maxOutputTokens: 1_000,
  capabilities: [],
  supportsStreaming: true,
  supportsVision: false,
  supportsJsonMode: true,
  inputCostPerMillion: 1,
  outputCostPerMillion: 1,
  availability: AiModelAvailability.Available,
  isDefault: true,
};

describe('AiConfigService.resolveForUser', () => {
  const env = {
    defaultProvider: AiProvider.OpenAI,
    defaultModel: '',
  } as unknown as Env;
  const orgRepo = { find: jest.fn().mockResolvedValue([]) } as unknown as Repository<AiOrgConfig>;
  const overrideRepo = {
    findOne: jest.fn().mockResolvedValue(null),
  } as unknown as Repository<AiConfigOverride>;
  const registry = {
    resolveModel: jest.fn().mockReturnValue(model),
  } as unknown as ModelRegistryService;

  const service = new AiConfigService(env, orgRepo, overrideRepo, registry);

  it('falls back to env defaults when no org/user rows exist', async () => {
    const resolved = await service.resolveForUser('u1');
    expect(resolved.provider).toBe(AiProvider.OpenAI);
    expect(resolved.model).toBe('gpt-4o');
  });

  it('clamps out-of-range params and caps maxTokens to the model', async () => {
    const resolved = await service.resolveForUser('u1', { temperature: 5, maxTokens: 999_999 });
    expect(resolved.params.temperature).toBe(2); // clamped to AI_PARAM_BOUNDS.temperature.max
    expect(resolved.params.maxTokens).toBe(1_000); // capped to model.maxOutputTokens
  });
});
