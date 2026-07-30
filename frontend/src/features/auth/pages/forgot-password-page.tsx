import { zodResolver } from '@hookform/resolvers/zod';
import { QButton } from '@qalam/ui';
import { MailCheck } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { FormError, FormInput } from '@/components/form';
import { usePageTitle } from '@/hooks/use-page-title';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';
import { ROUTES } from '@/lib/routes';

import { AuthCard } from '../components/auth-card';
import { useForgotPassword } from '../hooks/use-forgot-password';
import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas/forgot-password.schema';

export function ForgotPasswordPage(): ReactElement {
  usePageTitle('Reset your password');
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await forgot.mutateAsync({ email: values.email });
      // Always the same confirmation — the API never reveals whether the account exists.
      setSentTo(values.email);
    } catch (err) {
      applyServerErrors(err, form); // e.g. RATE_LIMITED → banner
    }
  });

  if (sentTo) {
    return (
      <AuthCard
        title="Check your inbox"
        subtitle={
          <>
            If an account exists for <span className="font-medium text-ink">{sentTo}</span>, we’ve
            sent a link to reset your password. It expires soon, so use it promptly.
          </>
        }
        footer={
          <Link to={ROUTES.login} className="font-medium text-accent hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="flex justify-center py-2 text-accent">
          <MailCheck size={40} strokeWidth={1.25} aria-hidden />
        </div>
        <QButton
          variant="secondary"
          block
          onClick={() => {
            setSentTo(null);
            form.reset();
          }}
        >
          Use a different email
        </QButton>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we’ll send you a reset link."
      footer={
        <Link to={ROUTES.login} className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
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
        <QButton variant="primary" size="lg" htmlType="submit" block loading={forgot.isPending}>
          Send reset link
        </QButton>
      </form>
    </AuthCard>
  );
}
