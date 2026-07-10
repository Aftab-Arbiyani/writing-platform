import { describe, expect, it } from 'vitest';

import { ApiError, getAccessToken, setAccessToken } from '@/lib/api-client';

describe('api-client', () => {
  it('stores and clears the in-memory access token', () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken('token-123');
    expect(getAccessToken()).toBe('token-123');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it('ApiError carries the status, code, and requestId', () => {
    const error = new ApiError(403, {
      code: 'AUTH_FORBIDDEN',
      message: 'nope',
      requestId: 'req-1',
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(403);
    expect(error.code).toBe('AUTH_FORBIDDEN');
    expect(error.requestId).toBe('req-1');
  });
});
