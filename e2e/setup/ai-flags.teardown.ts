import { resetAiFeatureFlags } from './ai-flags.global';

/**
 * The other end of {@link resetAiFeatureFlags} — see `ai-flags.global.ts` for why the run's boundaries
 * own the flag state rather than trusting every test's `finally` to survive its worker.
 *
 * A separate file because Playwright takes `globalSetup` and `globalTeardown` as two module paths, and
 * a default export cannot be both.
 */
export default async function globalTeardown(): Promise<void> {
  await resetAiFeatureFlags('teardown');
}
