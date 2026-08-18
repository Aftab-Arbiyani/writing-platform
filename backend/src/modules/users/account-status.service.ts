import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { UserStatus } from '@qalam/shared';

import { PolicyEngineService } from '../policy';
import type { AccountStatusPort } from '../policy/policy.types';

import { UsersService } from './users.service';

/**
 * The Users module's adapter for the Policy Engine's account-status port (B9,
 * closing half of A2-1). Self-registers at bootstrap in exactly the shape
 * `TrustStatusService` established, so the engine keeps NO compile-time dependency
 * on this module and there is no cycle.
 *
 * **Why the engine needs this at all.** Account suspension and the AF6 trust
 * `suspended` restriction were two sanction systems that both said "suspended" and
 * neither of which knew the other existed. Enforcement of the account one lived
 * entirely at the auth edge — `auth.service.ts:123` refuses the login, and the
 * suspend endpoints call `logoutAll` — so nothing downstream re-checked, and
 * `grep UserStatus` over `modules/policy` returned nothing at all. A suspended
 * account was therefore in good standing for every policy decision it could still
 * reach: throughout the access-token TTL that follows a suspension, and indefinitely
 * whenever the un-transacted `logoutAll` after the status write fails (that endpoint
 * cannot be retried — `setStatus` throws `UserStatusConflictException` on the second
 * attempt, before it reaches the revocation).
 *
 * **Convergence stops here, deliberately.** This closes the direction where the
 * engine was blind. It does NOT make a trust suspension refuse a login: that would
 * hand every `trust.manage` holder — moderator and up — a power
 * `ModerationService.assertCanSuspend` reserves for admins, and `maybeEscalate`
 * applies the trust suspension automatically at six strike weight with no human in
 * the loop. See docs/48 §6.17 for the full argument.
 *
 * **Freshness.** No invalidation call is wired from `setStatus`, and none is needed:
 * decisions are cached for `POLICY_DECISION_CACHE_TTL_SECONDS` (30s), so a
 * suspension takes hold on policy-gated actions within half a minute — tighter than
 * the access-token TTL that already bounds it. Keeping the write path free of a
 * dependency on the engine is worth those seconds.
 */
@Injectable()
export class AccountStatusService implements AccountStatusPort, OnModuleInit {
  private readonly logger = new Logger(AccountStatusService.name);

  constructor(
    private readonly engine: PolicyEngineService,
    private readonly users: UsersService,
  ) {}

  onModuleInit(): void {
    this.engine.registerAccountStatusPort(this);
  }

  /**
   * `suspended` only. `deactivated` is the user's own doing and is already
   * indistinguishable from wrong credentials at login by design
   * (`auth.service.ts:126`); treating it as a policy suspension would tell anyone who
   * held a live token that the account exists, and would show a moderation-flavoured
   * restricted-state screen to somebody who simply closed their account.
   */
  async isAccountClosed(userId: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    if (user === null) {
      // An id with no account cannot be "closed". Authentication already established
      // that this principal exists; a missing row here means a race with a hard
      // delete, and denying every action would be a worse answer than deferring to
      // the rules below.
      this.logger.warn(`account-status asked about an unknown user ${userId}`);
      return false;
    }
    return user.status === UserStatus.Suspended;
  }
}
