import { env } from '@/config/env';

/**
 * The client kill switch for collaboration (AF6, W3 — docs/49 §2.2).
 *
 * Dark by default, mirroring mobile's compile-time `QALAM_ENABLE_COLLABORATION`, so neither client
 * becomes reachable ahead of the other. Playwright's `webServer` sets it `true`, so E2E exercises
 * the real surface rather than the disabled state.
 *
 * **This is not an authorization input.** The server decides every read and write through the Policy
 * Engine (whose own `feature.collaboration.enabled` master flag fails open); flipping this on cannot
 * grant a viewer anything, and flipping it off cannot protect anything. It only decides whether the
 * UI is offered.
 */
export function isCollaborationEnabled(): boolean {
  return env.VITE_ENABLE_COLLABORATION === 'true';
}
