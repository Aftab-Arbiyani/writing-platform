import { AiProvider } from '@qalam/shared';

import { AiProviderNotConfiguredException } from '../ai.exceptions';
import type { AiProviderAdapter } from './ai-provider.port';
import { ProviderRegistryService } from './provider-registry.service';

function fakeAdapter(provider: AiProvider, configured: boolean): AiProviderAdapter {
  return {
    provider,
    isConfigured: () => configured,
    complete: jest.fn(),
    stream: jest.fn(),
  } as unknown as AiProviderAdapter;
}

describe('ProviderRegistryService', () => {
  const openai = fakeAdapter(AiProvider.OpenAI, true);
  const anthropic = fakeAdapter(AiProvider.Anthropic, false);
  const registry = new ProviderRegistryService([openai, anthropic]);

  it('returns the adapter for a provider (interchangeable by provider id)', () => {
    expect(registry.get(AiProvider.OpenAI)).toBe(openai);
    expect(registry.get(AiProvider.Anthropic)).toBe(anthropic);
  });

  it('reports configured vs implemented providers separately', () => {
    expect(registry.isConfigured(AiProvider.OpenAI)).toBe(true);
    expect(registry.isConfigured(AiProvider.Anthropic)).toBe(false);
    expect(registry.configuredProviders()).toEqual([AiProvider.OpenAI]);
    expect(registry.implementedProviders()).toEqual([AiProvider.OpenAI, AiProvider.Anthropic]);
  });

  it('throws for an unregistered provider', () => {
    expect(() => registry.get(AiProvider.Ollama)).toThrow(AiProviderNotConfiguredException);
  });
});
