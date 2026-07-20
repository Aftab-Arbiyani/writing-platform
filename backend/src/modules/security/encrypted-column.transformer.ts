import type { ValueTransformer } from 'typeorm';

import type { EncryptionService } from './encryption.service';

/**
 * TypeORM column transformer for at-rest field encryption (P7.2). Apply to any
 * sensitive string column:
 *
 *   @Column({ type: 'text', transformer: encryptedColumn })
 *   totpSecret!: string | null;
 *
 * Transformers are constructed statically inside entity decorators, so they
 * cannot use DI — the {@link EncryptionService} singleton is injected here once
 * at bootstrap by `SecurityModule`. Behaviour:
 *   - write: encrypt when keys are configured; passthrough plaintext otherwise
 *     (local dev / not-yet-enabled) so the app never fails for want of a key.
 *   - read: decrypt only values that are our envelope; pre-encryption rows and
 *     dev plaintext pass through, so enabling encryption is a lazy migration.
 *
 * No v1 column uses this yet — it is the ready-to-use capability for future PII
 * / MFA-secret / provider-token columns. `null`/`undefined` are preserved.
 */
let encryptionRef: EncryptionService | null = null;

/** Called once by SecurityModule.onModuleInit so the transformer can encrypt. */
export function registerEncryptionService(service: EncryptionService): void {
  encryptionRef = service;
}

export const encryptedColumn: ValueTransformer = {
  to(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    if (encryptionRef === null || !encryptionRef.enabled) return value;
    return encryptionRef.encrypt(value);
  },
  from(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    if (encryptionRef !== null && encryptionRef.enabled && encryptionRef.isEncrypted(value)) {
      return encryptionRef.decrypt(value);
    }
    return value;
  },
};
