import { zodResolver } from '@hookform/resolvers/zod';
import { ERROR_CODES } from '@qalam/shared';
import { QButton } from '@qalam/ui';
import { CheckCircle2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { FormError, FormPasswordInput } from '@/components/form';
import { usePageTitle } from '@/hooks/use-page-title';
import { ApiError } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';
import { ROUTES } from '@/lib/routes';

import { AuthCard } from '../components/auth-card';
import { PasswordStrengthMeter } from '../components/password-strength-meter';
import { useResetPassword } from '../hooks/use-reset-password';
import { resetPasswordSchema, type ResetPasswordInput } from '../schemas/reset-password.schema';

export function ResetPasswordPage(): ReactElement {
  usePageTitle('Choose a new password');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const reset = useResetPassword();

  const [done, setDone] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onTouched',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const password = form.watch('newPassword');

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) {
      setLinkInvalid(true);
      return;
    }
    try {
      await reset.mutateAsync({ token, newPassword: values.newPassword });
      setDone(true);
    } catch (err) {
      // An invalid/expired/used token gets its own dedicated screen (not a field error).
      if (err instanceof ApiError && err.code === ERROR_CODES.AUTH_RESET_INVALID) {
        setLinkInvalid(true);
        return;
      }
      // AUTH_PASSWORD_WEAK (422) / VALIDATION_FAILED → banner or field.
      applyServerErrors(err, form);
    }
  });

  // Missing or rejected token → a clear dead-end with a way forward.
  if (!token || linkInvalid) {
    return (
      <AuthCard
        title="This link has expired"
        subtitle="Password-reset links are single-use and time-limited. Request a fresh one and we’ll email it right over."
        footer={
          <Link to={ROUTES.login} className="font-medium text-accent hover:underline">
            Back to sign in
          </Link>
        }
      >
        <QButton
          variant="primary"
          size="lg"
          block
          onClick={() => {
            void navigate(ROUTES.forgotPassword);
          }}
        >
          Request a new link
        </QButton>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard
        title="Password updated"
        subtitle="Your password has been changed. You can sign in with it now."
      >
        <div className="flex justify-center py-2 text-success">
          <CheckCircle2 size={40} strokeWidth={1.25} aria-hidden />
        </div>
        <QButton
          variant="primary"
          size="lg"
          block
          onClick={() => {
            void navigate(ROUTES.login, { replace: true });
          }}
        >
          Sign in
        </QButton>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Make it long and hard to guess.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={form.formState.errors.root?.server?.message} />
        <div className="flex flex-col gap-2">
          <FormPasswordInput
            control={form.control}
            name="newPassword"
            label="New password"
            autoComplete="new-password"
            placeholder="At least 10 characters"
            size="lg"
          />
          <PasswordStrengthMeter value={password} />
        </div>
        <FormPasswordInput
          control={form.control}
          name="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          size="lg"
        />
        <QButton variant="primary" size="lg" htmlType="submit" block loading={reset.isPending}>
          Update password
        </QButton>
      </form>
    </AuthCard>
  );
}
