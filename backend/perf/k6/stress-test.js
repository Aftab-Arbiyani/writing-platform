/**
 * STRESS test (P7.3) — push past expected capacity in steps to find the knee of
 * the curve (where latency/errors break budget) and confirm the system degrades
 * gracefully (rate limiting + queue backpressure absorb the excess) rather than
 * collapsing. Thresholds here are ABORT guards, not pass/fail budgets — a stress
 * test is expected to eventually breach latency.
 *
 *   BASE_URL=… TOKEN=… k6 run backend/perf/k6/stress-test.js
 */
import { sleep } from 'k6';

import { mixedWorkload } from './lib/scenarios.js';

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 400 },
        { duration: '2m', target: 600 }, // beyond the single-instance api.rps ceiling
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Abort if the process starts erroring hard (>25%) — that is collapse, not
    // graceful degradation. Latency is allowed to climb under stress.
    http_req_failed: [{ threshold: 'rate<0.25', abortOnFail: true, delayAbortEval: '1m' }],
  },
};

export default function () {
  mixedWorkload();
  sleep(0.5);
}
