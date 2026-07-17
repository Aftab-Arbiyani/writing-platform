import { AiFeature, AiFinishReason, AiModelAvailability, AiProvider } from '@qalam/shared';
import type { AiModelMetadata } from '@qalam/shared';

import type { AiFeatureService } from '../ai-feature.service';
import type { aiConfig } from '../../../config/ai.config';
import type { AiConfigService } from '../config/ai-config.service';
import type { ConversationService } from '../conversations/conversation.service';
import type { ContextRegistryService } from '../context/context-registry.service';
import type { PromptRegistryService } from '../prompts/prompt-registry.service';
import type { AiProviderAdapter } from '../providers/ai-provider.port';
import type { ProviderRegistryService } from '../providers/provider-registry.service';
import type { SafetyService } from '../safety/safety.service';
import type { TokenCounterService } from '../tokens/token-counter.service';
import type { UsageService } from '../tokens/usage.service';
import type { ModelRegistryService } from '../registry/model-registry.service';
import { AiCompletionService } from './ai-completion.service';

type Env = ReturnType<typeof aiConfig>;

const model: AiModelMetadata = {
  id: 'gpt-4o',
  provider: AiProvider.OpenAI,
  displayName: 'GPT-4o',
  contextWindow: 128_000,
  maxOutputTokens: 4_096,
  capabilities: [],
  supportsStreaming: true,
  supportsVision: false,
  supportsJsonMode: true,
  inputCostPerMillion: 1,
  outputCostPerMillion: 1,
  availability: AiModelAvailability.Available,
  isDefault: true,
};

/** Builds the orchestrator with all collaborators mocked; provider chosen by config. */
function build(provider: AiProvider) {
  const adapter = {
    provider,
    isConfigured: () => true,
    complete: jest.fn().mockResolvedValue({
      text: 'hello',
      finishReason: AiFinishReason.Stop,
      usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
      model: 'gpt-4o',
    }),
    stream: jest.fn(),
  } as unknown as AiProviderAdapter;

  const providers = {
    get: jest.fn().mockReturnValue(adapter),
  } as unknown as ProviderRegistryService;
  const features = {
    assertEnabled: jest.fn().mockResolvedValue(undefined),
  } as unknown as AiFeatureService;
  const usage = {
    assertWithinLimits: jest.fn().mockResolvedValue(undefined),
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as UsageService;
  const config = {
    resolveForUser: jest.fn().mockResolvedValue({
      provider,
      model: 'gpt-4o',
      params: {
        temperature: 0.7,
        topP: 1,
        maxTokens: 100,
        frequencyPenalty: 0,
        presencePenalty: 0,
        stop: [],
      },
      streaming: false,
      safety: {},
    }),
  } as unknown as AiConfigService;
  const models = { getModel: jest.fn().mockReturnValue(model) } as unknown as ModelRegistryService;
  const prompts = {
    render: jest.fn().mockReturnValue('SYSTEM'),
  } as unknown as PromptRegistryService;
  const context = {
    resolve: jest.fn().mockResolvedValue([]),
    compose: jest.fn().mockReturnValue(''),
  } as unknown as ContextRegistryService;
  const safety = {
    checkInput: jest.fn().mockImplementation((text: string) => Promise.resolve(text)),
    checkOutput: jest.fn().mockImplementation((text: string) => Promise.resolve(text)),
  } as unknown as SafetyService;
  const tokens = {
    estimateMessagesTokens: jest.fn().mockReturnValue(10),
    costUsd: jest.fn().mockReturnValue(0.01),
  } as unknown as TokenCounterService;
  const conversations = {} as unknown as ConversationService;
  const env = { requestTimeoutMs: 60_000 } as unknown as Env;

  const service = new AiCompletionService(
    env,
    features,
    config,
    models,
    providers,
    prompts,
    context,
    safety,
    usage,
    tokens,
    conversations,
  );
  return { service, providers, features, usage, adapter };
}

describe('AiCompletionService.complete', () => {
  const input = {
    userId: 'u1',
    feature: AiFeature.Playground,
    messages: [{ role: 'user' as const, content: 'hi' }],
  };

  it('runs the full pipeline and returns the provider result', async () => {
    const { service, features, usage } = build(AiProvider.OpenAI);
    const out = await service.complete(input);

    expect(features.assertEnabled).toHaveBeenCalledWith(AiFeature.Playground);
    expect(usage.assertWithinLimits).toHaveBeenCalledWith('u1');
    expect(usage.record).toHaveBeenCalledTimes(1);
    expect(out.content).toBe('hello');
    expect(out.provider).toBe(AiProvider.OpenAI);
    expect(out.usage.totalTokens).toBe(8);
    expect(out.costUsd).toBe(0.01);
  });

  it('dispatches provider-agnostically — swapping the resolved provider swaps the adapter', async () => {
    const { service, providers } = build(AiProvider.Anthropic);
    await service.complete(input);
    expect(providers.get).toHaveBeenCalledWith(AiProvider.Anthropic);
  });
});
