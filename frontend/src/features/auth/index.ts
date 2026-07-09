/**
 * Public surface of the auth feature — the **page components**, imported by the lazy route
 * modules in `app/routes/` (so all auth pages share one lazy `auth` chunk, docs/11 §9).
 *
 * NON-page entry points are imported deep, on purpose, to keep them out of the eager main
 * bundle / away from the pages: `lib/session` (`bootstrapSession`, used by app providers) and
 * `hooks/use-logout` (used by the shell). Do not re-export those here.
 */
export { LoginPage } from './pages/login-page';
export { RegisterPage } from './pages/register-page';
export { ForgotPasswordPage } from './pages/forgot-password-page';
export { ResetPasswordPage } from './pages/reset-password-page';
export { VerifyEmailPage } from './pages/verify-email-page';
export { GoogleCallbackPage } from './pages/google-callback-page';
