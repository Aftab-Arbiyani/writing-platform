import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { UserStatus } from '@qalam/shared';

import type { PolicyEngineService } from '../policy';

import { AccountStatusService } from './account-status.service';
import type { UsersService } from './users.service';

/**
 * The account-status port (B9, closing half of A2-1) — the answer to "account suspend and
 * trust `suspended` are disjoint, in both directions".
 */
function make(user: { status: UserStatus } | null) {
  const engine = { registerAccountStatusPort: jest.fn() };
  const users = { findById: jest.fn().mockResolvedValue(user) };
  const service = new AccountStatusService(
    engine as unknown as PolicyEngineService,
    users as unknown as UsersService,
  );
  return { service, engine, users };
}

describe('AccountStatusService', () => {
  it('self-registers with the engine at bootstrap', () => {
    // The whole mechanism depends on this: an unregistered port leaves the engine exactly
    // as blind as it was before this row, and silently.
    const { service, engine } = make({ status: UserStatus.Active });
    service.onModuleInit();
    expect(engine.registerAccountStatusPort).toHaveBeenCalledWith(service);
  });

  it('reports a suspended account as closed', async () => {
    const { service } = make({ status: UserStatus.Suspended });
    await expect(service.isAccountClosed('u1')).resolves.toBe(true);
  });

  it('reports an active account as open', async () => {
    const { service } = make({ status: UserStatus.Active });
    await expect(service.isAccountClosed('u1')).resolves.toBe(false);
  });

  it('does NOT treat a DEACTIVATED account as closed', async () => {
    // Deactivation is the user's own doing, and login already makes it indistinguishable
    // from wrong credentials on purpose. Reporting it here would show a
    // moderation-flavoured "your account has been suspended" screen to somebody who simply
    // closed their own account.
    const { service } = make({ status: UserStatus.Deactivated });
    await expect(service.isAccountClosed('u1')).resolves.toBe(false);
  });

  it('answers "not closed" for an id with no account rather than denying', async () => {
    // Authentication already proved the principal exists, so a missing row means a race
    // with a hard delete. Denying every action on that basis would be a worse answer than
    // deferring to the rules below.
    const { service } = make(null);
    await expect(service.isAccountClosed('u1')).resolves.toBe(false);
  });
});

/**
 * DECISION 1, pinned structurally (docs/48 §6.17).
 *
 * B9 converged the two sanction systems in ONE direction — the Policy Engine now reads
 * `users.status` — and deliberately declined the other: a trust `suspended` restriction
 * still does NOT refuse a login. That is not an oversight, and this test exists so the
 * next person to notice it reads the record before wiring it:
 *
 *   - Trust restrictions need only `trust.manage` (moderator+), while
 *     `ModerationService.assertCanSuspend` reserves account closure for admins. Refusing a
 *     login on a trust restriction would hand every moderator an admin-only power.
 *   - `TrustService.maybeEscalate` applies the global `suspended` restriction
 *     AUTOMATICALLY at six active strike weight, with no human decision.
 *   - It would not even work alone: `TokenService.rotate` reads neither status nor trust,
 *     so a login block stops only users who log out.
 */
describe('the auth module still knows nothing about trust (DECISION 1)', () => {
  const authDir = resolve(__dirname, '..', 'auth');

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
        ? [full]
        : [];
    });
  }

  it('has no import of the trust module anywhere under modules/auth', () => {
    const offenders = sourceFiles(authDir).filter((file) =>
      /from '(\.\.\/)+trust/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('and auth still refuses a login on ACCOUNT status, which is where that decision lives', () => {
    const authService = readFileSync(join(authDir, 'auth.service.ts'), 'utf8');
    expect(authService).toContain('UserStatus.Suspended');
    expect(authService).toContain('AccountSuspendedException');
  });
});
