import { request } from '@playwright/test';

import { assertNotStalePreview } from './stale-preview.global';

/**
 * Force every AI feature flag back to its **seeded, dark** state — once before the run, once after.
 *
 * **Why the mutex is not enough.** `fixtures/feature-flags.ts` raises flags under a lock and restores
 * them in a `finally` on its own request context, which survives Playwright tearing a test's context
 * down. What it cannot survive is the worker PROCESS dying — a kill, an OOM, a `Ctrl-C` — because then
 * no `finally` runs at all. A raised `feature.ai.enabled` then outlives the run, and the next run's
 * flag-down assertions fail for a reason that has nothing to do with the code under test: the surfaces
 * really do offer AI. That happened on the first WebKit run of this suite (two spec failures, three
 * attempts each, while the flags sat raised from a worker that had died earlier in the same run).
 *
 * So the run's boundaries assert the documented starting state instead of hoping for it. AF1 seeds
 * every `feature.ai.*` flag DISABLED and that is every deployment's contract, so "dark" is not a
 * preference of this suite — it is what the platform ships, and it is what the majority of these specs
 * assert. A flag that some other tool deliberately raised on this stack is therefore also reset; the
 * E2E stack is disposable by [09 §4](../../docs/e2e/09_DataSafetyGuardrails.md), and a suite that
 * quietly inherits someone else's flag state cannot be trusted.
 *
 * Every write is logged, so an unexpected reset is visible rather than silent.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@qalam.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe!SuperAdmin1';

interface FlagRow {
  readonly id: string;
  readonly key: string;
  readonly enabled: boolean;
  readonly rolloutPercentage: number;
}

/** Envelope unwrap; `null` on any failure — see {@link resetAiFeatureFlags} for why this is soft. */
async function unwrap<T>(res: {
  ok: () => boolean;
  json: () => Promise<unknown>;
}): Promise<T | null> {
  if (!res.ok()) return null;
  const body = (await res.json()) as { success?: boolean; data?: T };
  return body.success === true && body.data !== undefined ? body.data : null;
}

/**
 * Reset the flags. **Deliberately soft**: a failure here logs and returns rather than throwing.
 *
 * As `globalSetup` a throw would abort the whole run before a single test spoke, and the most likely
 * cause of failure is a stack that is not up yet — which the first spec reports far more legibly than
 * a global hook can. As `globalTeardown` a throw would turn a green run red after the fact.
 */
export async function resetAiFeatureFlags(phase: 'setup' | 'teardown'): Promise<void> {
  const context = await request.newContext();
  try {
    const login = await context.post(`${API_URL}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const session = await unwrap<{ accessToken: string }>(login);
    if (!session) {
      console.warn(`[ai-flags:${phase}] could not authenticate as admin — leaving flags untouched`);
      return;
    }
    const headers = { Authorization: `Bearer ${session.accessToken}` };

    const list = await context.get(`${API_URL}/admin/feature-flags`, { headers });
    const flags = await unwrap<FlagRow[]>(list);
    if (!flags) {
      console.warn(
        `[ai-flags:${phase}] could not read the flag catalogue — leaving flags untouched`,
      );
      return;
    }

    const raised = flags.filter(
      (flag) => flag.key.startsWith('feature.ai') && (flag.enabled || flag.rolloutPercentage > 0),
    );
    if (raised.length === 0) return;

    for (const flag of raised) {
      const res = await context.patch(`${API_URL}/admin/feature-flags/${flag.id}`, {
        headers,
        data: { enabled: false, rolloutPercentage: 0 },
      });

      console.warn(
        `[ai-flags:${phase}] reset ${flag.key} (was enabled=${String(flag.enabled)} rollout=${String(flag.rolloutPercentage)}) → ${String(res.status())}`,
      );
    }
  } finally {
    await context.dispose();
  }
}

export default async function globalSetup(): Promise<void> {
  /**
   * T-9's residual, checked FIRST and deliberately hosted here: Playwright allows one `globalSetup`,
   * and this runs before `webServer` starts — so anything already on :5173 is something a human
   * started, which is exactly the case the check is for. See `stale-preview.global.ts`.
   */
  await assertNotStalePreview();
  await resetAiFeatureFlags('setup');
}
