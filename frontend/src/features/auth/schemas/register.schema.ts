import { PASSWORD_MAX, PASSWORD_MIN, USERNAME_REGEX } from '@qalam/shared';
import { z } from 'zod';

/**
 * Register schema (docs/33 §2) — built from the SAME `@qalam/shared` atoms the backend
 * `RegisterDto` validates against, so the two cannot drift. The frozen `v1` register contract
 * accepts only `{ email, username, password }`: `penName` lives on the profile (E2, deferred),
 * so there is no display-name field here. `confirmPassword` + `acceptTerms` are client-only
 * (never sent). No live username-availability endpoint exists (docs/11 §10.4) — format is
 * validated here; "taken" surfaces on submit as `USER_USERNAME_TAKEN`.
 */
export const registerSchema = z
  .object({
    email: z.string().min(1, 'Enter your email address.').email('Enter a valid email address.'),
    username: z
      .string()
      .min(1, 'Choose a username.')
      .regex(
        USERNAME_REGEX,
        'Use 3–30 characters: lowercase letters, numbers, or underscores (no spaces).',
      ),
    password: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${String(PASSWORD_MIN)} characters.`)
      .max(PASSWORD_MAX, `Keep it under ${String(PASSWORD_MAX)} characters.`),
    confirmPassword: z.string().min(1, 'Re-enter your password.'),
    acceptTerms: z.boolean(),
  })
  .refine((data) => data.acceptTerms, {
    path: ['acceptTerms'],
    message: 'Please accept the terms to continue.',
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords don’t match.',
  });

export type RegisterInput = z.infer<typeof registerSchema>;
