import { Injectable, type OnModuleInit } from '@nestjs/common';

import { PolicyEngineService } from '../policy';
import type { TrustContext, TrustStatusPort } from '../policy/policy.types';

import { TrustService } from './trust.service';

/**
 * The Trust Platform's adapter for the Policy Engine's Trust port (AF6). It
 * self-registers with the engine at bootstrap so the engine has NO compile-time
 * dependency on this module (no cycle); it merely delegates the two port
 * questions — a user's trust context and whether two users are blocked — to
 * {@link TrustService}.
 */
@Injectable()
export class TrustStatusService implements TrustStatusPort, OnModuleInit {
  constructor(
    private readonly engine: PolicyEngineService,
    private readonly trust: TrustService,
  ) {}

  onModuleInit(): void {
    this.engine.registerTrustPort(this);
  }

  getTrustContext(userId: string): Promise<TrustContext> {
    return this.trust.resolveTrustContext(userId);
  }

  isInteractionBlocked(a: string, b: string): Promise<boolean> {
    return this.trust.isInteractionBlocked(a, b);
  }
}
