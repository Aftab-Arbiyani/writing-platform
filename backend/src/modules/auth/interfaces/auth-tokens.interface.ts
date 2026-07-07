/**
 * Token pair returned by auth flows (docs 05 §11). `refreshToken` is present
 * only for mobile clients; web clients receive it as an httpOnly cookie and see
 * only the `accessToken` in the body (ADR §3 / docs 05 §7).
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}
