import type { ConfigType } from '@nestjs/config';

import type { authConfig } from '../../../config/auth.config';
import { PasswordWeakException } from '../exceptions/auth.exceptions';
import { PasswordService } from './password.service';

// Lower Argon2 cost keeps the suite fast; correctness is independent of cost.
const config = {
  argon2: { memoryCost: 8192, timeCost: 2, parallelism: 1, hashLength: 32 },
} as unknown as ConfigType<typeof authConfig>;

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService(config);
  });

  it('hashes to an argon2id PHC string and verifies the original', async () => {
    const hash = await service.hash('a-strong-passphrase');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hash, 'a-strong-passphrase')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong-passphrase')).resolves.toBe(false);
  });

  it('returns false (no throw) for a malformed hash', async () => {
    await expect(service.verify('not-a-hash', 'anything')).resolves.toBe(false);
  });

  it('verifyConstantTime returns false when the stored hash is null (OAuth-only)', async () => {
    await expect(service.verifyConstantTime(null, 'any-password')).resolves.toBe(false);
  });

  it('rejects passwords shorter than the policy minimum', () => {
    expect(() => service.assertStrong('short')).toThrow(PasswordWeakException);
  });

  it('rejects a common breached password even when long enough', () => {
    expect(() => service.assertStrong('password123')).toThrow(PasswordWeakException);
  });

  it('accepts a sufficiently long, uncommon password', () => {
    expect(() => service.assertStrong('correct horse battery staple')).not.toThrow();
  });
});
