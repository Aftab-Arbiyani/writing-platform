import 'reflect-metadata';
import { ERROR_CODES, PERMISSIONS } from '@qalam/shared';

import { PERMISSIONS_KEY } from '../../common/constants/metadata.constants';
import type { AuditService } from '../audit/audit.service';
import type { UsersService } from '../users/users.service';
import { AdminMonetizationController } from './admin-monetization.controller';
import type { BillingService } from './billing.service';
import { CursorQueryDto, GrantOverrideDto, RefundDto } from './dto/monetization-request.dto';
import type { EntitlementService } from './entitlement.service';
import type { MonetizationAnalyticsService } from './monetization-analytics.service';
import type { MonetizationConfigService } from './monetization.config-service';
import type { PromotionService } from './promotion.service';
import type { SubscriptionService } from './subscription.service';

/**
 * The three admin reads B8 added to close A1-3, A1-5 and A1-7 — "show me THIS person's billing",
 * which A1 could not ask because every equivalent is `@CurrentUser` self-scoped.
 *
 * Each is covered three ways, per the row's done-when: the account HAS the thing, the account does
 * not (a free user / an empty wallet / no payments — all normal states here, not errors), and a
 * caller without `billing.manage` is refused. The refusal is asserted as route METADATA rather than
 * by standing up a guard: `PermissionGuard` is the thing that turns that metadata into a 403 and it
 * has its own spec (`permissions/permission.guard.spec.ts`, "denies (403 AUTH_PERMISSION_DENIED)
 * when a required permission is missing"). Re-testing the guard here would prove the guard twice and
 * the ROUTES not at all — the failure mode that actually ships is a handler that forgot the
 * decorator, and that is exactly what this reads.
 */
function permsOf(handler: (...args: never[]) => unknown): unknown {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler);
}

