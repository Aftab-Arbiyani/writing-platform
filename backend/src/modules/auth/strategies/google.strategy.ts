/**
 * Google OAuth strategy — PLACEHOLDER (Epic 1 task 6).
 *
 * Intentionally not implemented and NOT registered in `AuthModule`: Google
 * sign-in is scoped into Epic 1, and Apple is Phase 2 (ADR §3). This file marks
 * the seam so the implementation lands in an obvious place.
 *
 * When implemented it will:
 *   - add `passport-google-oauth20` (+ `@types/passport-google-oauth20`),
 *   - use the OAuth **authorization-code + PKCE** flow (ADR §3 / docs 13),
 *   - read `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from `jwtConfig`,
 *   - `validate()` → find-or-link an `auth_identities` row (link when the Google
 *     email matches a verified account email),
 *   - be registered as a provider in `AuthModule` and guarded by a
 *     `GoogleAuthGuard`.
 *
 * Shape it will take (kept as a comment so the file adds no unused dependency):
 *
 *   @Injectable()
 *   export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
 *     constructor(@Inject(jwtConfig.KEY) config: ConfigType<typeof jwtConfig>) {
 *       super({
 *         clientID: config.googleClientId,
 *         clientSecret: config.googleClientSecret,
 *         callbackURL: `${apiUrl}/api/v1/auth/google/callback`,
 *         scope: ['email', 'profile'],
 *       });
 *     }
 *     async validate(_accessToken, _refreshToken, profile) { ... }
 *   }
 */
export {};
