import { Injectable } from '@nestjs/common';

import { CHAOS_BY_ID, CHAOS_SCENARIOS } from './chaos.catalog';
import type { ChaosScenario } from '../operations.types';

/**
 * Chaos-readiness service (P7.4) — serves the declarative chaos-scenario
 * catalogue: the failure modes the architecture is prepared for and the EXISTING
 * mechanism that absorbs each. It executes nothing (fault injection is an
 * out-of-band drill); it documents resilience so the readiness of each mitigation
 * is queryable. Business architecture is untouched.
 */
@Injectable()
export class ChaosService {
  /** Every chaos scenario the architecture is prepared for. */
  list(): readonly ChaosScenario[] {
    return CHAOS_SCENARIOS;
  }

  /** One scenario by id (null when absent). */
  get(id: string): ChaosScenario | null {
    return CHAOS_BY_ID.get(id) ?? null;
  }
}
