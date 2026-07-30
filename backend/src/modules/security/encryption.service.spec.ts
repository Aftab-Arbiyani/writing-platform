import type { ConfigType } from '@nestjs/config';

import type { securityConfig } from '../../config/security.config';
import { EncryptionService } from './encryption.service';
import { KeyManagementService } from './key-management.service';

type SecurityConfig = ConfigType<typeof securityConfig>;

const KEY_V1 = Buffer.alloc(32, 1).toString('base64');
const KEY_V2 = Buffer.alloc(32, 2).toString('base64');

function kms(keys: { id: string; keyBase64: string }[], activeKeyId: string): KeyManagementService {
  const config = {
    encryption: { keys, activeKeyId, maxKeyAgeDays: 180, enabled: keys.length > 0 },
    lockout: { enabled: true },
    idempotency: { enabled: true },
  } as unknown as SecurityConfig;
  const service = new KeyManagementService(config);
  service.onModuleInit();
  return service;
}

describe('KeyManagementService', () => {
  it('loads keys and reports statuses without exposing material', () => {
    const service = kms([{ id: '1', keyBase64: KEY_V1 }], '1');
    expect(service.enabled).toBe(true);
    const statuses = service.statuses();
    expect(statuses).toEqual([{ id: '1', active: true, algorithm: 'aes-256-gcm', length: 32 }]);
    expect(JSON.stringify(statuses)).not.toContain(KEY_V1);
  });

  it('rejects a non-32-byte key', () => {
    const bad = Buffer.alloc(16, 1).toString('base64');
    expect(() => kms([{ id: '1', keyBase64: bad }], '1')).toThrow(/32 bytes/);
  });

  it('is inert with no keys', () => {
    const service = kms([], '');
    expect(service.enabled).toBe(false);
    expect(() => service.activeKey()).toThrow(/no active encryption key/);
  });
});

describe('EncryptionService', () => {
  it('round-trips plaintext', () => {
    const svc = new EncryptionService(kms([{ id: '1', keyBase64: KEY_V1 }], '1'));
    const envelope = svc.encrypt('sensitive-value');
    expect(svc.isEncrypted(envelope)).toBe(true);
    expect(envelope).not.toContain('sensitive-value');
    expect(svc.decrypt(envelope)).toBe('sensitive-value');
  });

  it('fails closed on a tampered ciphertext (GCM auth tag)', () => {
    const svc = new EncryptionService(kms([{ id: '1', keyBase64: KEY_V1 }], '1'));
    const envelope = svc.encrypt('value');
    const tampered = `${envelope.slice(0, -4)}AAAA`;
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it('decrypts an old key version after rotation (overlap window)', () => {
    // v1 encrypts, then v2 becomes active but v1 is still loaded → old data reads.
    const withV1 = new EncryptionService(kms([{ id: '1', keyBase64: KEY_V1 }], '1'));
    const oldEnvelope = withV1.encrypt('legacy');

    const rotated = new EncryptionService(
      kms(
        [
          { id: '1', keyBase64: KEY_V1 },
          { id: '2', keyBase64: KEY_V2 },
        ],
        '2',
      ),
    );
    expect(rotated.decrypt(oldEnvelope)).toBe('legacy'); // old key still decrypts
    const reencrypted = rotated.reencrypt(oldEnvelope);
    expect(reencrypted).toContain(':2:'); // now under the active key
    expect(rotated.decrypt(reencrypted)).toBe('legacy');
  });

  it('throws for a rotated-out key id', () => {
    const withV1 = new EncryptionService(kms([{ id: '1', keyBase64: KEY_V1 }], '1'));
    const envelope = withV1.encrypt('x');
    const onlyV2 = new EncryptionService(kms([{ id: '2', keyBase64: KEY_V2 }], '2'));
    expect(() => onlyV2.decrypt(envelope)).toThrow(/no decryption key/);
  });
});
