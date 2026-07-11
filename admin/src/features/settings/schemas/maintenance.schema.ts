import { z } from 'zod';

const ROLES = ['super_admin', 'admin', 'moderator', 'user'] as const;

/** Maintenance-mode form. `estimatedCompletion` is a local datetime string or ''. */
export const maintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(500, 'At most 500 characters'),
  estimatedCompletion: z.string(),
  allowedRoles: z.array(z.enum(ROLES)).max(4),
});

export type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;
