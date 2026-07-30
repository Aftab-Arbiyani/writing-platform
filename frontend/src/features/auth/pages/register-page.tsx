import { zodResolver } from '@hookform/resolvers/zod';
import { ERROR_CODES } from '@qalam/shared';
import { QButton, useConfirm, useToast } from '@qalam/ui';
import type { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { FormCheckbox, FormError, FormInput, FormPasswordInput } from '@/components/form';
import { usePageTitle } from '@/hooks/use-page-title';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';
import { ROUTES } from '@/lib/routes';

import { AuthCard } from '../components/auth-card';
import { GoogleButton } from '../components/google-button';
import { OrDivider } from '../components/or-divider';
import { PasswordStrengthMeter } from '../components/password-strength-meter';
import { UsernamePermanenceCallout } from '../components/username-permanence-callout';
import { useRegister } from '../hooks/use-register';
import { startGoogleLogin } from '../lib/google';
import { registerSchema, type RegisterInput } from '../schemas/register.schema';

export function RegisterPage(): ReactElement {
  usePageTitle('Create your account');
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const register = useRegister();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const password = form.watch('password');

  const onSubmit = form.handleSubmit(async (values) => {
    // The one deliberate confirm in onboarding — username is permanent (docs/06 §3.7).
    const confirmed = await confirm({
      title: 'Write it in ink?',
      content: (
        <span className="block">
          <span className="mb-2 block font-serif text-3xl font-semibold text-ink">
            @{values.username}
          </span>
          Your username is permanent and can’t be changed later.
        </span>
      ),
      okText: 'Yes, this is me',
      cancelText: 'Choose again',
    });
    if (!confirmed) return;

    try {
      const data = await register.mutateAsync({
        email: values.email,
        username: values.username,
        password: values.password,
      });
      toast.success('Welcome to Qalam', {
        description: 'Check your inbox to verify your email.',
      });
      void navigate(ROUTES.verifyEmail, { replace: true, state: { email: data.user.email } });
    } catch (err) {
      applyServerErrors(err, form, {
        fieldForCode: {
          [ERROR_CODES.AUTH_EMAIL_TAKEN]: 'email',
          [ERROR_CODES.USER_USERNAME_TAKEN]: 'username',
        },
      });
    }
  });

  return (
    <AuthCard
      title="Create your account"
      subtitle="A quiet place to write in Hindi and Urdu."
      footer={
        <>
          Already have an account?{' '}
          <Link to={ROUTES.login} className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton
        onClick={() => {
          startGoogleLogin(ROUTES.feed);
        }}
        disabled={register.isPending}
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
        <div className="flex flex-col gap-2">
          <FormInput
            control={form.control}
            name="username"
            label="Username"
            autoComplete="username"
            placeholder="meera_k"
            size="lg"
          />
          <UsernamePermanenceCallout />
        </div>
        <div className="flex flex-col gap-2">
          <FormPasswordInput
            control={form.control}
            name="password"
            label="Password"
            autoComplete="new-password"
            placeholder={`At least 10 characters`}
            size="lg"
          />
          <PasswordStrengthMeter value={password} />
        </div>
        <FormPasswordInput
          control={form.control}
          name="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          size="lg"
        />
        <FormCheckbox control={form.control} name="acceptTerms">
          I agree to the Terms of Service and Privacy Policy.
        </FormCheckbox>
        <QButton variant="primary" size="lg" htmlType="submit" block loading={register.isPending}>
          Create account
        </QButton>
      </form>
    </AuthCard>
  );
}
