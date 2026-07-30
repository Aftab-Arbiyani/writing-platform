import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { securityConfig } from '../../config/security.config';

/** A versioned symmetric key held in memory (never logged, never serialized). */
export interface ManagedKey {
  readonly id: string;
  readonly key: Buffer;
}

/** Non-secret metadata about a key, safe for the admin key-status view. */
export interface KeyStatus {
  readonly id: string;
  readonly active: boolean;
  readonly algorithm: 'aes-256-gcm';
  readonly length: number;
}

/**
 * Key Management integration point (P7.2). Owns the in-memory registry of
 * versioned encryption keys, the active key selection, and key-expiry
 * monitoring. Rotation-ready by design: multiple keys are held at once so a new
 * key can be introduced (active) while old keys still decrypt existing data
 * (overlap window) — the ciphertext carries its key id so decryption always
 * picks the right one.
 *
 * This is the seam for an external KMS/Vault: swap the env-sourced key loader
 * for a fetch against the provider; the rest of the platform is unchanged.
 * Key *material* never leaves this service except to {@link EncryptionService}.
 */
@Injectable()
export class KeyManagementService implements OnModuleInit {
  private readonly logger = new Logger(KeyManagementService.name);
  private readonly keys = new Map<string, Buffer>();
  private activeKeyId = '';

  constructor(
    @Inject(securityConfig.KEY) private readonly config: ConfigType<typeof securityConfig>,
  ) {}

  onModuleInit(): void {
    for (const material of this.config.encryption.keys) {
      const buf = Buffer.from(material.keyBase64, 'base64');
      if (buf.length !== 32) {
        // Fail fast on a malformed key rather than silently weakening encryption.
        throw new Error(
          `encryption key "${material.id}" must be 32 bytes (got ${buf.length}) — generate with: openssl rand -base64 32`,
        );
      }
      this.keys.set(material.id, buf);
    }
    this.activeKeyId = this.config.encryption.activeKeyId;
    if (this.keys.size > 0 && !this.keys.has(this.activeKeyId)) {
      throw new Error(
        `ENCRYPTION_ACTIVE_KEY_ID "${this.activeKeyId}" is not among ENCRYPTION_KEYS`,
      );
    }
    if (this.keys.size > 0) {
      this.logger.log(
        `key management: ${this.keys.size} key(s) loaded, active="${this.activeKeyId}"`,
      );
    }
  }

  /** True when at least one key is configured (field encryption is live). */
  get enabled(): boolean {
    return this.keys.size > 0;
  }

  /** The active key for new encryptions; throws if none configured. */
  activeKey(): ManagedKey {
    const key = this.keys.get(this.activeKeyId);
    if (key === undefined) {
      throw new Error('no active encryption key configured (set ENCRYPTION_KEYS)');
    }
    return { id: this.activeKeyId, key };
  }

  /** A key by id (for decrypting ciphertext tagged with an older version). */
  keyById(id: string): Buffer | undefined {
    return this.keys.get(id);
  }

  /** Non-secret status of every key (admin key view / expiry monitoring). */
  statuses(): KeyStatus[] {
    return [...this.keys.entries()].map(([id, key]) => ({
      id,
      active: id === this.activeKeyId,
      algorithm: 'aes-256-gcm' as const,
      length: key.length,
    }));
  }

  /** Configured max key age (days) — used by the key-expiry monitor. */
  get maxKeyAgeDays(): number {
    return this.config.encryption.maxKeyAgeDays;
  }
}
