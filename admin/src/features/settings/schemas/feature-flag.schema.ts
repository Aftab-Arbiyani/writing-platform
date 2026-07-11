import { z } from 'zod';

/** Dot-cased, lower-case flag key with at least one dot (matches the backend). */
const FLAG_KEY_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)+$/;

const ENVIRONMENTS = ['all', 'production', 'staging', 'development'] as const;

/** Create-flag form (`POST /admin/feature-flags`). */
export const createFeatureFlagSchema = z.object({
  key: z
    .string()
    .trim()
    .max(120, 'At most 120 characters')
    .regex(FLAG_KEY_PATTERN, 'Use a dot-cased key, e.g. feature.ai.enabled'),
  enabled: z.boolean(),
  rolloutPercentage: z
    .number({ invalid_type_error: 'Enter a number' })
    .int('Whole numbers only')
    .min(0, 'Min 0')
    .max(100, 'Max 100'),
  environment: z.enum(ENVIRONMENTS),
  description: z.string().max(300, 'At most 300 characters'),
});

export type CreateFeatureFlagValues = z.infer<typeof createFeatureFlagSchema>;
