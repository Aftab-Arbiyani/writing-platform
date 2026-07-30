import { z } from 'zod';

import type { Setting } from '../types/settings.types';

/**
 * RHF treats dots in field names as nested paths, but setting keys ARE dot-cased
 * (`platform.name`). Sanitising to `platform__name` keeps the form flat; we map
 * back to the real key when building the PATCH payload.
 */
export function fieldName(key: string): string {
  return key.replace(/\./g, '__');
}

export interface SettingField {
  /** The real, dot-cased setting key. */
  key: string;
  /** The RHF-safe field name (dots → `__`). */
  name: string;
  setting: Setting;
}

export interface SettingsFormModel {
  schema: z.ZodType<Record<string, unknown>>;
  defaults: Record<string, unknown>;
  fields: SettingField[];
}

/** Builds a Zod validator for one setting from its data type + rules. */
function fieldSchema(setting: Setting): z.ZodTypeAny {
  const rules = setting.validationRules;
  switch (setting.dataType) {
    case 'boolean':
      return z.boolean();
    case 'number': {
      let schema = z.number({ invalid_type_error: 'Enter a number' });
      if (rules.integer === true) schema = schema.int('Must be a whole number');
      if (rules.min !== undefined) schema = schema.min(rules.min, `Must be ≥ ${rules.min}`);
      if (rules.max !== undefined) schema = schema.max(rules.max, `Must be ≤ ${rules.max}`);
      return schema;
    }
    case 'enum': {
      const allowed = rules.enum ?? [];
      return z.string().refine((value) => allowed.length === 0 || allowed.includes(value), {
        message: `Must be one of: ${allowed.join(', ')}`,
      });
    }
    case 'array': {
      const allowed = rules.enum;
      let schema = z.array(z.string());
      if (rules.maxItems !== undefined) {
        schema = schema.max(rules.maxItems, `At most ${rules.maxItems} items`);
      }
      if (allowed !== undefined && allowed.length > 0) {
        return schema.refine((items) => items.every((item) => allowed.includes(item)), {
          message: 'Contains a value that is not allowed',
        });
      }
      return schema;
    }
    case 'json':
      return z.unknown();
    case 'string':
    default: {
      let schema = z.string();
      if (rules.minLength !== undefined) {
        schema = schema.min(rules.minLength, `At least ${rules.minLength} characters`);
      }
      if (rules.maxLength !== undefined) {
        schema = schema.max(rules.maxLength, `At most ${rules.maxLength} characters`);
      }
      if (rules.pattern !== undefined) {
        const pattern = new RegExp(rules.pattern);
        // Allow an intentionally-blank optional value.
        schema = schema.refine((value) => value === '' || pattern.test(value), {
          message: 'Does not match the required format',
        }) as unknown as z.ZodString;
      }
      return schema;
    }
  }
}

/**
 * Builds the RHF form model (schema + defaults + field list) for a category's
 * settings. Non-editable settings are still surfaced (rendered read-only) but
 * excluded from validation/dirty tracking so they never block a save.
 */
export function buildSettingsForm(settings: Setting[]): SettingsFormModel {
  const shape: Record<string, z.ZodTypeAny> = {};
  const defaults: Record<string, unknown> = {};
  const fields: SettingField[] = [];

  for (const setting of settings) {
    const name = fieldName(setting.key);
    fields.push({ key: setting.key, name, setting });
    defaults[name] = setting.value;
    if (setting.editable) {
      shape[name] = fieldSchema(setting);
    }
  }

  return { schema: z.object(shape).passthrough(), defaults, fields };
}
