import 'reflect-metadata';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  Role,
  ROLE_RANK,
  permissionSatisfies,
} from '@qalam/shared';

import { PERMISSIONS_KEY } from '../../common/constants/metadata.constants';
import { PublishingController } from './publishing.controller';

/** Reads the `@Permissions(...)` codes a route handler declares (PBAC). */
function permsOf(handler: (...args: never[]) => unknown): string[] | undefined {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler) as string[] | undefined;
}

/**
 * The effective grants of a role, including rank inheritance — the same union
 * `PermissionResolver.resolve` builds (a role's grants stack with every
 * lower-ranked role's), computed here from the static defaults so this stays a
 * pure unit test.
 */
function effectiveGrants(role: Role): Set<string> {
  const granted = new Set<string>();
  for (const candidate of Object.values(Role)) {
    if (ROLE_RANK[candidate] <= ROLE_RANK[role]) {
      for (const code of DEFAULT_ROLE_PERMISSIONS[candidate]) {
        granted.add(code);
      }
    }
  }
  return granted;
}

/**
 * The coarse gate on the review workflow (defect **W3c-1**, docs/48 §3.4).
 *
 * `review/approve` and `review/changes` used to declare `publishing.approve`, a
 * platform permission only moderator and above hold. That put a second authz path
 * in front of the Policy Engine — the SSOT AF6 made authoritative — and 403'd the
 * story owner whom `GET /stories/:id/capabilities` had just told
 * `review.approve: allowed`. Both clients rendered two dead buttons.
 *
 * These tests pin the reconciliation: the route gate is the same
 * `collaboration.use` base permission the rest of the review workflow uses, and
 * the reviewer decision itself belongs to the Policy Engine
 * (`review.service.spec.ts` covers the three actors through the real engine).
 */
describe('PublishingController — review workflow PBAC (W3c-1)', () => {
  const reviewRoutes: Array<[string, (...args: never[]) => unknown]> = [
    ['request review', PublishingController.prototype.requestReview],
    ['approve review', PublishingController.prototype.approveReview],
    ['request changes', PublishingController.prototype.requestChanges],
    ['get review', PublishingController.prototype.getReview],
  ];

  it.each(reviewRoutes)('%s is gated on collaboration.use', (_name, handler) => {
    expect(permsOf(handler)).toEqual([PERMISSIONS.CollaborationUse]);
  });

  it.each(reviewRoutes)('%s does not re-gate on publishing.approve', (_name, handler) => {
    // The regression itself. A reviewer decision is the Policy Engine's call; a
    // platform permission on the route can only disagree with it.
    expect(permsOf(handler)).not.toContain(PERMISSIONS.PublishingApprove);
  });

  it('lets a plain user past the review gate — the story owner the route used to refuse', () => {
    expect(permissionSatisfies(effectiveGrants(Role.User), PERMISSIONS.CollaborationUse)).toBe(
      true,
    );
  });

  it.each([Role.Moderator, Role.Admin, Role.SuperAdmin])(
    'keeps the staff path open for %s (rank inheritance)',
    (role) => {
      // Why this is not a loosening in the other direction: moderator/admin do not
      // grant `collaboration.use` directly, they inherit it from `user`. Without
      // that, narrowing the gate would have locked staff out of approving.
      expect(permissionSatisfies(effectiveGrants(role), PERMISSIONS.CollaborationUse)).toBe(true);
    },
  );

  it('leaves the publication lifecycle routes on piece.publish', () => {
    // Scope check: only the two reviewer-decision routes changed.
    expect(permsOf(PublishingController.prototype.publish)).toEqual([PERMISSIONS.PiecePublish]);
    expect(permsOf(PublishingController.prototype.unpublish)).toEqual([PERMISSIONS.PiecePublish]);
    expect(permsOf(PublishingController.prototype.schedule)).toEqual([PERMISSIONS.PiecePublish]);
    expect(permsOf(PublishingController.prototype.changeVisibility)).toEqual([
      PERMISSIONS.PiecePublish,
    ]);
  });
});
