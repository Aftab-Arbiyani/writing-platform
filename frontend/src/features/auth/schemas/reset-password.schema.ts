import { PASSWORD_MAX, PASSWORD_MIN } from '@qalam/shared';
import { z } from 'zod';

/**
 * Reset-password schema (docs/33). The single-use token comes from the emailed link (URL query,
 * not a form field). `newPassword` mirrors the shared password policy; `confirmPassword` is
 * client-only.
 */
export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${String(PASSWORD_MIN)} characters.`)
      .max(PASSWORD_MAX, `Keep it under ${String(PASSWORD_MAX)} characters.`),
    confirmPassword: z.string().min(1, 'Re-enter your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords don’t match.',
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
