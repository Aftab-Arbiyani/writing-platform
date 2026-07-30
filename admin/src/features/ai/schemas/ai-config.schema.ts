import { AI_PARAM_BOUNDS, AiProvider } from '@qalam/shared';
import { z } from 'zod';

/** Zod schema for the org-defaults form (AF1). Bounds come from `@qalam/shared`. */
export const aiOrgConfigSchema = z.object({
  provider: z.enum(Object.values(AiProvider) as [string, ...string[]]),
  model: z.string().max(120),
  temperature: z.number().min(AI_PARAM_BOUNDS.temperature.min).max(AI_PARAM_BOUNDS.temperature.max),
  topP: z.number().min(AI_PARAM_BOUNDS.topP.min).max(AI_PARAM_BOUNDS.topP.max),
  maxTokens: z.number().int().min(AI_PARAM_BOUNDS.maxTokens.min).max(AI_PARAM_BOUNDS.maxTokens.max),
  streaming: z.boolean(),
});

export type AiOrgConfigForm = z.infer<typeof aiOrgConfigSchema>;
