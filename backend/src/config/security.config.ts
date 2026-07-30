/**
 * Security Platform config namespace (P7.2). Field-encryption keys, account
 * lockout + idempotency toggles. Encryption keys are SECRETS (env only, never
 * defaulted to a real value). Consumers inject `ConfigType<typeof securityConfig>`.
 */
import { registerAs } from '@nestjs/config';

/** One parsed encryption key: an id/version + its 32-byte material (base64). */
export interface EncryptionKeyMaterial {
  readonly id: string;
  readonly keyBase64: string;
}

/** Parse "id:base64,id2:base64" into ordered key material (bad entries dropped). */
function parseEncryptionKeys(raw: string): EncryptionKeyMaterial[] {
  if (raw.trim().length === 0) return [];
  return raw
    .split(',')
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const idx = pair.indexOf(':');
      if (idx <= 0) return null;
      return { id: pair.slice(0, idx), keyBase64: pair.slice(idx + 1) };
    })
    .filter((k): k is EncryptionKeyMaterial => k !== null && k.keyBase64.length > 0);
}

export const securityConfig = registerAs('security', () => {
  const keys = parseEncryptionKeys(process.env.ENCRYPTION_KEYS ?? '');
  return {
    encryption: {
      keys,
      /** Active key id used for new encryptions; defaults to the last listed key. */
      activeKeyId:
        process.env.ENCRYPTION_ACTIVE_KEY_ID !== undefined &&
        process.env.ENCRYPTION_ACTIVE_KEY_ID.length > 0
          ? process.env.ENCRYPTION_ACTIVE_KEY_ID
          : (keys[keys.length - 1]?.id ?? ''),
      maxKeyAgeDays: Number(process.env.ENCRYPTION_KEY_MAX_AGE_DAYS ?? 180),
      /** True when at least one key is configured (field encryption is live). */
      enabled: keys.length > 0,
    },
    lockout: {
      enabled: process.env.SECURITY_ACCOUNT_LOCKOUT_ENABLED !== 'false',
    },
    idempotency: {
      enabled: process.env.SECURITY_IDEMPOTENCY_ENABLED !== 'false',
    },
  };
});
