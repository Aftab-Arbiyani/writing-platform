import { AiFeature, AiFinishReason, AiModelAvailability, AiProvider } from '@qalam/shared';
import type { AiModelMetadata } from '@qalam/shared';

import type { AiUsageMeter } from '../../../common/metering/ai-usage-meter.port';
import type { aiConfig } from '../../../config/ai.config';
import { AiFeatureService } from '../ai-feature.service';
import type { SettingsService } from '../../settings/settings.service';
import type { SettingsService as UserPreferencesService } from '../../users/settings.service';
import { AI_MASTER_FLAG_KEY, ERROR_CODES, aiFeatureFlagKey } from '@qalam/shared';
import type { AiConfigService } from '../config/ai-config.service';
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

/**
 * B5 (docs/45 §4.10) — **the refusal must meter nothing.**
 *
 * §4.10: "an opted-out user issues no AI requests, so nothing meters. Confirm no
 * allowance or token accounting fires on the refusal path." That is a placement claim
 * about the orchestrator — the guard sits at the top of `prepare()`, ahead of
 * `meter.checkQuota` — so it is asserted here, with a REAL `AiFeatureService` in front
 * of a REAL `AI_USAGE_METER` double, rather than by mocking the gate and taking the
 * ordering on trust. (D5 removed the meter's `recordConsumption` half; the claim now
 * has one call to disprove instead of two.)
 *
 * Both entry points are covered: `complete()` and `stream()` share `prepare()`, and a
 * gate that only guarded the buffered path would leave streaming as the bypass.
 */

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

function flag(key: string, enabled: boolean) {
  return { key, enabled, envScope: null, rolloutPercentage: null };
}

/** The orchestrator with a REAL gate (so B5's switch is genuinely in the path) and a spy meter. */
function build(userAiEnabled: boolean) {
  const features = new AiFeatureService(
    {
      getFeatureFlags: jest
        .fn()
        .mockResolvedValue([
          flag(AI_MASTER_FLAG_KEY, true),
          flag(aiFeatureFlagKey(AiFeature.WritingAssistant), true),
        ]),
    } as unknown as SettingsService,
    {
      isAiEnabledFor: jest.fn().mockResolvedValue(userAiEnabled),
    } as unknown as UserPreferencesService,
  );

  const meter = {
    checkQuota: jest.fn().mockResolvedValue(undefined),
  } as unknown as AiUsageMeter;

  const adapter = {
    provider: AiProvider.OpenAI,
    isConfigured: () => true,
    complete: jest.fn().mockResolvedValue({
      text: 'hello',
      finishReason: AiFinishReason.Stop,
      usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
      model: 'gpt-4o',
    }),

    stream: jest.fn().mockImplementation(async function* () {
      yield { delta: 'hello', usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 } };
    }),
  } as unknown as AiProviderAdapter;

  const providers = {
    get: jest.fn().mockReturnValue(adapter),
  } as unknown as ProviderRegistryService;
  const usage = {
    assertWithinLimits: jest.fn().mockResolvedValue(undefined),
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as UsageService;
  const config = {
    resolveForUser: jest.fn().mockResolvedValue({
      provider: AiProvider.OpenAI,
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
    meter,
  );
  return { service, meter, usage, adapter, config };
}

const input = {
  userId: 'u1',
  feature: AiFeature.WritingAssistant,
  messages: [{ role: 'user' as const, content: 'hi' }],
};

describe('AiCompletionService — a user who turned AI off (B5)', () => {
  it('refuses complete() with AI_DISABLED_BY_USER', async () => {
    const { service } = build(false);

    await expect(service.complete(input)).rejects.toMatchObject({
      code: ERROR_CODES.AI_DISABLED_BY_USER,
    });
  });

  it('meters NOTHING on the refusal — checkQuota never fires', async () => {
    const { service, meter, usage } = build(false);

    await expect(service.complete(input)).rejects.toMatchObject({
      code: ERROR_CODES.AI_DISABLED_BY_USER,
    });

    // The AF5 allowance: untouched. A user who switched AI off must not be able to spend
    // an allowance on being told no.
    expect(meter.checkQuota).not.toHaveBeenCalled();
    // The AI module's own raw token log, likewise.
    expect(usage.record).not.toHaveBeenCalled();
  });

  it('never reaches the provider, so the refusal costs no tokens upstream either', async () => {
    const { service, adapter, config } = build(false);

    await expect(service.complete(input)).rejects.toMatchObject({
      code: ERROR_CODES.AI_DISABLED_BY_USER,
    });

    expect(adapter.complete).not.toHaveBeenCalled();
    // The guard is the FIRST thing `prepare()` does — config resolution has not run.
    expect(config.resolveForUser).not.toHaveBeenCalled();
  });

  it('refuses stream() too, and meters nothing there either', async () => {
    const { service, meter, usage } = build(false);

    // Streaming shares `prepare()`; an unguarded stream would be the bypass.
    // Collecting the events (rather than discarding them) is what proves the generator
    // threw before its first yield instead of streaming anything.
    const events: unknown[] = [];
    await expect(async () => {
      for await (const event of service.stream(input)) {
        events.push(event);
      }
    }).rejects.toMatchObject({ code: ERROR_CODES.AI_DISABLED_BY_USER });
    expect(events).toEqual([]);

    expect(meter.checkQuota).not.toHaveBeenCalled();
    expect(usage.record).not.toHaveBeenCalled();
  });

  it('still meters normally for a user who has NOT turned AI off', async () => {
    const { service, meter, usage } = build(true);

    await expect(service.complete(input)).resolves.toMatchObject({ content: 'hello' });

    // The control: B5 removes metering only from the refusal path, not from AI.
    expect(meter.checkQuota).toHaveBeenCalledTimes(1);
    expect(usage.record).toHaveBeenCalledTimes(1);
  });
});
