/**
 * Side-effect module that resolves container/file-mounted secrets into
 * `process.env` at the earliest possible point (P7.1 "Secret Injection").
 * Imported FIRST by `main.ts` (before `./instrument` and before Nest boots)
 * so Sentry init, env validation and every config namespace see the resolved
 * values. The result is captured so `main.ts` can log which secret *names* were
 * loaded once the structured logger is up (values are never logged).
 */
import { loadContainerSecrets } from './load-secrets';

export const containerSecrets = loadContainerSecrets();
