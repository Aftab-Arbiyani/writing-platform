/**
 * Vocabulary for the System Settings module (E12.8). Categories and data types
 * are an OPEN set modelled as string catalogues (docs 04 §1.7) — adding one is a
 * code change here, never a DB migration.
 */

/** The setting grouping buckets surfaced in the admin UI. */
export const SETTING_CATEGORIES = [
  'general',
  'authentication',
  'registration',
  'security',
  'content',
  'moderation',
  'notifications',
  'email',
  'storage',
  'maintenance',
  'feature_flags',
  'appearance',
  'localization',
] as const;

export type SettingCategory = (typeof SETTING_CATEGORIES)[number];

/** The value shapes a setting may hold. */
export const SETTING_DATA_TYPES = ['boolean', 'string', 'number', 'json', 'array', 'enum'] as const;

export type SettingDataType = (typeof SETTING_DATA_TYPES)[number];

/** Where a setting/flag value applies. */
export const ENVIRONMENT_SCOPES = ['all', 'production', 'staging', 'development'] as const;

export type EnvironmentScope = (typeof ENVIRONMENT_SCOPES)[number];

/**
 * Audit action codes for every settings mutation (docs 13 §11 — dot taxonomy).
 * `audit_logs.action` is varchar + this catalogue, so new actions are additive.
 */
export const SETTINGS_AUDIT_ACTIONS = {
  SettingUpdate: 'setting.update',
  FeatureFlagCreate: 'feature_flag.create',
  FeatureFlagUpdate: 'feature_flag.update',
  FeatureFlagDelete: 'feature_flag.delete',
  MaintenanceUpdate: 'maintenance.update',
} as const;

/** Audit target types for the settings surface. */
export const SETTINGS_AUDIT_TARGET = {
  Setting: 'setting',
  FeatureFlag: 'feature_flag',
  Maintenance: 'maintenance',
} as const;

/** Redis cache keys (DB 0). Invalidated on the matching mutation. */
export const SETTINGS_CACHE_KEYS = {
  All: 'settings:all',
  Flags: 'feature_flags:all',
  Maintenance: 'settings:maintenance',
} as const;

/** Cache TTL — a safety net; explicit invalidation is the primary mechanism. */
export const SETTINGS_CACHE_TTL_SECONDS = 300;

/** Keys that make up the maintenance-mode view (category `maintenance`). */
export const MAINTENANCE_KEYS = {
  Enabled: 'maintenance.enabled',
  Message: 'maintenance.message',
  EstimatedCompletion: 'maintenance.estimatedCompletion',
  AllowedRoles: 'maintenance.allowedRoles',
} as const;
