import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
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
    return indicator.up({
      defaultProvider: provider,
      configured,
      mode: configured ? 'live' : 'inert',
    });
  }
}
