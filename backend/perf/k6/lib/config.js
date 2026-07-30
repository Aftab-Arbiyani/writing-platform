/**
 * Shared k6 configuration for the Qalam load-testing suite (P7.3).
 *
 * Thresholds are the SAME numbers as the server-side performance budget
 * catalogue (`backend/src/modules/performance/performance.constants.ts`) so a
 * load test and the live budget verification agree on "fast enough". Keep the
 * two in sync — the budget catalogue is the source of truth; these mirror it.
 *
 * Usage: `BASE_URL=https://api.qalam.example TOKEN=<jwt> k6 run load-test.js`
 * (see backend/perf/README.md). No secrets are committed here.
 */

/* global __ENV */ // k6 runtime global (scripts run under the k6 binary, not Node).

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
export const API = `${BASE_URL}/api/v1`;

/** Optional bearer token for authenticated flows (else only public paths run). */
export const TOKEN = __ENV.TOKEN || '';

/** A search term and a piece id the target env is known to have (overridable). */
export const SEARCH_Q = __ENV.SEARCH_Q || 'ghazal';
export const PIECE_ID = __ENV.PIECE_ID || '';

/** Budget-derived thresholds (mirror PERFORMANCE_BUDGETS). */
export const BUDGET_THRESHOLDS = {
  // api.latency.p95 = 400ms, api.latency.p99 = 1000ms, api.error_rate = 1%.
  http_req_duration: ['p(95)<400', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
  // search.query.p95 = 500ms (tagged sub-metric).
  'http_req_duration{scenario:search}': ['p(95)<500'],
  // ai.completion.p95 = 15000ms.
  'http_req_duration{scenario:ai}': ['p(95)<15000'],
  // storage.signing.p95 = 300ms.
  'http_req_duration{scenario:storage}': ['p(95)<300'],
};

export function authHeaders() {
  const headers = { 'Content-Type': 'application/json', 'X-Client': 'perf' };
  if (TOKEN) {
    headers.Authorization = `Bearer ${TOKEN}`;
  }
  return headers;
}
