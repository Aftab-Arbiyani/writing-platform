import { Inject, Injectable } from '@nestjs/common';
import type { PaymentProvider } from '@qalam/shared';

import { PaymentProviderNotConfiguredException } from '../monetization.exceptions';
import { PAYMENT_PROVIDER_ADAPTERS } from './payment-provider.port';
import type { PaymentProviderAdapter } from './payment-provider.port';

/**
 * Resolves a payment provider's adapter by id (AF5) — the single lookup point, mirroring
 * the AI platform's `ProviderRegistryService`. Business services depend on THIS, never on
 * a concrete adapter, so the provider is swappable. A provider whose adapter is missing or
 * unconfigured (blank credentials) throws `PAYMENT_PROVIDER_NOT_CONFIGURED`.
 */
@Injectable()
export class PaymentRegistryService {
  private readonly byProvider: Map<PaymentProvider, PaymentProviderAdapter>;

  constructor(@Inject(PAYMENT_PROVIDER_ADAPTERS) adapters: PaymentProviderAdapter[]) {
    this.byProvider = new Map(adapters.map((adapter) => [adapter.provider, adapter]));
  }

  /** The adapter for a provider, asserting it exists AND is configured. */
  get(provider: PaymentProvider): PaymentProviderAdapter {
    const adapter = this.byProvider.get(provider);
    if (adapter === undefined || !adapter.isConfigured()) {
      throw new PaymentProviderNotConfiguredException(provider);
    }
    return adapter;
  }

  /** The adapter for a provider without the configured-check (webhook parsing/verify). */
  getUnchecked(provider: PaymentProvider): PaymentProviderAdapter | undefined {
    return this.byProvider.get(provider);
  }

  /** Which providers currently have credentials (for the client's provider picker). */
  configuredProviders(): PaymentProvider[] {
    return [...this.byProvider.values()]
      .filter((adapter) => adapter.isConfigured())
      .map((adapter) => adapter.provider);
  }
}
