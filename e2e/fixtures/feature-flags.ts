import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { request } from '@playwright/test';

import { ApiHelper } from './api';

/**
 * A cross-worker mutex for the **AI feature flags** (docs/e2e/06 §6).
 *
 * **Why a lock and not `test.describe.serial`.** The AI flags are single GLOBAL rows
 * (`feature.ai.enabled` + one per feature) and the suite runs `fullyParallel` across 8 workers.
 * `describe.serial` orders tests *within one file*, which was enough while `assistant.spec.ts` was
 * the only file that touched them. W5 adds three more surfaces gated on the same master row — AI
 * search, the discover shelves, and the reader's recommender — so the contenders now span files, and
 * no `describe` modifier can order across them. Run unlocked, the failure is the confusing kind the
 * assistant spec warns about: "AI is turned off" appearing in a test that just enabled it, or a
 * flag-down assertion failing because a neighbour raised the master flag mid-flight.
 *
 * Two kinds of test must participate, and both take the SAME lock:
 *
 * - a test that **raises** flags ({@link withAiFeatures}) — it mutates shared state;
 * - a test that asserts the **flag-down** contract, or screenshots a flag-dependent surface
 *   ({@link withAiFlags}) — it depends on nobody else having raised them.
 *
 * A test that is genuinely flag-independent (the panel opens either way; an anonymous reader can
 * never reach an AF4 route) needs neither and stays fully parallel.
 *
 * The lock is a **directory**, because `mkdir` is atomic on every platform this runs on: the winner
 * creates it, everyone else gets `EEXIST` and waits. A holder file inside names who took it, so a
 * timeout says which test to look at rather than just "timed out".
 */

/** Under `e2e/.stack/` — already gitignored local run state, alongside the stack pid/log files. */
const LOCK_DIR = fileURLToPath(new URL('../.stack/ai-flags.lock', import.meta.url));
const HOLDER_FILE = `${LOCK_DIR}/holder`;

/** Long enough for a queue of flag tests (each ≤ ~1 min), short enough to fail before the CI job. */
const ACQUIRE_TIMEOUT_MS = 300_000;
const POLL_MS = 200;
/**
 * A lock older than this is assumed abandoned (a worker killed mid-test, a `Ctrl-C`, an OOM) and is
 * broken rather than waited out. It must exceed the slowest legitimate hold — the streaming assistant
 * test is the longest at well under a minute — or a slow test would have its lock stolen.
 */
const STALE_MS = 180_000;

mkdirSync(dirname(LOCK_DIR), { recursive: true });

/**
 * The test timeout every lock-taking test must adopt (`test.setTimeout` or
 * `test.describe.configure({ timeout })`).
 *
 * **Because the queue wait is spent inside the test.** Playwright's clock starts when the test does,
 * so a test parked on {@link withAiFlags} is burning its own 30 s default while another worker holds
 * the flags — it would fail as a timeout without ever having run an assertion. Every AI-flag test in
 * the suite (functional, a11y in both themes, and the two flag-dependent visual baselines) shares one
 * lock, so the worst-case wait is the sum of the others, not a constant.
 *
 * A large budget costs nothing when there is no contention: a test that gets the lock immediately
 * still finishes in seconds. It only prevents the false red.
 */
export const AI_FLAG_TEST_TIMEOUT_MS = 240_000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function holder(): string {
  try {
    return readFileSync(HOLDER_FILE, 'utf8');
  } catch {
    return 'unknown';
  }
}

function ageMs(): number {
  try {
    return Date.now() - statSync(LOCK_DIR).mtimeMs;
  } catch {
    // Gone between the EEXIST and the stat — treat as fresh; the next attempt will win it.
    return 0;
  }
}

function release(): void {
  rmSync(LOCK_DIR, { recursive: true, force: true });
}

async function acquire(label: string): Promise<void> {
  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;
  for (;;) {
    try {
      // recursive:false is the point — it must FAIL when the directory already exists.
      mkdirSync(LOCK_DIR);
      writeFileSync(HOLDER_FILE, `${label} (pid ${process.pid})`);
      return;
    } catch {
      const held = holder();
      if (ageMs() > STALE_MS) {
        console.warn(`[ai-flags] breaking a stale lock held by ${held}`);
        release();
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(
          `[ai-flags] "${label}" waited ${String(ACQUIRE_TIMEOUT_MS / 1000)}s for the AI feature-flag lock, held by ${held}`,
        );
      }
      await sleep(POLL_MS);
    }
  }
}

/**
 * Run `body` holding the AI feature-flag lock, changing nothing.
 *
 * For tests that assert the **dark-launched** contract (every deployment's starting state) or
 * snapshot a surface whose appearance depends on it: holding the lock is what makes "the flags are
 * down" true for the duration rather than merely likely.
 */
export async function withAiFlags<T>(label: string, body: () => Promise<T>): Promise<T> {
  await acquire(label);
  try {
    return await body();
  } finally {
    release();
  }
}

/**
 * Raise the AI master flag plus `featureFlagKeys` for the duration of `body`, then restore all of
 * them to exactly what they were — under the lock, so no parallel test observes the raised state.
 *
 * **The flag calls deliberately do NOT use the test's `api` fixture.** They run on a standalone
 * `APIRequestContext` created here, because the restore must survive the test dying. The first live
 * run of this row proved why: the AI-search test exceeded the default 30 s test timeout, Playwright
 * tore its context down, and the `finally` then failed with "Target page, context or browser has been
 * closed" — leaving `feature.ai.enabled` **raised**. Every flag-down assertion after it (this file's,
 * discover's, and `assistant.spec.ts`'s two) then failed for a reason that had nothing to do with the
 * code under test: the search page really did render AI results. A context of our own outlives the
 * fixture, so a timeout costs one test rather than the run.
 *
 * A leaked raised flag is the worst failure this suite can produce: it changes the starting state
 * every later spec observes and quietly invalidates the flag-down assertions that are the majority of
 * its AI coverage — so the restore is treated as more important than the test's own verdict.
 */
export async function withAiFeatures<T>(
  featureFlagKeys: string[],
  label: string,
  body: () => Promise<T>,
): Promise<T> {
  return withAiFlags(label, async () => {
    const context = await request.newContext();
    const api = new ApiHelper(context);
    const previous = await api.enableAiFeatures(featureFlagKeys);
    try {
      return await body();
    } finally {
      // Best-effort but loud: if even this cannot restore the flags, the run's later flag-down
      // assertions are compromised and the log has to say so rather than fail them mysteriously.
      try {
        await api.restoreFeatureFlags(previous);
      } catch (error) {
        console.error(
          `[ai-flags] FAILED to restore ${featureFlagKeys.join(', ')} after "${label}" — later flag-down assertions in this run are unreliable:`,
          error,
        );
      }
      await context.dispose();
    }
  });
}
