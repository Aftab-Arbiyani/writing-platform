import 'reflect-metadata';
import { PERMISSIONS } from '@qalam/shared';

import { PERMISSIONS_KEY } from '../../common/constants/metadata.constants';

import { TrustAdminController } from './trust.admin.controller';

/**
 * The permission split on the admin Trust surface, including the two routes B9 added to
 * close A2-2 — `GET users/:id/strikes` and `DELETE strikes/:id`.
 *
 * The reads are `trust.view`, every mutation is `trust.manage`, and the interesting one
 * is the new revoke: a `trust.view`-only caller must be refused. That refusal is
 * asserted as route METADATA rather than by standing up a guard, on the B8 precedent
 * (`admin-monetization.controller.spec.ts`): `PermissionGuard` is what turns this
 * metadata into a 403 and it has its own spec, so re-testing it here would prove the
 * guard twice and the ROUTES not at all. The failure mode that actually ships is a
 * handler that forgot the decorator — which is exactly what this reads.
 */
function permsOf(handler: (...args: never[]) => unknown): unknown {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler);
}

describe('TrustAdminController — trust.view reads, trust.manage mutations', () => {
  const reads: Array<[string, (...args: never[]) => unknown]> = [
    ['GET users/:id/trust', TrustAdminController.prototype.summary],
    ['GET users/:id/restrictions', TrustAdminController.prototype.restrictions],
    ['GET users/:id/strikes', TrustAdminController.prototype.strikes],
  ];

  const mutations: Array<[string, (...args: never[]) => unknown]> = [
    ['POST users/:id/strikes', TrustAdminController.prototype.issueStrike],
    ['POST users/:id/restrictions', TrustAdminController.prototype.applyRestriction],
    ['DELETE restrictions/:id', TrustAdminController.prototype.liftRestriction],
    ['DELETE strikes/:id', TrustAdminController.prototype.revokeStrike],
  ];

  it.each(reads)('%s requires trust.view', (_route, handler) => {
    expect(permsOf(handler)).toEqual([PERMISSIONS.TrustView]);
  });

  it.each(mutations)('%s requires trust.manage', (_route, handler) => {
    expect(permsOf(handler)).toEqual([PERMISSIONS.TrustManage]);
  });

  it('does NOT accept trust.view on the strike revoke (A2-2)', () => {
    // Stated separately from the table because it is the row's done-when: the read half
    // of A2-2 is deliberately available to a moderator who may only look, and the revoke
    // half deliberately is not.
    const revokePerms = permsOf(TrustAdminController.prototype.revokeStrike);
    expect(revokePerms).not.toContain(PERMISSIONS.TrustView);
    expect(revokePerms).toContain(PERMISSIONS.TrustManage);
  });

  it('leaves no route on this controller ungated', () => {
    // The whole surface, so a route added later without a decorator fails here rather
    // than shipping open. `@Permissions` is the only thing standing between these
    // handlers and any authenticated user.
    const handlers = Object.getOwnPropertyNames(TrustAdminController.prototype).filter(
      (name) => name !== 'constructor',
    );
    expect(handlers).toHaveLength(reads.length + mutations.length);
    for (const name of handlers) {
      const handler = (TrustAdminController.prototype as unknown as Record<string, never>)[name];
      expect(permsOf(handler)).toBeDefined();
    }
  });
});
