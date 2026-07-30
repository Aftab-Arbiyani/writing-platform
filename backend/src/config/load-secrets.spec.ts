import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadContainerSecrets } from './load-secrets';

describe('loadContainerSecrets', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qalam-secrets-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('expands <VAR>_FILE into <VAR> and strips a trailing newline', () => {
    const path = join(dir, 'jwt');
    writeFileSync(path, 'super-secret-value\n');
    const env: NodeJS.ProcessEnv = { JWT_ACCESS_SECRET_FILE: path };
    const result = loadContainerSecrets(env);
    expect(env.JWT_ACCESS_SECRET).toBe('super-secret-value');
    expect(result.loaded).toContain('JWT_ACCESS_SECRET');
    expect(result.source).toBe('file-refs');
  });

  it('lets an explicitly-set value win over its file form', () => {
    const path = join(dir, 'db');
    writeFileSync(path, 'from-file');
    const env: NodeJS.ProcessEnv = { DATABASE_URL: 'explicit', DATABASE_URL_FILE: path };
    loadContainerSecrets(env);
    expect(env.DATABASE_URL).toBe('explicit');
  });

  it('throws when a referenced file is missing (hard misconfig)', () => {
    const env: NodeJS.ProcessEnv = { JWT_ACCESS_SECRET_FILE: join(dir, 'nope') };
    expect(() => loadContainerSecrets(env)).toThrow(/could not be read/);
  });

  it('loads every file in SECRETS_DIR as <FILENAME>=<contents>', () => {
    writeFileSync(join(dir, 'STRIPE_SECRET_KEY'), 'sk_live_x');
    writeFileSync(join(dir, 'SMTP_URL'), 'smtp://mail:25');
    const env: NodeJS.ProcessEnv = { SECRETS_DIR: dir };
    const result = loadContainerSecrets(env);
    expect(env.STRIPE_SECRET_KEY).toBe('sk_live_x');
    expect(env.SMTP_URL).toBe('smtp://mail:25');
    expect(result.source).toBe('secrets-dir');
    expect(result.loaded).toEqual(expect.arrayContaining(['STRIPE_SECRET_KEY', 'SMTP_URL']));
  });

  it('is a no-op when neither convention is used', () => {
    const env: NodeJS.ProcessEnv = { PORT: '4000' };
    const result = loadContainerSecrets(env);
    expect(result.loaded).toHaveLength(0);
    expect(result.source).toBe('none');
  });
});
