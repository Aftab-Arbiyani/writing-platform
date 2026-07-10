import { zodResolver } from '@hookform/resolvers/zod';
import { QButton, QInput } from '@qalam/ui';
import { Checkbox } from 'antd';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { getErrorMessage } from '@/lib/errors';

import { useLogin } from '../hooks/use-login';
import { loginSchema, type LoginFormValues } from '../schemas/login.schema';

/**
 * Admin sign-in form (docs/27, docs/33) — RHF + Zod, labelled `QInput`s with a11y error wiring, a
 * password visibility toggle (`aria-pressed`), a remember-me checkbox, and a loading submit. Server
 * errors (bad credentials, suspended, …) surface as a single form-level alert mapped from the
 * `@qalam/shared` error code. The token/session handling lives in `useLogin`; redirect is `onSuccess`.
 */
export interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps): ReactElement {
  const login = useLogin();
  const [visible, setVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: () => onSuccess(),
      onError: (error) => setFormError(getErrorMessage(error)),
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md bg-danger/12 px-3 py-2 text-sm text-danger"
        >
          {formError}
        </div>
      ) : null}

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <QInput
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@qalam.app"
            value={field.value}
            name={field.name}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            disabled={login.isPending}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <QInput
            label="Password"
            type={visible ? 'text' : 'password'}
            autoComplete="current-password"
            value={field.value}
            name={field.name}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            disabled={login.isPending}
            suffix={
              <button
                type="button"
                onClick={() => setVisible((previous) => !previous)}
                aria-label={visible ? 'Hide password' : 'Show password'}
                aria-pressed={visible}
                className="flex items-center text-ink-muted hover:text-ink-secondary"
              >
                {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            }
          />
        )}
      />

      <Controller
        control={control}
        name="rememberMe"
        render={({ field }) => (
          <Checkbox
            checked={field.value}
            onChange={(event) => field.onChange(event.target.checked)}
            disabled={login.isPending}
          >
            Remember me on this device
          </Checkbox>
        )}
      />

      <QButton htmlType="submit" variant="primary" size="lg" block loading={login.isPending}>
        Sign in
      </QButton>
    </form>
  );
}
