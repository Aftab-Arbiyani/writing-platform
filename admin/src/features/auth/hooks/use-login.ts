import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { setRemember } from '@/lib/remember';
import { useAuthStore } from '@/stores/auth.store';

import { authApi } from '../api/auth.api';
import type { LoginFormValues } from '../schemas/login.schema';
import type { AuthResponse } from '../types/auth.types';

/**
 * Login mutation (docs/32 §3). On success it persists the remember-me preference and establishes the
 * session (decode role → stash token in api-client memory → status authenticated). Redirect is the
 * page's job (returnTo), not the hook's. Errors carry the `@qalam/shared` code for the form to map.
 */
export function useLogin(): UseMutationResult<AuthResponse, Error, LoginFormValues> {
  return useMutation<AuthResponse, Error, LoginFormValues>({
    mutationFn: (values) => authApi.login({ email: values.email, password: values.password }),
    onSuccess: (data, values) => {
      setRemember(values.rememberMe);
      useAuthStore.getState().setSession(data.accessToken);
    },
  });
}
