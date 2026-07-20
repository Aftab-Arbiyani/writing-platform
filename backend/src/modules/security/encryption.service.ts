import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { KeyManagementService } from './key-management.service';

/** AES-256-GCM parameters (96-bit IV + 128-bit tag are the GCM standard). */
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
/** Envelope prefix so ciphertext is self-describing + upgrade-safe. */
const ENVELOPE_PREFIX = 'enc';

/**
 * Field-level encryption (P7.2). AES-256-GCM (authenticated encryption) with a
 * versioned key from {@link KeyManagementService}. Ciphertext is a
 * self-describing envelope — `enc:v1:<keyId>:<iv>:<tag>:<ciphertext>` (base64
 * parts) — so any key in the rotation window decrypts it and rotation needs no
 * data migration. Use it for sensitive at-rest columns (future PII, MFA/TOTP
 * secrets, provider tokens) via {@link EncryptedColumnTransformer}, and for
 * ad-hoc token encryption.
 *
 * Never stores or logs plaintext/keys. Tampering fails the GCM auth tag →
 * decryption throws rather than returning corrupt data (fail closed).
 */
@Injectable()
export class EncryptionService {
  constructor(private readonly keys: KeyManagementService) {}

  /** True when encryption keys are configured (else callers should store plaintext-safe). */
  get enabled(): boolean {
    return this.keys.enabled;
  }

  /** Encrypts UTF-8 plaintext to the self-describing envelope. */
  encrypt(plaintext: string): string {
    const { id, key } = this.keys.activeKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      ENVELOPE_PREFIX,
      'v1',
      id,
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  /** True when `value` is one of our encryption envelopes. */
  isEncrypted(value: string): boolean {
    return value.startsWith(`${ENVELOPE_PREFIX}:v1:`);
  }

  /**
   * Decrypts an envelope produced by {@link encrypt}. Throws on an unknown key
   * id, a tampered payload (GCM tag mismatch), or a malformed envelope — never
   * returns partial/garbled plaintext.
   */
  decrypt(envelope: string): string {
    const parts = envelope.split(':');
    if (parts.length !== 6 || parts[0] !== ENVELOPE_PREFIX || parts[1] !== 'v1') {
      throw new Error('malformed encryption envelope');
    }
    const keyId = parts[2] ?? '';
    const ivB64 = parts[3] ?? '';
    const tagB64 = parts[4] ?? '';
    const dataB64 = parts[5] ?? '';
    const key = this.keys.keyById(keyId);
    if (key === undefined) {
      throw new Error(`no decryption key for id "${keyId}" (rotated out?)`);
    }
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }

  /**
   * Re-encrypts an envelope under the current active key (rotation helper): a
   * background job walks encrypted columns and calls this to migrate ciphertext
   * off a retired key before it is removed from the rotation window.
   */
  reencrypt(envelope: string): string {
    return this.encrypt(this.decrypt(envelope));
  }
}
