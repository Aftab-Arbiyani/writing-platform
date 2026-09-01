import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AiProvider } from '@qalam/shared';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

import { aiConfig } from '../../config/ai.config';

/**
 * AI-provider health (P7.1). Reports whether the default AI provider has
 * credentials configured — a *readiness* signal, deliberately NOT a live call
 * to the provider (paid, rate-limited, and would make readiness flap on an
 * upstream blip). The AI subsystem is optional, so an unconfigured provider is
 * reported as `inert`, never `down`. A live reachability deep-check is a
 * separate, opt-in operation (see docs) and must never gate `/health/ready`.
 *
 * ## `mode` has three states, not two (AI-2, docs/48 §3.22b)
 *
 * It used to answer `configured ? 'live' : 'inert'`, which **understated a working
 * subsystem**: the stub provider holds no credential by design (its gate is
 * `ai.stub.enabled`, and `ai.config.ts` keeps its `apiKey` permanently blank on
 * purpose), so an E2E or preview stack generating real completions through
 * `StubAdapter` reported itself `inert` — indistinguishable from a stack with no
 * AI at all. An operator reading that would go looking for a missing key.
 *
 * - `live`   — the resolved default provider holds a real credential.
 * - `test`   — the **stub** is the active path: it is the default provider AND
 *              `AI_STUB_ENABLED=true`. Generation works; nothing reaches a vendor.
 * - `inert`  — neither. The subsystem is present but cannot answer.
 *
 * `test` requires BOTH conditions because either alone is still inert: the stub
 * enabled but not selected generates nothing, and selected but not enabled is
 * refused by its own adapter.
 *
 * The payment indicator gained the same vocabulary in the same pass, for the same
 * reason (`payments.manual.enabled`). They are kept identical deliberately — two
 * health fields that mean different things by the same name is worse than either
 * one being coarse.
 */
@Injectable()
export class AiHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(aiConfig.KEY) private readonly config: ConfigType<typeof aiConfig>,
  ) {}

  isHealthy(key: string): HealthIndicatorResult {
    const indicator = this.healthIndicatorService.check(key);
    const provider = this.config.defaultProvider;
    const configured = (this.config.providers[provider]?.apiKey ?? '').length > 0;
    const stubbed = provider === AiProvider.Stub && this.config.stub.enabled;
    return indicator.up({
      defaultProvider: provider,
      configured,
      mode: configured ? 'live' : stubbed ? 'test' : 'inert',
    });
  }
}
