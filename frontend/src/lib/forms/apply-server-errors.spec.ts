import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { applyServerErrors } from './apply-server-errors';

interface Fields {
  email: string;
  username: string;
}

function setupForm() {
  return renderHook(() => {
    const form = useForm<Fields>({ defaultValues: { email: '', username: '' } });
    // Touch `errors` during render so RHF's formState proxy tracks it and `result.current`
    // re-renders (and stays fresh) when applyServerErrors calls setError.
    void form.formState.errors;
    return form;
  });
}

describe('applyServerErrors', () => {
  it('places VALIDATION_FAILED field details inline under their field', () => {
    const { result } = setupForm();
    const err = new ApiError(400, {
      code: 'VALIDATION_FAILED',
      message: 'dev message',
      details: [{ field: 'email', rule: 'isEmail' }],
    });
    act(() => {
      applyServerErrors(err, result.current);
    });
    expect(result.current.formState.errors.email?.message).toBe(
      'Please enter a valid email address.',
    );
    expect(result.current.formState.errors.root?.server).toBeUndefined();
  });

  it('renders a code-only error as a form-level (root) banner', () => {
    const { result } = setupForm();
    const err = new ApiError(401, { code: 'AUTH_INVALID_CREDENTIALS', message: 'dev' });
    act(() => {
      applyServerErrors(err, result.current);
    });
    expect(result.current.formState.errors.root?.server?.message).toBe(
      "That email and password don't match.",
    );
  });

  it('routes a code to a specific field when fieldForCode maps it', () => {
    const { result } = setupForm();
    const err = new ApiError(409, { code: 'USER_USERNAME_TAKEN', message: 'dev' });
    act(() => {
      applyServerErrors(err, result.current, { fieldForCode: { USER_USERNAME_TAKEN: 'username' } });
    });
    expect(result.current.formState.errors.username?.message).toBe(
      'That username is already taken. Please choose another.',
    );
    expect(result.current.formState.errors.root?.server).toBeUndefined();
  });

  it('falls back to a root banner for a non-ApiError value', () => {
    const { result } = setupForm();
    act(() => {
      applyServerErrors(new Error('boom'), result.current);
    });
    expect(result.current.formState.errors.root?.server?.message).toBeTruthy();
  });
});
