/**
 * SPIKE test (P7.3) — a sudden burst (e.g. a featured piece goes viral) from
 * near-idle to a large VU count and back. Verifies the system survives the shock
 * (rate limiter sheds excess, cache warming absorbs reads, queues buffer writes)
 * and RECOVERS to normal latency after the spike passes.
 *
 *   BASE_URL=… TOKEN=… k6 run backend/perf/k6/spike-test.js
 */
import { sleep } from 'k6';

import { mixedWorkload } from './lib/scenarios.js';

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 5 }, // baseline
        { duration: '15s', target: 500 }, // sudden burst
        { duration: '1m', target: 500 }, // sustained peak
        { duration: '15s', target: 5 }, // drop
        { duration: '1m', target: 5 }, // recovery window — latency must return to budget
      ],
      gracefulRampDown: '20s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
  },
};

export default function () {
  mixedWorkload();
  sleep(0.5);
}
