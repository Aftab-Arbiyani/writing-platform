import { freshLogin } from '../../fixtures/auth';
import { test } from '../../fixtures/test';
import { AuditPage } from '../../pages/admin/audit-page';

/**
 * Admin audit log (docs/e2e/06 Phase 3). A privileged action (suspending a throwaway
 * user) is arranged via the admin API, then the audit-log screen is asserted to show
 * the recorded entry, scoped to that target so it can't collide with prior runs.
 */
test.describe('@phase3 admin audit log', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('an admin action is recorded and shown in the audit log', async ({ page, api, data }) => {
    const victim = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    await api.suspendUser(victim.id); // writes a `user.suspend` audit entry (actor = super-admin)

    const audit = new AuditPage(page);
    await audit.goto();
    await audit.filterBy(victim.id); // narrow to this target's entries
    await audit.expectAction('user.suspend');
  });
});
