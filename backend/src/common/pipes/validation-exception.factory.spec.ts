import type { ValidationError } from '@nestjs/common';

import { flattenValidationErrors } from './validation-exception.factory';

/**
 * Unit tests for the validation flattener (docs 16 §7 — pipe logic is security/
 * contract surface). Verifies the docs 05 §3.2 details shape: flat field paths,
 * one entry per constraint.
 */
describe('flattenValidationErrors', () => {
  it('maps a top-level constraint to { field, rule, message }', () => {
    const errors: ValidationError[] = [
      { property: 'email', constraints: { isEmail: 'email must be an email' }, children: [] },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'email', rule: 'isEmail', message: 'email must be an email' },
    ]);
  });

  it('emits one detail per constraint on the same field', () => {
    const errors: ValidationError[] = [
      {
        property: 'password',
        constraints: { minLength: 'too short', matches: 'bad format' },
        children: [],
      },
    ];

    const details = flattenValidationErrors(errors);

    expect(details).toHaveLength(2);
    expect(details.map((d) => d.rule)).toEqual(['minLength', 'matches']);
  });

  it('builds dotted paths for nested objects', () => {
    const errors: ValidationError[] = [
      {
        property: 'profile',
        children: [
          { property: 'penName', constraints: { isString: 'must be a string' }, children: [] },
        ],
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'profile.penName', rule: 'isString', message: 'must be a string' },
    ]);
  });

  it('builds bracketed paths for array items', () => {
    const errors: ValidationError[] = [
      {
        property: 'tags',
        children: [{ property: '5', constraints: { maxLength: 'too long' }, children: [] }],
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'tags[5]', rule: 'maxLength', message: 'too long' },
    ]);
  });
});
