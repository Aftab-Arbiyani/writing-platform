import { describe, expect, it } from 'vitest';

import type { Setting } from '../types/settings.types';
import { buildSettingsForm, fieldName } from './build-schema';

function setting(overrides: Partial<Setting>): Setting {
  return {
    key: 'x.y',
    category: 'general',
    value: '',
    dataType: 'string',
    defaultValue: '',
    validationRules: {},
    description: '',
    editable: true,
    environmentScope: 'all',
    updatedBy: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('fieldName', () => {
  it('sanitises dotted keys so RHF treats them as flat', () => {
    expect(fieldName('auth.registration.enabled')).toBe('auth__registration__enabled');
  });
});

describe('buildSettingsForm', () => {
  const settings: Setting[] = [
    setting({
      key: 'auth.registration.enabled',
      dataType: 'boolean',
      value: true,
      defaultValue: true,
    }),
    setting({
      key: 'content.maxTags',
      dataType: 'number',
      value: 5,
      validationRules: { min: 0, max: 20, integer: true },
    }),
    setting({
      key: 'general.defaultLanguage',
      dataType: 'enum',
      value: 'hi',
      validationRules: { enum: ['hi', 'ur', 'en'] },
    }),
    setting({
      key: 'content.supportedLanguages',
      dataType: 'array',
      value: ['hi'],
      validationRules: { enum: ['hi', 'ur', 'en'], maxItems: 3 },
    }),
    setting({ key: 'storage.provider', dataType: 'enum', value: 'minio', editable: false }),
  ];

  const model = buildSettingsForm(settings);

  it('builds defaults keyed by sanitised name from each value', () => {
    expect(model.defaults['auth__registration__enabled']).toBe(true);
    expect(model.defaults['content__maxTags']).toBe(5);
    expect(model.defaults['general__defaultLanguage']).toBe('hi');
  });

  it('exposes every field with its real key + sanitised name', () => {
    const flag = model.fields.find((field) => field.key === 'auth.registration.enabled');
    expect(flag?.name).toBe('auth__registration__enabled');
    expect(model.fields).toHaveLength(5);
  });

  it('validates a well-formed object', () => {
    const result = model.schema.safeParse({
      auth__registration__enabled: false,
      content__maxTags: 3,
      general__defaultLanguage: 'ur',
      content__supportedLanguages: ['hi', 'en'],
      storage__provider: 'minio',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a number outside its range and an unknown enum member', () => {
    const overMax = model.schema.safeParse({
      auth__registration__enabled: true,
      content__maxTags: 999,
      general__defaultLanguage: 'hi',
      content__supportedLanguages: [],
      storage__provider: 'minio',
    });
    expect(overMax.success).toBe(false);

    const badEnum = model.schema.safeParse({
      auth__registration__enabled: true,
      content__maxTags: 5,
      general__defaultLanguage: 'fr',
      content__supportedLanguages: [],
      storage__provider: 'minio',
    });
    expect(badEnum.success).toBe(false);
  });

  it('does not validate a non-editable setting (excluded from the schema)', () => {
    // storage.provider is editable:false → its value is passed through unchecked.
    const result = model.schema.safeParse({
      auth__registration__enabled: true,
      content__maxTags: 5,
      general__defaultLanguage: 'hi',
      content__supportedLanguages: [],
      storage__provider: 'not-a-real-provider',
    });
    expect(result.success).toBe(true);
  });
});
