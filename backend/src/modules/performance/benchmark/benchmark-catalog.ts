/**
 * Deterministic benchmark scenarios (P7.3). Each scenario is a PURE, in-process
 * closure over a reusable hot-path primitive — no I/O, no wall-clock in the
 * measured path — so results are repeatable run-to-run and gate regressions.
 * The named product suites the prompt enumerates (authentication, story-reading,
 * publishing, search, …) are exercised end-to-end by the k6 load scripts in
 * `backend/perf/`; these micro-benchmarks cover the shared primitives those
 * flows lean on (cursor codec, envelope serialization, permission resolution,
 * token estimation, prompt rendering, percentile math).
 *
 * Scenarios are assembled by an ordered factory (mirroring the policy engine's
 * `buildPolicyRules`), so adding one is adding an entry — never touching the
 * runner.
 */
import { decodeCursor, encodeCursor } from '../../../common/pagination/cursor.util';
import { statsFromSamples } from '../collector/performance-registry.service';
import { BENCHMARK_SCENARIO } from '../performance.constants';

/** A single deterministic benchmark: a pure function run N times by the runner. */
export interface BenchmarkScenario {
  readonly id: string;
  readonly label: string;
  /** One unit of work; must be pure and allocation-representative of the hot path. */
  run(): void;
}

const SAMPLE_TEXT =
  'قلم — the pen. A premium writing sanctuary for Hindi and Urdu writers. '.repeat(8);

const SAMPLE_ENVELOPE = {
  success: true,
  data: {
    id: '018f5a2b-6c1d-7e2f-8a90-1b2c3d4e5f60',
    title: 'ग़ज़ल',
    wordCount: 1240,
    readingTimeSeconds: 372,
    tags: ['poetry', 'urdu', 'ghazal'],
    stats: { claps: 42, likes: 108, bookmarks: 17 },
  },
  meta: { pagination: { nextCursor: null, hasMore: false, limit: 20 } },
};

const SAMPLE_PERMISSIONS = new Set([
  'admin.dashboard',
  'analytics.view',
  'piece.read',
  'piece.write',
  'billing.use',
]);

/** Wildcard-aware permission check (mirrors the shared `permissionSatisfies`). */
function resolvePermission(required: string): boolean {
  if (SAMPLE_PERMISSIONS.has('*')) {
    return true;
  }
  if (SAMPLE_PERMISSIONS.has(required)) {
    return true;
  }
  const scope = `${required.split('.')[0]}.*`;
  return SAMPLE_PERMISSIONS.has(scope);
}

/** char/4 token heuristic (mirrors the AI token pre-counter). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** `{{var}}` template render (mirrors the prompt renderer's substitution). */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => vars[key] ?? '');
}

const PERCENTILE_SAMPLE = Array.from({ length: 500 }, (_v, i) => (i % 97) + (i % 13) * 0.5);

/** Build the ordered scenario list (the SSOT for micro-benchmarks). */
export function buildBenchmarkScenarios(): readonly BenchmarkScenario[] {
  return [
    {
      id: BENCHMARK_SCENARIO.CursorEncode,
      label: 'Cursor encode/decode (keyset pagination)',
      run: () => {
        const cursor = encodeCursor({
          k: '2026-07-21T00:00:00.000Z',
          id: '018f5a2b-6c1d-7e2f-8a90-1b2c3d4e5f60',
        });
        decodeCursor(cursor);
      },
    },
    {
      id: BENCHMARK_SCENARIO.ResponseEnvelope,
      label: 'Response envelope serialize',
      run: () => {
        JSON.parse(JSON.stringify(SAMPLE_ENVELOPE));
      },
    },
    {
      id: BENCHMARK_SCENARIO.PermissionResolve,
      label: 'Permission resolve (PBAC)',
      run: () => {
        resolvePermission('piece.write');
        resolvePermission('analytics.view');
        resolvePermission('moderation.review');
      },
    },
    {
      id: BENCHMARK_SCENARIO.TokenEstimate,
      label: 'AI token estimate',
      run: () => {
        estimateTokens(SAMPLE_TEXT);
      },
    },
    {
      id: BENCHMARK_SCENARIO.PromptRender,
      label: 'AI prompt template render',
      run: () => {
        renderTemplate('Improve the {{tone}} of this {{language}} passage: {{text}}', {
          tone: 'lyrical',
          language: 'Urdu',
          text: SAMPLE_TEXT,
        });
      },
    },
    {
      id: BENCHMARK_SCENARIO.LatencyPercentile,
      label: 'Latency percentile computation',
      run: () => {
        statsFromSamples(PERCENTILE_SAMPLE, PERCENTILE_SAMPLE.length, 0);
      },
    },
  ];
}
