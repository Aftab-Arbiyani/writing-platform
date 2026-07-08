import { createHash, randomBytes } from 'node:crypto';

/**
 * Helpers for single-use email tokens (verification, password reset). The raw
 * token is high-entropy random (256-bit), so a plain SHA-256 (no salt) is the
 * correct store: fast lookup, and the pre-image is infeasible to guess — unlike
 * passwords, which need Argon2id. Only the hash is persisted (docs 13 §13).
 */
export function generateRawToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
