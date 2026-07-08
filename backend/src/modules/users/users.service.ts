import { Injectable } from '@nestjs/common';
import { UserStatus, USERNAME_MAX, USERNAME_MIN } from '@qalam/shared';
import { randomInt } from 'node:crypto';
import type { EntityManager } from 'typeorm';

import { User } from './entities/user.entity';
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
