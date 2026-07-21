/**
 * SOAK test (P7.3) — moderate load held for a long duration to surface slow
 * resource leaks: growing heap (memory budget), climbing event-loop lag, cache
 * hit-ratio decay, connection-pool exhaustion, or queue backlog that only
 * appears over hours. Watch `/admin/performance/report` + `/metrics`
 * (`perf_heap_used_bytes`, `perf_event_loop_lag_seconds`) across the run.
 *
 *   BASE_URL=… TOKEN=… k6 run backend/perf/k6/soak-test.js   # default ~1h
 */
import { sleep } from 'k6';

import { BUDGET_THRESHOLDS } from './lib/config.js';
import { mixedWorkload } from './lib/scenarios.js';

/* global __ENV */ // k6 runtime global (scripts run under the k6 binary, not Node).
const SOAK_MINUTES = __ENV.SOAK_MINUTES || '60';

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: 40,
      duration: `${SOAK_MINUTES}m`,
    },
  },
  thresholds: BUDGET_THRESHOLDS,
};

export default function () {
  mixedWorkload();
  sleep(2);
}
