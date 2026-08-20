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

  /*
   * **AI-1** (docs/48 §3.8). Every other provider knob was declared — all three Stripe values,
   * Apple's, Google Play's, each AI credential and base URL, and `AI_STUB_ENABLED` — and
   * `PAYMENTS_MANUAL_ENABLED` was not, because W4 added it as a bare `process.env` read. This file is
   * the project's fail-fast contract, so an undeclared var is a var this schema never sees.
   */
  it('declares the manual-payments gate, so a typo is a value it has seen (AI-1)', () => {
    expect(validateEnv(baseEnv()).PAYMENTS_MANUAL_ENABLED).toBe('false');
    expect(validateEnv(baseEnv({ PAYMENTS_MANUAL_ENABLED: 'true' })).PAYMENTS_MANUAL_ENABLED).toBe(
      'true',
    );
    // The typo mode the entry was about: it lands as a value the schema returns, and the adapter's
    // `=== 'true'` gate leaves payments refusing. Silent either way in behaviour — the difference is
    // that a reader auditing what a deployment can switch on now finds it in the file whose job that
    // is, and the validated env carries it.
    expect(validateEnv(baseEnv({ PAYMENTS_MANUAL_ENABLED: 'ture' })).PAYMENTS_MANUAL_ENABLED).toBe(
      'ture',
    );
  });

  it('declares both intentionally-inert provider gates the same way', () => {
    // The asymmetry AI-1 named: `AI_STUB_ENABLED` was declared "because declaring one's own new var
    // is part of writing it" and its payments counterpart was not. Compared against each other rather
    // than against literals, so the pair cannot drift apart again.
    const env = validateEnv(baseEnv());
    expect(env.PAYMENTS_MANUAL_ENABLED).toBe(env.AI_STUB_ENABLED);
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
