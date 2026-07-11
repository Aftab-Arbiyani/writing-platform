import { SettingInvalidValueException } from './settings.exceptions';
import { validateSettingValue } from './settings.validation';

/** Asserts a value is rejected with SETTING_INVALID_VALUE (422). */
function expectInvalid(
  dataType: Parameters<typeof validateSettingValue>[1],
  value: unknown,
  rules: Record<string, unknown> = {},
): void {
  expect(() => validateSettingValue('k', dataType, value, rules)).toThrow(
    SettingInvalidValueException,
  );
}

describe('validateSettingValue', () => {
  describe('boolean', () => {
    it('accepts a boolean', () => {
      expect(() => validateSettingValue('k', 'boolean', true, {})).not.toThrow();
    });
    it('rejects a non-boolean', () => {
      expectInvalid('boolean', 'true');
      expectInvalid('boolean', 1);
    });
  });

  describe('number', () => {
    it('accepts a number within range', () => {
      expect(() => validateSettingValue('k', 'number', 5, { min: 1, max: 10 })).not.toThrow();
    });
    it('rejects a non-number, out-of-range, and non-integer', () => {
      expectInvalid('number', '5');
      expectInvalid('number', 0, { min: 1 });
      expectInvalid('number', 11, { max: 10 });
      expectInvalid('number', 1.5, { integer: true });
    });
  });

  describe('string', () => {
    it('accepts within length and matching the pattern', () => {
      expect(() =>
        validateSettingValue('k', 'string', '#1f6f5c', { pattern: '^#([0-9a-fA-F]{6})$' }),
      ).not.toThrow();
    });
    it('rejects non-strings, over-length, and pattern mismatch', () => {
      expectInvalid('string', 42);
      expectInvalid('string', 'abc', { maxLength: 2 });
      expectInvalid('string', 'nope', { pattern: '^#([0-9a-fA-F]{6})$' });
    });
    it('skips the pattern for an empty optional value', () => {
      expect(() =>
        validateSettingValue('k', 'string', '', { pattern: '^#([0-9a-fA-F]{6})$' }),
      ).not.toThrow();
    });
  });

  describe('enum', () => {
    it('accepts an allowed member', () => {
      expect(() => validateSettingValue('k', 'enum', 'hi', { enum: ['hi', 'ur'] })).not.toThrow();
    });
    it('rejects a non-member and a missing catalogue', () => {
      expectInvalid('enum', 'fr', { enum: ['hi', 'ur'] });
      expectInvalid('enum', 'hi', {});
    });
  });

  describe('array', () => {
    it('accepts an array within constraints', () => {
      expect(() =>
        validateSettingValue('k', 'array', ['hi', 'ur'], {
          itemType: 'string',
          enum: ['hi', 'ur', 'en'],
          maxItems: 3,
        }),
      ).not.toThrow();
    });
    it('rejects a non-array, over-size, wrong item type, and disallowed item', () => {
      expectInvalid('array', 'hi');
      expectInvalid('array', [1, 2, 3], { maxItems: 2 });
      expectInvalid('array', [1], { itemType: 'string' });
      expectInvalid('array', ['fr'], { enum: ['hi', 'ur'] });
    });
  });

  describe('json', () => {
    it('accepts an object', () => {
      expect(() => validateSettingValue('k', 'json', { a: 1 }, {})).not.toThrow();
    });
    it('rejects arrays, null, and primitives', () => {
      expectInvalid('json', [1]);
      expectInvalid('json', null);
      expectInvalid('json', 'x');
    });
  });
});
