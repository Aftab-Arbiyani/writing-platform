import { env } from '@/config/env';

/**
 * The client kill switch for monetization (AF5, W4).
 *
 * Dark by default, mirroring mobile's `QALAM_ENABLE_MONETIZATION`, so neither client becomes
 * reachable ahead of the other. Playwright's `webServer` sets it `true`, so E2E exercises the real
 * surfaces rather than the disabled state.
 *
 * **This is not an authorization input, and it is not the platform switch either.** There are three
 * independent gates and they answer different questions:
 *
 * 1. **this flag** — is the UI offered at all? A client-side kill switch; it can neither grant nor
 *    protect anything.
 * 2. **`feature.payments.enabled`** — is the monetization platform live? Server-side, pre-seeded
 *    OFF, admin-toggleable. Mutating routes answer `MONETIZATION_DISABLED` while it is down; the
 *    read routes keep working, so entitlement gating degrades to "deny" rather than erroring.
 * 3. **the Entitlement Service** — may THIS user use THIS feature? The only real answer, always the
 *    server's, re-checked on every premium action.
 *
 * Flipping this on cannot make a free account premium, and flipping it off cannot stop the server
 * from metering an AI request.
 */
export function isMonetizationEnabled(): boolean {
  return env.VITE_ENABLE_MONETIZATION === 'true';
}
