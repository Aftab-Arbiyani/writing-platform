import { PASSWORD_MAX, PASSWORD_MIN } from '@qalam/shared';
import { z } from 'zod';

/**
 * Change-password schema (docs/33 §2) — mirrors the backend `ChangePasswordDto` atoms. Current
 * password re-auths a sensitive op; `confirmNewPassword` is client-only. `AUTH_CURRENT_PASSWORD_
 * INVALID` / `AUTH_PASSWORD_WEAK` surface on submit via `applyServerErrors` (docs/33 §4).
 */
export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${String(PASSWORD_MIN)} characters.`)
      .max(PASSWORD_MAX, `Keep it under ${String(PASSWORD_MAX)} characters.`),
    confirmNewPassword: z.string().min(1, 'Re-enter your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'Passwords don’t match.',
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one.',
  });

export type PasswordFormInput = z.infer<typeof passwordSchema>;
