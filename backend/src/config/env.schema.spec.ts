import { isDevPlaceholderSecret, isProtectedEnvironment, validateEnv } from './env.schema';

/** A minimal environment that passes validation, for targeted mutation. */
function baseEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    DATABASE_URL: 'postgres://qalam:pw@db.internal:5432/qalam',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    S3_ACCESS_KEY: 'AKIAREAL0000',
    S3_SECRET_KEY: 'real-secret-key-value-123456',
    ...overrides,
  };
}

describe('validateEnv', () => {
  it('accepts local dev with placeholder secrets (no protected-env constraints)', () => {
    // Placeholder secrets + localhost DB are allowed off protected tiers.
    const env = validateEnv({
      DATABASE_URL: 'postgres://localhost:5432/qalam',
      JWT_ACCESS_SECRET: `dev-only-${'x'.repeat(30)}`,
      JWT_REFRESH_SECRET: `dev-only-${'y'.repeat(30)}`,
    });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
  });

  it('accepts the new qa and preview tiers', () => {
    expect(validateEnv(baseEnv({ NODE_ENV: 'qa' })).NODE_ENV).toBe('qa');
    expect(validateEnv(baseEnv({ NODE_ENV: 'preview' })).NODE_ENV).toBe('preview');
  });

  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects dev placeholder secrets on protected tiers', () => {
    expect(() =>
      validateEnv(baseEnv({ NODE_ENV: 'production', S3_ACCESS_KEY: 'minioadmin' })),
    ).toThrow(/S3_ACCESS_KEY/);
    expect(() =>
      validateEnv(
        baseEnv({ NODE_ENV: 'staging', JWT_ACCESS_SECRET: `dev-only-${'x'.repeat(30)}` }),
      ),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects identical access/refresh secrets on protected tiers', () => {
    const secret = 'c'.repeat(40);
    expect(() =>
      validateEnv(
        baseEnv({ NODE_ENV: 'production', JWT_ACCESS_SECRET: secret, JWT_REFRESH_SECRET: secret }),
      ),
    ).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('rejects a localhost DATABASE_URL and pretty logs in production', () => {
    expect(() =>
      validateEnv(
        baseEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgres://localhost:5432/qalam' }),
      ),
    ).toThrow(/localhost/);
    expect(() => validateEnv(baseEnv({ NODE_ENV: 'production', LOG_PRETTY: 'true' }))).toThrow(
      /LOG_PRETTY/,
    );
  });

  it('allows real secrets on a protected tier', () => {
    const env = validateEnv(baseEnv({ NODE_ENV: 'production' }));
    expect(env.NODE_ENV).toBe('production');
  });
});

describe('secret/environment helpers', () => {
  it('flags dev placeholders', () => {
    expect(isDevPlaceholderSecret('minioadmin')).toBe(true);
    expect(isDevPlaceholderSecret('dev-only-abc')).toBe(true);
    expect(isDevPlaceholderSecret('changeme')).toBe(true);
    expect(isDevPlaceholderSecret('A-Real-Secret-9f8a7')).toBe(false);
  });

  it('classifies protected environments', () => {
    expect(isProtectedEnvironment('production')).toBe(true);
    expect(isProtectedEnvironment('qa')).toBe(true);
    expect(isProtectedEnvironment('development')).toBe(false);
    expect(isProtectedEnvironment('test')).toBe(false);
  });
});
