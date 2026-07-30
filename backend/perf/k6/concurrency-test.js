/**
 * CONCURRENCY test (P7.3) — many simultaneous clients hammering the SAME hot
 * resources to exercise the concurrency-safety machinery: cache single-flight
 * stampede lock, idempotent publish, engagement counter transactions, and queue
 * worker concurrency. A fixed, high arrival rate (not a ramp) makes contention
 * the variable under test.
 *
 *   BASE_URL=… TOKEN=… PIECE_ID=… k6 run backend/perf/k6/concurrency-test.js
 */
import { sleep } from 'k6';

import { readingFlow, searchFlow } from './lib/scenarios.js';

export const options = {
  scenarios: {
    hot_reads: {
      executor: 'constant-arrival-rate',
      rate: 300, // requests started per timeUnit
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 100,
      maxVUs: 400,
    },
  },
  thresholds: {
    // Under heavy concurrent access to hot keys, cache stampede prevention must
    // keep p95 within budget and errors near zero.
    http_req_duration: ['p(95)<400'],
    http_req_failed: ['rate<0.02'],
  },
};

export default function () {
  readingFlow();
  searchFlow();
  sleep(0.2);
}
