import { zodResolver } from '@hookform/resolvers/zod';
import { ROLE_RANK } from '@qalam/shared';
import { QButton, useToast } from '@qalam/ui';
import { Input, Select, Switch } from 'antd';
import type { ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Modal } from '@/components/modal';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/errors';

import { useUpdateUser } from '../hooks/use-user-mutations';
import { editUserSchema, type EditUserFormValues } from '../schemas/edit-user.schema';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '../users.constants';
import type { AdminUserListItem } from '../types/users.types';

interface EditUserModalProps {
  user: AdminUserListItem;
  isSelf: boolean;
  open: boolean;
  onClose: () => void;
}

/** Labelled field wrapper with an inline error slot. */
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactElement;
}): ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {error !== undefined ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

/** Edit display name / role / status / verification (PATCH /admin/users/:id). */
export function EditUserModal({ user, isSelf, open, onClose }: EditUserModalProps): ReactElement {
  const toast = useToast();
  const updateUser = useUpdateUser();
  const { role: operatorRole } = usePermissions();
  // Defense-in-depth: never OFFER a role above the operator's own rank (the
  // backend PBAC also blocks it). Always include the user's current role so it
  // still displays.
  const operatorRank = operatorRole !== null ? ROLE_RANK[operatorRole] : 0;
  const assignableRoles = ROLE_OPTIONS.filter(
    (option) => ROLE_RANK[option.value] <= operatorRank || option.value === user.role,
  );
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      displayName: user.displayName ?? user.username,
      role: user.role,
      status: user.status,
      verified: user.verified,
    },
  });

  const onSubmit = handleSubmit((values) => {
    updateUser.mutate(
      { id: user.id, payload: values },
      {
        onSuccess: () => {
          toast.success(`Updated @${user.username}.`);
          onClose();
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`Edit @${user.username}`}
      footer={
        <div className="flex justify-end gap-2">
          <QButton variant="secondary" onClick={onClose} disabled={updateUser.isPending}>
            Cancel
          </QButton>
          <QButton
            variant="primary"
            onClick={() => void onSubmit()}
            loading={updateUser.isPending}
            disabled={!isDirty}
          >
            Save changes
          </QButton>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <Controller
          name="displayName"
          control={control}
          render={({ field }) => (
            <Field label="Display name" error={errors.displayName?.message}>
              <Input {...field} maxLength={50} />
            </Field>
          )}
        />
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <Field label="Role" error={errors.role?.message}>
              <Select {...field} options={assignableRoles} disabled={isSelf} />
            </Field>
          )}
        />
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Field label="Status" error={errors.status?.message}>
              <Select {...field} options={STATUS_OPTIONS} disabled={isSelf} />
            </Field>
          )}
        />
        <Controller
          name="verified"
          control={control}
          render={({ field }) => (
            <Field label="Email verified">
              <div>
                <Switch checked={field.value} onChange={field.onChange} />
              </div>
            </Field>
          )}
        />
        {isSelf ? (
          <p className="text-xs text-ink-muted">
            Role and status are locked when editing your own account.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
