import type { Page } from '@playwright/test';

import type { ApiHelper } from './api';
import { freshLoginAs } from './auth';
import type { DataFactory } from './data';

/**
 * Entitlement arrangement for specs that drive a surface the server gates on a premium code.
 *
 * **Why this exists as a fixture rather than a line in one spec.** D3 (2026-08-17) put both AF2
 * surfaces behind the `ai_writing` entitlement, which the free tier does not include — so the seeded
 * writer every AF2 spec was written for now gets "AI writing is on Plus and above" where the
 * assistant's controls used to be, and every assertion about those controls fails on an element that
 * is not rendered. Two files need the same arrangement (`assistant.spec.ts` and the AI-panel a11y
 * scan), and the next premium-gated surface will need a third.
 *
 * **The suite had not run between D3 landing and 2026-08-20**, so nothing failed at the time. That
 * is the third instance of one pattern — B4's piece cap, B6's seat cap, now D3's entitlement gate —
 * where a limit or gate shipped later silently disarmed the fixtures of specs written before it
 * (48 §3.22c). Worth a standing check whenever a new gate ships: can the suite still arrange?
 */
export interface EntitledWriterContext {
  page: Page;
  api: ApiHelper;
  data: DataFactory;
}

/**
 * Run `body` as a throwaway, verified writer holding an `allow` override for `feature`.
 *
 * An admin OVERRIDE rather than a subscription: it drives the same Entitlement Service and the same
 * snapshot the client gates on, invalidates the server's decision cache on write, and carries no
 * once-per-account state to collide with on a re-run (`api.grantEntitlementOverride`). A throwaway
 * account rather than the seeded writer, so a leaked grant cannot quietly disarm D3's own
 * assertions in another spec — the hazard `feature-flags.ts` guards for flags, in entitlement form.
 *
 * The grant is revoked in a `finally`, and the account is left behind deliberately: the E2E stack is
 * disposable ([09 §4]) and a per-test user costs nothing, while a delete would need the account to
 * be absent from every audit row that now references it.
 */
export async function asEntitledWriter(
  ctx: EntitledWriterContext,
  feature: string,
  body: () => Promise<void>,
): Promise<void> {
  const password = 'ChangeMe!E2EEntitled1';
  const writer = await ctx.api.createVerifiedUser({
    email: `entitled-${ctx.data.username()}@qalam.local`,
    username: ctx.data.username(),
    password,
  });
  const grant = await ctx.api.grantEntitlementOverride({
    userId: writer.id,
    feature,
    reason: `e2e: ${feature} is entitlement-gated`,
  });
  try {
    // Before the first navigation, per `freshLoginAs` — the cookie is what the app boots on.
    await freshLoginAs(ctx.page, writer.email, password);
    await body();
  } finally {
    await ctx.api.revokeEntitlementOverride(grant.id);
  }
}
