import { z } from 'zod';

/** Forgot-password schema (docs/33). Only an email; the API always 202s (no enumeration). */
export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Enter your email address.').email('Enter a valid email address.'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
