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
 *
 * ## `mode` has three states, not two (AI-2, docs/48 §3.22b)
 *
 * It used to ignore `payments.manual.enabled` entirely, which **understated a
 * working subsystem**: the manual provider settles a charge with no processor and
 * holds no credential by design, so a preview or E2E stack taking real payments
 * through `ManualAdapter` reported `inert` — the same answer as a stack that
 * cannot bill at all.
 *
 * - `live`   — at least one real processor credential is present.
 * - `test`   — no processor, but `PAYMENTS_MANUAL_ENABLED=true`, so charges settle.
 * - `inert`  — neither.
 *
 * A real credential outranks manual: if both are present the processor is what a
 * customer's money actually goes through, and that is what an operator needs to
 * see. Deliberately the same vocabulary and the same precedence as
 * `AiHealthIndicator` — the two were changed together (the register's row said
 * "both indicators, or neither") because two health fields meaning different
 * things under the same name is worse than either being coarse.
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
    const manual = this.config.manual.enabled;
    return indicator.up({
      providers,
      manual,
      mode: anyConfigured ? 'live' : manual ? 'test' : 'inert',
    });
  }
}
