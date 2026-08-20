import { Injectable } from '@nestjs/common';
import { UserStatus, USERNAME_MAX, USERNAME_MIN } from '@qalam/shared';
import { randomInt } from 'node:crypto';
import type { EntityManager } from 'typeorm';

import { buildOffsetMeta } from '../../common/pagination/pagination.helper';
import type { OffsetPage } from '../../common/types/paginated-result';
import { User } from './entities/user.entity';
import { UserNotFoundException, UserStatusConflictException } from './exceptions/users.exceptions';
import type { AdminUserFilters, AdminUserRow } from './users.repository';
import { UsersRepository } from './users.repository';

/**
 * Account operations for the `users` aggregate — the module's exported surface
 * (docs 16 §3.1). Auth depends on THIS, never on `UsersRepository` directly.
 * Scope for E1 is authentication only: no profile, follow, or presentation
 * concerns (those are E2). Every write accepts an optional `EntityManager` so
 * auth can compose it into a transaction (docs 16 §3.5).
 */
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findById(id: string, manager?: EntityManager): Promise<User | null> {
    return this.usersRepository.findById(id, manager);
  }

  findByEmail(email: string, manager?: EntityManager): Promise<User | null> {
    return this.usersRepository.findByEmail(email, manager);
  }

  findByUsername(username: string, manager?: EntityManager): Promise<User | null> {
    return this.usersRepository.findByUsername(username, manager);
  }

  isEmailTaken(email: string, manager?: EntityManager): Promise<boolean> {
    return this.usersRepository.existsByEmail(email, manager);
  }

  isUsernameTaken(username: string, manager?: EntityManager): Promise<boolean> {
    return this.usersRepository.existsByUsername(username, manager);
  }

  /** Email+password account; unverified until the verification token is consumed. */
  createLocalUser(
    input: { email: string; username: string; passwordHash: string },
    manager?: EntityManager,
  ): Promise<User> {
    return this.usersRepository.create(
      {
        email: input.email,
        username: input.username,
        passwordHash: input.passwordHash,
        status: UserStatus.Active,
      },
      manager,
    );
  }

  /** OAuth account (docs 13 §3.4): no password, email pre-verified by the provider. */
  createVerifiedOAuthUser(
    input: { email: string; username: string },
    manager?: EntityManager,
  ): Promise<User> {
    return this.usersRepository.create(
      {
        email: input.email,
        username: input.username,
        passwordHash: null,
        status: UserStatus.Active,
        emailVerifiedAt: new Date(),
      },
      manager,
    );
  }

  markEmailVerified(userId: string, manager?: EntityManager): Promise<void> {
    return this.usersRepository.update(userId, { emailVerifiedAt: new Date() }, manager);
  }

  updatePasswordHash(userId: string, passwordHash: string, manager?: EntityManager): Promise<void> {
    return this.usersRepository.update(userId, { passwordHash }, manager);
  }

  recordLogin(userId: string, manager?: EntityManager): Promise<void> {
    return this.usersRepository.update(userId, { lastLoginAt: new Date() }, manager);
  }

  // ── Admin surface (E12.5) ─────────────────────────────────────────────────
  // Additive account-management operations the admin controllers orchestrate.
  // Business logic lives here (the module that owns `users`); the admin module
  // is controllers only (docs 16 §3.1). No existing method/behaviour changes.

  /** Offset-paginated, filtered admin user grid (docs 05 §5.2). */
  async adminList(filters: AdminUserFilters): Promise<OffsetPage<AdminUserRow>> {
    const { rows, total } = await this.usersRepository.adminList(filters);
    return { items: rows, meta: buildOffsetMeta(filters.page, filters.limit, total) };
  }

  /** The joined admin detail row (account + profile + role); includes soft-deleted. */
  async adminGetRow(id: string): Promise<AdminUserRow> {
    const row = await this.usersRepository.adminFindRowById(id);
    if (row === null) {
      throw new UserNotFoundException();
    }
    return row;
  }

  /** Joined admin rows for a set of ids (bulk export of a selection). */
  adminFindRowsByIds(ids: string[]): Promise<AdminUserRow[]> {
    return this.usersRepository.adminFindRowsByIds(ids);
  }

  /** Streams matching admin rows in id-ordered batches (full-set export). */
  adminStream(filters: AdminUserFilters, batchSize: number): AsyncGenerator<AdminUserRow[]> {
    return this.usersRepository.adminStream(filters, batchSize);
  }

  /**
   * Loads a live (non-deleted) account for a mutation, throwing
   * `USER_NOT_FOUND` (404) when absent — the action endpoints' target lookup.
   */
  async adminGetAccount(id: string): Promise<User> {
    const user = await this.findById(id);
    if (user === null) {
      throw new UserNotFoundException();
    }
    return user;
  }

  /**
   * Transitions an account's status, enforcing sane transitions. `requireFrom`
   * (used by unsuspend/reactivate) asserts the precondition; a no-op transition
   * is rejected as a state conflict (409) so bulk callers can report per-user.
   * Returns the before/after for the audit trail.
   *
   * `allowNoop` makes a no-op transition succeed instead — `{before: X, after: X}`
   * with no write — for the callers that must be RETRYABLE (**B9-1**, docs/48
   * §3.17). Those endpoints commit this status change to Postgres and then revoke
   * sessions in Redis, which cannot be one transaction: if the revocation throws,
   * the status is already committed and the retry used to be refused here, leaving
   * the account suspended with every session live and no obvious remedy. With the
   * no-op tolerated, the retry reaches revocation and completes the sanction.
   *
   * Opt-in rather than the default, deliberately: for a direct `PATCH status` the
   * 409 is the useful answer ("nothing to do"), and `appeals.service` relies on it
   * too. Only a caller with a second, non-transactional step needs this, and the
   * flag is what makes that caller declare itself.
   */
  async setStatus(
    id: string,
    to: UserStatus,
    options: { requireFrom?: UserStatus; allowNoop?: boolean } = {},
  ): Promise<{ before: UserStatus; after: UserStatus }> {
    const user = await this.adminGetAccount(id);
    const before = user.status;

    if (options.requireFrom !== undefined && before !== options.requireFrom) {
      throw new UserStatusConflictException(
        `Account must be "${options.requireFrom}" for this action; it is "${before}".`,
      );
    }
    if (before === to) {
      if (options.allowNoop !== true) {
        throw new UserStatusConflictException(`Account is already "${to}".`);
      }
      // No write: the row already says this. The caller's NEXT step is the reason
      // it asked to get here, so returning is the whole point.
      return { before, after: to };
    }

    await this.usersRepository.update(id, { status: to });
    return { before, after: to };
  }

  /**
   * Sets (or clears) email verification. Idempotent-safe: returns before/after
   * and skips the write when already in the requested state.
   */
  async setEmailVerified(
    id: string,
    verified: boolean,
  ): Promise<{ before: boolean; after: boolean }> {
    const user = await this.adminGetAccount(id);
    const before = user.isEmailVerified;
    if (before !== verified) {
      await this.usersRepository.update(id, { emailVerifiedAt: verified ? new Date() : null });
    }
    return { before, after: verified };
  }

  /**
   * Derives a unique, format-valid (`^[a-z0-9_]{3,30}$`) username from a hint
   * (e.g. an OAuth email local-part), appending a random suffix on collision or
   * when the sanitized base is too short.
   */
  async generateUniqueUsername(hint: string, manager?: EntityManager): Promise<string> {
    const base = hint
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, USERNAME_MAX);

    const candidates = [base, ...Array.from({ length: 5 }, () => this.withSuffix(base))];
    for (const candidate of candidates) {
      if (candidate.length >= USERNAME_MIN && !(await this.isUsernameTaken(candidate, manager))) {
        return candidate;
      }
    }
    // Exhausted deterministic attempts — fall back to a fully random handle.
    return `user_${randomInt(10 ** 9, 10 ** 10 - 1)}`;
  }

  private withSuffix(base: string): string {
    const suffix = String(randomInt(1000, 10000));
    return `${base.slice(0, USERNAME_MAX - suffix.length - 1)}_${suffix}`;
  }
}
