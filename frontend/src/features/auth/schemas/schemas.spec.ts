import { describe, expect, it } from 'vitest';

import { forgotPasswordSchema } from './forgot-password.schema';
import { loginSchema } from './login.schema';
import { registerSchema } from './register.schema';
import { resetPasswordSchema } from './reset-password.schema';

describe('loginSchema', () => {
  it('accepts a valid email + password', () => {
    expect(
      loginSchema.safeParse({ email: 'a@b.com', password: 'x', rememberMe: true }).success,
    ).toBe(true);
  });

  it('rejects an invalid email and an empty password', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'x', rememberMe: true }).success).toBe(
      false,
    );
    expect(
      loginSchema.safeParse({ email: 'a@b.com', password: '', rememberMe: false }).success,
    ).toBe(false);
  });
});

describe('registerSchema', () => {
  const valid = {
    email: 'meera@example.com',
    username: 'meera_k',
    password: 'a-strong-passphrase',
    confirmPassword: 'a-strong-passphrase',
    acceptTerms: true,
  };

  it('accepts a fully valid registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an uppercase / too-short username (mirrors USERNAME_REGEX)', () => {
    expect(registerSchema.safeParse({ ...valid, username: 'Meera' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, username: 'ab' }).success).toBe(false);
  });

  it('rejects a password under the shared minimum (10)', () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('flags a confirm-password mismatch on the confirmPassword field', () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: 'different-value' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'confirmPassword')).toBe(true);
    }
  });

  it('requires the terms to be accepted', () => {
    const result = registerSchema.safeParse({ ...valid, acceptTerms: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'acceptTerms')).toBe(true);
    }
  });
});

describe('forgotPasswordSchema', () => {
  it('requires a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts matching strong passwords and rejects mismatches', () => {
    expect(
      resetPasswordSchema.safeParse({
        newPassword: 'a-strong-passphrase',
        confirmPassword: 'a-strong-passphrase',
      }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        newPassword: 'a-strong-passphrase',
        confirmPassword: 'nope',
      }).success,
    ).toBe(false);
  });
});
