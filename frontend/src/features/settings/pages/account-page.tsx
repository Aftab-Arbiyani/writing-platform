import { zodResolver } from '@hookform/resolvers/zod';
import { QButton, QSpinner, useConfirm, useToast } from '@qalam/ui';
import { Lock, LogOut } from 'lucide-react';
import type { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { FormError, FormPasswordInput } from '@/components/form';
import { useMe } from '@/hooks/use-me';
import { usePageTitle } from '@/hooks/use-page-title';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';
import { ROUTES } from '@/lib/routes';

import { useChangePassword, useLogoutAll } from '../hooks/use-account';
import { passwordSchema, type PasswordFormInput } from '../schemas/password.schema';

const PASSWORD_DEFAULTS: PasswordFormInput = {
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
};

/**
 * Account settings (`/settings/account`, docs/06 §3.8, docs/26 §9): the permanent username shown
 * read-only with a lock, a change-password form (`POST /auth/change-password` — re-auths, rotates
 * this session, revokes others), and "Sign out everywhere" (`POST /auth/logout-all`). Email,
 * connected accounts, and account deletion have no `v1` endpoint (docs/32 §11) — surfaced as an
 * honest note rather than faked.
 */
export function AccountPage(): ReactElement {
  usePageTitle('Account');
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const me = useMe();
  const changePassword = useChangePassword();
  const logoutAll = useLogoutAll();

  const form = useForm<PasswordFormInput>({
    resolver: zodResolver(passwordSchema),
    mode: 'onTouched',
    defaultValues: PASSWORD_DEFAULTS,
  });

  const onSubmit = form.handleSubmit((values) => {
    changePassword.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          toast.success('Password changed', {
            description: 'You’ve been signed out on your other devices.',
          });
          form.reset(PASSWORD_DEFAULTS);
        },
        onError: (err) => {
          applyServerErrors(err, form, {
            fieldForCode: {
              AUTH_CURRENT_PASSWORD_INVALID: 'currentPassword',
              AUTH_PASSWORD_WEAK: 'newPassword',
            },
          });
        },
      },
    );
  });

  const onSignOutEverywhere = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Sign out of all devices?',
      content: 'You’ll need to sign in again here and everywhere else.',
      okText: 'Sign out everywhere',
      danger: true,
    });
    if (!ok) return;
    logoutAll.mutate(undefined, {
      onSettled: () => {
        void navigate(ROUTES.login, { replace: true });
      },
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-1 font-serif text-xl font-semibold text-ink">Account</h2>
        <p className="text-sm text-ink-secondary">Your sign-in and security.</p>
      </section>

      {/* Username — permanent, read-only (docs/06 §3.8; ADR §4). */}
      <section className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Username</span>
        {me.isLoading ? (
          <QSpinner />
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-line bg-raised px-3 py-2">
            <Lock size={16} strokeWidth={1.5} className="text-ink-muted" aria-hidden />
            <span dir="ltr" className="text-sm text-ink">
              <bdi>@{me.data?.username ?? ''}</bdi>
            </span>
          </div>
        )}
        <p className="text-xs text-ink-muted">Usernames are permanent and can’t be changed.</p>
      </section>

      {/* Change password. */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Change password</h3>
        <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-4">
          <FormPasswordInput
            control={form.control}
            name="currentPassword"
            label="Current password"
            autoComplete="current-password"
          />
          <FormPasswordInput
            control={form.control}
            name="newPassword"
            label="New password"
            autoComplete="new-password"
          />
          <FormPasswordInput
            control={form.control}
            name="confirmNewPassword"
            label="Confirm new password"
            autoComplete="new-password"
          />
          <FormError message={form.formState.errors.root?.server?.message} />
          <div>
            <QButton variant="primary" htmlType="submit" loading={changePassword.isPending}>
              Update password
            </QButton>
          </div>
        </form>
      </section>

      {/* Sessions. */}
      <section className="border-t border-line pt-6">
        <h3 className="mb-1 text-sm font-semibold text-ink">Sessions</h3>
        <p className="mb-3 text-sm text-ink-secondary">
          Sign out of Qalam on every device, including this one.
        </p>
        <QButton
          variant="secondary"
          icon={LogOut}
          loading={logoutAll.isPending}
          onClick={() => {
            void onSignOutEverywhere();
          }}
        >
          Sign out everywhere
        </QButton>
      </section>

      {/* Documented v1 gaps — no endpoint to change email, manage connected accounts, or delete. */}
      <section className="border-t border-line pt-6">
        <h3 className="mb-1 text-sm font-semibold text-ink">Email &amp; account</h3>
        <p className="text-sm text-ink-muted">
          Changing your email, managing connected sign-in accounts, and deleting your account aren’t
          available yet — they’re coming in a later release.
        </p>
      </section>
    </div>
  );
}
