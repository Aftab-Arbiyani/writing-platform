import { request } from '@playwright/test';

/**
 * Refuse to run against a hand-started `vite preview` on a local box — **T-9's residual**
 * (docs/48 §3.5, carried in §3.22c until 2026-08-24).
 *
 * **The trap.** Locally `reuseExistingServer` is true, so Playwright ATTACHES to whatever is already
 * on :5173 instead of starting the `dev` server whose `webServer.env` carries
 * `VITE_ENABLE_COLLABORATION` / `VITE_ENABLE_MONETIZATION`. A developer who started `vite preview` by
 * hand is served `frontend/dist` from disk — and a plain root `pnpm build` overwrites that dist with a
 * DEFAULT-FLAG bundle. The suite then tests an app with collaboration and monetization off.
 *
 * **Why it earns a hard failure rather than a note.** The symptom is maximally misleading: ~40 specs
 * fail inside their page object's `goto()` on a heading that never appears, because the page really
 * did render — as "Collaboration is off". It reads as a broken selector or a broken route, it
 * reproduces on a clean tree, and a `git stash` bisect therefore "confirms" the failure is
 * pre-existing. It cost an hour once and would cost it again.
 *
 * **How it tells the two apart.** Vite's dev server serves an HTML shell that loads
 * `/src/main.tsx` (and injects `/@vite/client`); a `preview` build serves hashed asset URLs and no
 * source path. That distinction needs one request and no browser.
 *
 * Skipped under CI, where `preview` is the CORRECT server and the flags are passed explicitly
 * (`web-e2e.yml`). Also skipped when `E2E_ALLOW_PREVIEW=1`, for the one legitimate local case: driving
 * the apps from the host while the pinned Docker image runs the visual job.
 */
const FRONTEND_URL = process.env.E2E_BASE_URL_FRONTEND ?? 'http://localhost:5173';

export async function assertNotStalePreview(): Promise<void> {
  if (process.env.CI) return;
  if (process.env.E2E_ALLOW_PREVIEW === '1') return;

  const context = await request.newContext();
  try {
    const res = await context.get(FRONTEND_URL, { timeout: 10_000 });
    if (!res.ok()) return; // Not up yet — Playwright's own webServer wait owns that failure.
    const html = await res.text();

    // The dev server's fingerprint. Absent → we are attached to a built bundle.
    if (html.includes('/src/main.tsx') || html.includes('/@vite/client')) return;

    throw new Error(
      [
        `[stale-preview] ${FRONTEND_URL} is serving a BUILT bundle, not the Vite dev server.`,
        '',
        'A local run expects `pnpm --filter frontend dev` (started by Playwright), because only that',
        'reads the webServer.env block carrying VITE_ENABLE_COLLABORATION / VITE_ENABLE_MONETIZATION.',
        'Attached to a `vite preview` instead, the suite tests an app with those features OFF — and',
        'the failure surfaces ~40 specs later as "the heading never appeared", not as a build problem.',
        'This is docs/48 §3.5 (T-9).',
        '',
        'Fix: stop the hand-started preview on :5173 and re-run, so Playwright starts `dev` itself.',
        'If you genuinely mean to drive a built bundle (e.g. the pinned-image visual job), re-run with',
        'E2E_ALLOW_PREVIEW=1.',
      ].join('\n'),
    );
  } finally {
    await context.dispose();
  }
}
