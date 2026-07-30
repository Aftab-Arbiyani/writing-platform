/**
 * LOAD test (P7.3) — sustained, realistic traffic at the expected steady-state
 * volume. Verifies the platform holds its latency + error budgets under normal
 * load. Ramps to a plateau, holds, ramps down.
 *
 *   BASE_URL=… TOKEN=… k6 run backend/perf/k6/load-test.js
 */
import { sleep } from 'k6';

import { BUDGET_THRESHOLDS } from './lib/config.js';
import { mixedWorkload } from './lib/scenarios.js';

export const options = {
  scenarios: {
    steady: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 }, // ramp up
        { duration: '5m', target: 50 }, // hold at expected steady-state
        { duration: '1m', target: 0 }, // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: BUDGET_THRESHOLDS,
};

export default function () {
  mixedWorkload();
  sleep(1);
}
