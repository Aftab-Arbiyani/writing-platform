import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

import { paymentsConfig } from '../../config/payments.config';

/**
 * Payment-provider health (P7.1). Reports which billing providers have
 * credentials configured — a readiness signal, not a live call to Stripe/Apple/
 * Google (which would be slow and rate-limited). Billing is optional, so an
 * unconfigured provider is reported as `inert`, never `down`.
 */
@Injectable()
export class PaymentHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(paymentsConfig.KEY) private readonly config: ConfigType<typeof paymentsConfig>,
  ) {}

  isHealthy(key: string): HealthIndicatorResult {
    const indicator = this.healthIndicatorService.check(key);
    const providers = {
      stripe: this.config.stripe.secretKey.length > 0,
      apple: this.config.apple.sharedSecret.length > 0,
      google: this.config.google.serviceAccountKey.length > 0,
    };
    const anyConfigured = providers.stripe || providers.apple || providers.google;
    return indicator.up({ providers, mode: anyConfigured ? 'live' : 'inert' });
  }
}
