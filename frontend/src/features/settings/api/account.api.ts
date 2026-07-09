import { post } from '@/lib/api-client';

/** `POST /auth/change-password` rotates the current session → returns a fresh access token. */
interface TokenResponse {
  accessToken: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/**
 * Account security endpoints (docs/11 §10, docs/32 §10). Change-password re-auths with the
 * current password, revokes every OTHER session, and issues a fresh token for THIS one (the hook
 * must adopt the returned token). Logout-all revokes every session INCLUDING this one (the hook
 * then clears local state + returns to sign-in). There is no v1 delete-account endpoint.
 */
export const accountApi = {
  changePassword: (payload: ChangePasswordPayload): Promise<TokenResponse> =>
    post<TokenResponse>('/auth/change-password', payload),

  logoutAll: (): Promise<void> => post<void>('/auth/logout-all'),
};
