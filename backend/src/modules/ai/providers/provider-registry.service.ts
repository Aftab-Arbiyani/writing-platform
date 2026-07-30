import { Inject, Injectable } from '@nestjs/common';
import type { AiProvider } from '@qalam/shared';

import { AiProviderNotConfiguredException } from '../ai.exceptions';
import { AI_PROVIDER_ADAPTERS } from './ai-provider.port';
import type { AiProviderAdapter } from './ai-provider.port';

/**
 * Indexes every registered {@link AiProviderAdapter} by provider id and answers
 * "which adapter serves provider X / which providers are actually usable". This
 * is the swap point that makes providers interchangeable through configuration:
 * the orchestrator asks the registry for an adapter by the *resolved* provider
 * enum and never knows which concrete class it got.
 *
 * Adapters arrive via the {@link AI_PROVIDER_ADAPTERS} multi-token, so adding a
 * provider is "register one more class" — no change here.
 */
@Injectable()
export class ProviderRegistryService {
  private readonly byProvider = new Map<AiProvider, AiProviderAdapter>();

  constructor(@Inject(AI_PROVIDER_ADAPTERS) adapters: AiProviderAdapter[]) {
    for (const adapter of adapters) {
      this.byProvider.set(adapter.provider, adapter);
    }
  }

  /** The adapter for a provider, or throws if none is registered. */
  get(provider: AiProvider): AiProviderAdapter {
    const adapter = this.byProvider.get(provider);
    if (adapter === undefined) {
      throw new AiProviderNotConfiguredException(provider);
    }
    return adapter;
  }

  /** Whether a provider has a registered, credential-configured adapter. */
  isConfigured(provider: AiProvider): boolean {
    return this.byProvider.get(provider)?.isConfigured() ?? false;
  }

  /** Providers that ship an adapter implementation (regardless of credentials). */
  implementedProviders(): AiProvider[] {
    return [...this.byProvider.keys()];
  }

  /** Providers whose adapter is present AND has credentials (callable now). */
  configuredProviders(): AiProvider[] {
    return [...this.byProvider.values()]
      .filter((adapter) => adapter.isConfigured())
      .map((adapter) => adapter.provider);
  }
}
