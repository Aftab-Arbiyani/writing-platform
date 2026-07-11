import type { SettingDataType } from './settings.constants';
import { SettingInvalidValueException } from './settings.exceptions';

/** Reads a numeric rule, tolerating missing/mistyped entries. */
function numRule(rules: Record<string, unknown>, name: string): number | undefined {
  const raw = rules[name];
  return typeof raw === 'number' ? raw : undefined;
}

function stringRule(rules: Record<string, unknown>, name: string): string | undefined {
  const raw = rules[name];
  return typeof raw === 'string' ? raw : undefined;
}

function enumRule(rules: Record<string, unknown>): string[] | undefined {
  const raw = rules.enum;
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string')
    : undefined;
}

function validateNumber(key: string, value: unknown, rules: Record<string, unknown>): void {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new SettingInvalidValueException(key, 'expected a number');
  }
  if (rules.integer === true && !Number.isInteger(value)) {
    throw new SettingInvalidValueException(key, 'expected an integer');
  }
  const min = numRule(rules, 'min');
  const max = numRule(rules, 'max');
  if (min !== undefined && value < min) {
    throw new SettingInvalidValueException(key, `must be >= ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new SettingInvalidValueException(key, `must be <= ${max}`);
  }
}

function validateString(key: string, value: unknown, rules: Record<string, unknown>): void {
  if (typeof value !== 'string') {
    throw new SettingInvalidValueException(key, 'expected a string');
  }
  const minLength = numRule(rules, 'minLength');
  const maxLength = numRule(rules, 'maxLength');
  if (minLength !== undefined && value.length < minLength) {
    throw new SettingInvalidValueException(key, `must be at least ${minLength} characters`);
  }
  if (maxLength !== undefined && value.length > maxLength) {
    throw new SettingInvalidValueException(key, `must be at most ${maxLength} characters`);
  }
  const pattern = stringRule(rules, 'pattern');
  // Skip the pattern for an intentionally-blank optional value.
  if (pattern !== undefined && value !== '' && !new RegExp(pattern).test(value)) {
    throw new SettingInvalidValueException(key, 'does not match the required format');
  }
}

function validateArray(key: string, value: unknown, rules: Record<string, unknown>): void {
  if (!Array.isArray(value)) {
    throw new SettingInvalidValueException(key, 'expected an array');
  }
  const maxItems = numRule(rules, 'maxItems');
  if (maxItems !== undefined && value.length > maxItems) {
    throw new SettingInvalidValueException(key, `must have at most ${maxItems} items`);
  }
  const itemType = stringRule(rules, 'itemType');
  const allowed = enumRule(rules);
  for (const item of value) {
    if (itemType !== undefined && typeof item !== itemType) {
      throw new SettingInvalidValueException(key, `every item must be a ${itemType}`);
    }
    if (allowed !== undefined && !allowed.includes(item as string)) {
      throw new SettingInvalidValueException(key, `contains a disallowed value`);
    }
  }
}

function validateEnum(key: string, value: unknown, rules: Record<string, unknown>): void {
  const allowed = enumRule(rules);
  if (allowed === undefined || allowed.length === 0) {
    throw new SettingInvalidValueException(key, 'no allowed values are configured');
  }
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new SettingInvalidValueException(key, `must be one of: ${allowed.join(', ')}`);
  }
}

/**
 * Validates a proposed setting value against its declared data type and
 * validation rules (E12.8). Throws {@link SettingInvalidValueException} (422) on
 * any violation — this is the domain-rule gate the class-validator DTO cannot
 * enforce for a polymorphic `jsonb` value (docs 04 §1 — Zod/service validation
 * for jsonb config).
 */
export function validateSettingValue(
  key: string,
  dataType: SettingDataType,
  value: unknown,
  rules: Record<string, unknown>,
): void {
  switch (dataType) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new SettingInvalidValueException(key, 'expected a boolean');
      }
      return;
    case 'number':
      validateNumber(key, value, rules);
      return;
    case 'string':
      validateString(key, value, rules);
      return;
    case 'enum':
      validateEnum(key, value, rules);
      return;
    case 'array':
      validateArray(key, value, rules);
      return;
    case 'json':
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new SettingInvalidValueException(key, 'expected a JSON object');
      }
      return;
  }
}
