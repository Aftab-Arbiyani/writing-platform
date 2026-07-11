import { PEN_NAME_MAX, PEN_NAME_MIN, Role, UserStatus } from '@qalam/shared';
import { z } from 'zod';

/**
 * Edit-user form schema (docs 33). Mirrors the fields the backend PATCH accepts —
 * display name, role, status, verification. Username/email are immutable and not
 * editable (ADR §4).
 */
export const editUserSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(PEN_NAME_MIN, 'Display name is required')
    .max(PEN_NAME_MAX, `At most ${PEN_NAME_MAX} characters`),
  role: z.enum([Role.User, Role.Moderator, Role.Admin, Role.SuperAdmin]),
  status: z.enum([UserStatus.Active, UserStatus.Suspended, UserStatus.Deactivated]),
  verified: z.boolean(),
});

export type EditUserFormValues = z.infer<typeof editUserSchema>;
