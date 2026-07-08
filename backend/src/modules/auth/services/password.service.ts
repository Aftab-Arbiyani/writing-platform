import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PASSWORD_MAX, PASSWORD_MIN } from '@qalam/shared';
import * as argon2 from 'argon2';

import { authConfig } from '../../../config/auth.config';
import { PasswordWeakException } from '../exceptions/auth.exceptions';

/**
 * Argon2id hashing + password policy (docs 13 §3.1). Parameters come from
 * `authConfig` (fixed policy) and are encoded in the PHC hash string, so raising
 * them later is a lazy re-hash on next login.
 *
 * A small breached/common-password deny-list is checked here; the full local
 * top-100k list (docs 13 §3.1) is a follow-up — TODO below. Length (10–128) is
 * validated at the DTO boundary AND re-asserted here (defense in depth).
 */
@Injectable()
export class PasswordService {
  // A dummy hash to compare against when the account doesn't exist, so login
  // timing doesn't reveal account existence (docs 13 §3.1). Computed lazily once.
  private dummyHash: string | null = null;

  constructor(@Inject(authConfig.KEY) private readonly config: ConfigType<typeof authConfig>) {}

  private get options(): argon2.Options {
    return {
      type: argon2.argon2id,
      memoryCost: this.config.argon2.memoryCost,
      timeCost: this.config.argon2.timeCost,
      parallelism: this.config.argon2.parallelism,
      hashLength: this.config.argon2.hashLength,
    };
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // Malformed hash string — treat as non-match, never leak the parse error.
      return false;
    }
  }

  /**
   * Verifies against a real hash, or burns equivalent time against a dummy hash
   * when the account has no password (missing user / OAuth-only) — constant-time
   * behavior, no user enumeration (docs 13 §3.1).
   */
  async verifyConstantTime(hash: string | null, plain: string): Promise<boolean> {
    if (hash === null) {
      await argon2.verify(await this.getDummyHash(), plain).catch(() => false);
      return false;
    }
    return this.verify(hash, plain);
  }

  /** Throws `AUTH_PASSWORD_WEAK` if the password violates policy (docs 13 §3.1). */
  assertStrong(plain: string): void {
    if (plain.length < PASSWORD_MIN || plain.length > PASSWORD_MAX) {
      throw new PasswordWeakException(
        `Password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters.`,
      );
    }
    // TODO(aftab): check against the local top-100k breached-password list
    // (docs 13 §3.1). Interim: reject the most common weak passwords.
    if (COMMON_PASSWORDS.has(plain.toLowerCase())) {
      throw new PasswordWeakException('This password is too common. Choose a stronger one.');
    }
  }

  private async getDummyHash(): Promise<string> {
    this.dummyHash ??= await argon2.hash('dummy-password-for-constant-time', this.options);
    return this.dummyHash;
  }
}

/** Interim breached-password guard (see TODO above). */
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwertyuiop',
  'iloveyou',
  'letmein123',
  'welcome123',
  'admin12345',
  'changeme123',
]);
