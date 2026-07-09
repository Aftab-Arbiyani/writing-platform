import { USERNAME_REGEX } from '@qalam/shared';

/**
 * Lightweight validation predicates. Form validation proper is React Hook Form + Zod
 * schemas built from @qalam/shared atoms (docs/33) — these helpers are for ad-hoc,
 * non-form checks (e.g. gating a UI affordance).
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_REGEX.test(value);
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

export function isValidUrl(value: string): boolean {
  return URL.canParse(value);
}

export function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
