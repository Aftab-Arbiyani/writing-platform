/**
 * Wire types for the System Settings feature (A7), mirroring the E12.8 backend
 * DTOs (`backend/src/modules/settings/dto/*`). Hand-authored until
 * `@qalam/api-types` is regenerated for the new endpoints —
 * TODO(aftab): drop for generated types once `openapi.json` includes them.
 */

export type SettingDataType = 'boolean' | 'string' | 'number' | 'json' | 'array' | 'enum';

export type EnvironmentScope = 'all' | 'production' | 'staging' | 'development';

/** One configuration entry (backend SettingDto). `value`/`defaultValue` follow `dataType`. */
export interface Setting {
  key: string;
  category: string;
  value: unknown;
  dataType: SettingDataType;
  defaultValue: unknown;
  validationRules: SettingValidationRules;
  description: string;
  editable: boolean;
  environmentScope: EnvironmentScope;
  updatedBy: string | null;
  updatedAt: string | null;
}

/** Type-specific constraints carried on a setting (a permissive superset). */
export interface SettingValidationRules {
  min?: number;
  max?: number;
  integer?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
  itemType?: 'string' | 'number';
  maxItems?: number;
}

/** One key → new-value pair in a settings update batch. */
export interface UpdateSettingItem {
  key: string;
  value: unknown;
}

export interface UpdateSettingsPayload {
  updates: UpdateSettingItem[];
  reason?: string;
}

/** A feature flag (backend FeatureFlagDto). */
export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  environment: EnvironmentScope;
  description: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeatureFlagPayload {
  key: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  environment?: EnvironmentScope;
  description?: string;
}

export interface UpdateFeatureFlagPayload {
  enabled?: boolean;
  rolloutPercentage?: number;
  environment?: EnvironmentScope;
  description?: string;
}

/** The maintenance-mode view (backend MaintenanceDto). */
export interface Maintenance {
  enabled: boolean;
  message: string;
  estimatedCompletion: string | null;
  allowedRoles: string[];
}

export interface UpdateMaintenancePayload {
  enabled?: boolean;
  message?: string;
  estimatedCompletion?: string;
  allowedRoles?: string[];
  reason?: string;
}
