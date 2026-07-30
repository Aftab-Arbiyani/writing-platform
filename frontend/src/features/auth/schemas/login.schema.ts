import { z } from 'zod';

/**
 * Login schema (docs/33). Password length is intentionally NOT enforced on login — an existing
 * credential may predate a policy change, and the backend `LoginDto` only checks non-empty
 * (mirrors that). `rememberMe` drives the boot silent-refresh preference (see `lib/remember`).
 */
export const loginSchema = z.object({
  email: z.string().min(1, 'Enter your email address.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  rememberMe: z.boolean(),
});

export type LoginInput = z.infer<typeof loginSchema>;