function build(overrides?: {
  subscription?: unknown;
  wallet?: unknown;
  payments?: unknown[];
  /** Defaults to an account that EXISTS — the B8-1 404 is the exception, not the baseline. */
  user?: unknown;
  entitlementOverrides?: unknown[];
}) {
  const billing = {
    listPayments: jest.fn().mockResolvedValue(overrides?.payments ?? []),
    refund: jest.fn().mockResolvedValue({
      id: 'pay-1',
      provider: 'stripe',
      method: 'card',
      status: 'refunded',
      amount: 500,
      currency: 'usd',
      description: null,
      createdAt: new Date('2026-08-31T00:00:00.000Z'),
    }),
  } as unknown as BillingService;
  const subscriptions = {
    findByUser: jest.fn().mockResolvedValue(overrides?.subscription ?? null),
  } as unknown as SubscriptionService;
  const config = {
    getConfig: jest.fn().mockResolvedValue({}),
  } as unknown as MonetizationConfigService;

  const users = {
    findById: jest
      .fn()
      .mockResolvedValue(overrides?.user === undefined ? { id: USER } : overrides.user),
  } as unknown as UsersService;
  const entitlements = {
    listOverrides: jest.fn().mockResolvedValue(overrides?.entitlementOverrides ?? []),
    // A shape the mapper can serialise: `toEntitlementOverrideDto` calls `.toISOString()` on
    // `createdAt`, so a two-field stub rejects before the assertion under test is reached.
    grantOverride: jest.fn().mockResolvedValue({
      id: 'ovr-1',
      userId: USER,
      feature: 'ai_writing',
      effect: 'allow',
      active: true,
      expiresAt: null,
      reason: null,
      createdAt: new Date('2026-08-31T00:00:00.000Z'),
    }),
  } as unknown as EntitlementService;

  const controller = new AdminMonetizationController(
    {} as PromotionService,
    entitlements,
    billing,
    subscriptions,
    config,
    {} as MonetizationAnalyticsService,
    { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    users,
  );
  return { controller, billing, subscriptions, users, entitlements };
}

const USER = '11111111-1111-4111-8111-111111111111';

function query(limit?: number, cursor?: string): CursorQueryDto {
  return Object.assign(new CursorQueryDto(), { limit, cursor });
}

describe('AdminMonetizationController — the B8 account reads require billing.manage', () => {
  const routes: Array<[string, (...args: never[]) => unknown]> = [
    ['users/:userId/subscription', AdminMonetizationController.prototype.userSubscription],
    ['users/:userId/payments', AdminMonetizationController.prototype.userPayments],
  ];

  it.each(routes)('GET %s requires billing.manage', (_name, handler) => {
    expect(permsOf(handler)).toEqual([PERMISSIONS.BillingManage]);
  });

  it('declares the same grant the rest of the controller does', () => {
    // A read that leaked onto a weaker permission than its sibling WRITES would be the whole point
    // of the surface, missed. Compare against a route that shipped in A1 rather than a literal.
    expect(permsOf(AdminMonetizationController.prototype.userPayments)).toEqual(
      permsOf(AdminMonetizationController.prototype.grantOverride),
    );
  });
});

describe('AdminMonetizationController — one user’s subscription (A1-7)', () => {
  it('returns the mapped subscription when the account has one', async () => {
    const { controller } = build({
      subscription: {
        id: 'sub-1',
        tier: 'plus',
        status: 'active',
        interval: 'monthly',
        provider: 'stripe',
        currency: 'usd',
        autoRenew: true,
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
        trialEnd: null,
        gracePeriodEnd: null,
        canceledAt: null,
        scheduledTier: null,
        scheduledInterval: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    });

    const result = await controller.userSubscription(USER);

    expect(result.userId).toBe(USER);
    expect(result.subscription).toMatchObject({
      id: 'sub-1',
      tier: 'plus',
      status: 'active',
      currentPeriodEnd: '2026-09-01T00:00:00.000Z',
    });
  });

  it('answers null for a free account instead of throwing SUBSCRIPTION_NOT_FOUND', async () => {
    // DECISION 0.2. `getByUser` throws for this case and is right to for the account holder; for an
    // operator, "on free" is the platform's commonest state and a 404 would make every client draw
    // an error banner for it. `findByUser` is the read that does not raise.
    const { controller, subscriptions } = build({ subscription: null });

    await expect(controller.userSubscription(USER)).resolves.toEqual({
      userId: USER,
      subscription: null,
    });
    expect(subscriptions.findByUser).toHaveBeenCalledWith(USER);
  });
});

describe('AdminMonetizationController — one user’s payments (A1-5)', () => {
  const row = (id: string, at: string) => ({
    id,
    provider: 'stripe',
    method: 'card',
    status: 'succeeded',
    amount: 1999,
    currency: 'usd',
    description: null,
    createdAt: new Date(at),
  });

  it('pages through listPayments with the module’s cursor idiom', async () => {
    // Over-fetch of limit+1 → the extra row is dropped and becomes the cursor. Same `page` helper
    // the self-scoped ledgers use, so an admin cursor and a user cursor encode identically.
    const { controller, billing } = build({
      payments: [
        row('p1', '2026-08-03T00:00:00.000Z'),
        row('p2', '2026-08-02T00:00:00.000Z'),
        row('p3', '2026-08-01T00:00:00.000Z'),
      ],
    });

    const result = await controller.userPayments(USER, query(2));

    expect(billing.listPayments).toHaveBeenCalledWith(USER, null, 2);
    expect(result.data).toHaveLength(2);
    expect(result.data.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.meta.pagination.hasMore).toBe(true);
    expect(result.meta.pagination.nextCursor).not.toBeNull();
  });

  it('answers an empty page — not an error — for an account that has never paid', async () => {
    const { controller } = build({ payments: [] });

    const result = await controller.userPayments(USER, query());

    expect(result.data).toEqual([]);
    expect(result.meta.pagination).toEqual({ nextCursor: null, hasMore: false, limit: 20 });
  });

  it('decodes a supplied cursor and passes the position down', async () => {
    const { controller, billing } = build({ payments: [] });
    const cursor = Buffer.from(
      JSON.stringify({ k: '2026-08-02T00:00:00.000Z', id: 'p2' }),
      'utf8',
    ).toString('base64url');

    await controller.userPayments(USER, query(20, cursor));

    expect(billing.listPayments).toHaveBeenCalledWith(
      USER,
      { k: '2026-08-02T00:00:00.000Z', id: 'p2' },
      20,
    );
  });
});

describe('AdminMonetizationController — an id that belongs to nobody (B8-1)', () => {
  const reads: Array<[string, (c: AdminMonetizationController) => Promise<unknown>]> = [
    ['users/:userId/subscription', (c) => c.userSubscription(USER)],
    ['users/:userId/payments', (c) => c.userPayments(USER, query())],
    ['overrides/:userId', (c) => c.listOverrides(USER)],
  ];

  it.each(reads)('GET %s 404s USER_NOT_FOUND', async (_name, call) => {
    const { controller } = build({ user: null });

    await expect(call(controller)).rejects.toMatchObject({
      code: ERROR_CODES.USER_NOT_FOUND,
    });
  });

  it.each(reads)('GET %s reads no billing data at all for an unknown id', async (_name, call) => {
    // The existence check comes FIRST, so a mistyped id cannot touch the monetization tables. Not a
    // performance point: it is what keeps the 404 honest — a read that ran and then threw would have
    // the operator's typo appear in whatever the services log.
    const { controller, billing, subscriptions, entitlements } = build({ user: null });

    await expect(call(controller)).rejects.toBeDefined();

    expect(billing.listPayments).not.toHaveBeenCalled();
    expect(subscriptions.findByUser).not.toHaveBeenCalled();
    expect(entitlements.listOverrides).not.toHaveBeenCalled();
  });

  it('still answers null — not 404 — when the account exists and simply has no billing', async () => {
    // The regression this fix could plausibly introduce, asserted directly rather than trusted.
    const { controller } = build({ user: { id: USER }, subscription: null });

    await expect(controller.userSubscription(USER)).resolves.toEqual({
      userId: USER,
      subscription: null,
    });
  });

  it('checks existence through the exported UsersService, by id', async () => {
    const { controller, users } = build();

    await controller.userSubscription(USER);

    expect(users.findById).toHaveBeenCalledWith(USER);
  });

  it('requires billing.manage on the overrides read, like its three siblings', () => {
    // `overrides/:userId` predates B8 and was the fourth read with this defect; it had no coverage
    // here at all, which is why its permission is pinned in the same pass that gave it the 404.
    expect(permsOf(AdminMonetizationController.prototype.listOverrides)).toEqual([
      PERMISSIONS.BillingManage,
    ]);
  });
});

/**
 * **B8-2** (docs/48 §3.22a) — B8-1 gave the READS a 404 for an id that belongs to nobody and
 * deliberately left the writes alone, recording that the three of them needed separate answers
 * rather than one rule applied three times. They did, and these are the answers.
 *
 * The write that takes a `userId` in the BODY asserts existence, because nothing upstream has
 * proven it: granting an override against a mistyped id inserted a row that can never apply and
 * that no screen can list (there is no cross-account override read). It had a sibling —
 * `POST credits/adjust`, whose failure was worse (`grant` MATERIALISED a wallet for nobody) — and
 * D5 removed that route with the rest of the credit economy, which is why only one write is
 * pinned here now.
 *
 * `payments/:id/refund` is keyed by a PAYMENT id instead, and a payment that exists already carries
 * a real `userId` — so it asserts nothing, and that absence is pinned below so a later pass does not
 * "fix" it into a redundant query.
 */
describe('AdminMonetizationController — writes against an id that belongs to nobody (B8-2)', () => {
  const actor = { id: 'admin-1' } as never;
  const req = { ip: '127.0.0.1', headers: {} } as never;

  function grantDto(): GrantOverrideDto {
    return Object.assign(new GrantOverrideDto(), {
      userId: USER,
      feature: 'ai_writing',
      effect: 'allow',
    });
  }

  it('POST overrides 404s USER_NOT_FOUND and writes nothing', async () => {
    const { controller, entitlements } = build({ user: null });

    await expect(controller.grantOverride(actor, req, grantDto())).rejects.toMatchObject({
      code: ERROR_CODES.USER_NOT_FOUND,
    });
    // The row is what the defect was: an insert nothing can read back.
    expect(entitlements.grantOverride).not.toHaveBeenCalled();
  });

  it('the write still works for an account that exists', async () => {
    // The regression the fix could plausibly introduce, asserted directly rather than trusted.
    const { controller, entitlements } = build();

    await expect(controller.grantOverride(actor, req, grantDto())).resolves.toBeDefined();
    expect(entitlements.grantOverride).toHaveBeenCalled();
  });

  it('refund does NOT look the user up — the payment id already proves the account', async () => {
    const { controller, users, billing } = build();

    await controller.refund(actor, req, 'ffffffff-ffff-4fff-8fff-ffffffffffff', new RefundDto());

    expect(users.findById).not.toHaveBeenCalled();
    expect(billing.refund).toHaveBeenCalled();
  });
});
