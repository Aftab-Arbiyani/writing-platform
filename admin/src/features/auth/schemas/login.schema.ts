import { z } from 'zod';

/**
 * Admin login form validation (docs/33). Email must be well-formed; password is required but NOT
 * strength-checked on login (the backend deliberately doesn't re-validate length here — strength is a
 * registration concern). `rememberMe` gates silent session restore on the next cold load (client-only).
 */
export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
