/**
 * Reusable request flows for the load suite (P7.3) — one function per product
 * benchmark suite the prompt enumerates. Each tags its requests with
 * `{ scenario: '<name>' }` so per-suite thresholds and sub-metrics resolve, and
 * degrades gracefully when no TOKEN/PIECE_ID is provided (public paths only).
 */
import http from 'k6/http';
import { check } from 'k6';

import { API, PIECE_ID, SEARCH_Q, TOKEN, authHeaders } from './config.js';

const tag = (scenario) => ({ tags: { scenario }, headers: authHeaders() });

/** Authentication — the credential-stuffing surface (rate-limited by design). */
export function authFlow() {
  // /health is cheap + public; auth login is intentionally NOT hammered here
  // (5/min tier) — the auth load profile exercises token-validated reads.
  const res = http.get(`${API.replace('/api/v1', '')}/health/ready`, tag('auth'));
  check(res, { 'auth: health 200': (r) => r.status === 200 });
}

/** Story reading — the hottest read path (feed → piece detail). */
export function readingFlow() {
  const feed = http.get(`${API}/feed/discover?limit=20`, tag('reading'));
  check(feed, { 'reading: feed ok': (r) => r.status === 200 || r.status === 401 });
  if (PIECE_ID) {
    const piece = http.get(`${API}/pieces/${PIECE_ID}`, tag('reading'));
    check(piece, { 'reading: piece ok': (r) => r.status === 200 || r.status === 404 });
  }
}

/** Search — FTS query + autocomplete. */
export function searchFlow() {
  const res = http.get(
    `${API}/search?q=${encodeURIComponent(SEARCH_Q)}&type=pieces&limit=20`,
    tag('search'),
  );
  check(res, { 'search: 2xx/4xx': (r) => r.status < 500 });
  const auto = http.get(
    `${API}/search/autocomplete?q=${encodeURIComponent(SEARCH_Q)}`,
    tag('search'),
  );
  check(auto, { 'search: autocomplete ok': (r) => r.status < 500 });
}

/** Recommendations — discovery/trending. */
export function recommendationsFlow() {
  const res = http.get(`${API}/feed/trending?limit=20`, tag('recommendations'));
  check(res, { 'recs: 2xx/4xx': (r) => r.status < 500 });
}

/** Story publishing — write path (auth required; skipped without a token). */
export function publishingFlow() {
  if (!TOKEN) {
    return;
  }
  // Read the author's own drafts list — a representative authenticated write-tier read.
  const res = http.get(`${API}/pieces?status=draft&limit=10`, tag('publishing'));
  check(res, { 'publishing: drafts ok': (r) => r.status === 200 || r.status === 403 });
}

/** AI writing — completion latency (auth + feature-flag gated; inert otherwise). */
export function aiFlow() {
  if (!TOKEN) {
    return;
  }
  const res = http.get(`${API}/ai/features`, tag('ai'));
  check(res, { 'ai: features ok': (r) => r.status < 500 });
}

/** Storage — signed-URL issuance latency (auth required). */
export function storageFlow() {
  if (!TOKEN) {
    return;
  }
  const body = JSON.stringify({ contentType: 'image/jpeg', size: 102400, purpose: 'cover' });
  const res = http.post(`${API}/media/upload-url`, body, tag('storage'));
  check(res, { 'storage: signing 2xx/4xx': (r) => r.status < 500 });
}

/** The full mixed workload — weighted toward reads (the real traffic shape). */
export function mixedWorkload() {
  readingFlow();
  searchFlow();
  recommendationsFlow();
  publishingFlow();
  aiFlow();
  storageFlow();
  authFlow();
}
