import { zodResolver } from '@hookform/resolvers/zod';
import { QButton } from '@qalam/ui';
import { useEffect, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { FormCheckbox, FormError, FormInput, FormPasswordInput } from '@/components/form';
import { usePageTitle } from '@/hooks/use-page-title';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

import { AuthCard } from '../components/auth-card';
import { GoogleButton } from '../components/google-button';
import { OrDivider } from '../components/or-divider';
import { useLogin } from '../hooks/use-login';
import { startGoogleLogin } from '../lib/google';
import { setRememberSession } from '../lib/remember';
import { loginSchema, type LoginInput } from '../schemas/login.schema';

function safeReturnTo(returnTo: string | null): string {
  return returnTo && returnTo.startsWith('/') ? returnTo : ROUTES.feed;
}

export function LoginPage(): ReactElement {
  usePageTitle('Sign in');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const login = useLogin();

  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const clearSessionExpired = useAuthStore((s) => s.clearSessionExpired);
  // Clear the "expired" reason on leave so a later, intentional visit is clean.
  useEffect(
    () => () => {
      clearSessionExpired();
    },
    [clearSessionExpired],
  );

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const destination = safeReturnTo(params.get('returnTo'));

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setRememberSession(values.rememberMe);
      clearSessionExpired();
      await login.mutateAsync({ email: values.email, password: values.password });
      void navigate(destination, { replace: true });
    } catch (err) {
      // AUTH_INVALID_CREDENTIALS / AUTH_ACCOUNT_SUSPENDED / RATE_LIMITED → form-level banner.
      applyServerErrors(err, form);
    }
  });

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to keep writing."
      footer={
        <>
          New to Qalam?{' '}
          <Link to={ROUTES.register} className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {sessionExpired ? <FormError message="Your session expired — please sign in again." /> : null}

      <GoogleButton
        onClick={() => {
          startGoogleLogin(destination);
        }}
        disabled={login.isPending}
      />
      <OrDivider />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={form.formState.errors.root?.server?.message} />
        <FormInput
          control={form.control}
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          size="lg"
        />
        <FormPasswordInput
          control={form.control}
          name="password"
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          size="lg"
        />
        <div className="flex items-center justify-between gap-3">
          <FormCheckbox control={form.control} name="rememberMe">
            Remember me
          </FormCheckbox>
          <Link
            to={ROUTES.forgotPassword}
            className="text-sm font-medium text-accent hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <QButton variant="primary" size="lg" htmlType="submit" block loading={login.isPending}>
          Sign in
        </QButton>
      </form>
    </AuthCard>
  );
}
