import { zodResolver } from '@hookform/resolvers/zod';
import { QButton, useToast } from '@qalam/ui';
import { Input, InputNumber, Select, Switch } from 'antd';
import type { ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Modal } from '@/components/modal';
import { getErrorMessage } from '@/lib/errors';

import { useCreateFeatureFlag, useUpdateFeatureFlag } from '../hooks/use-feature-flags';
import {
  createFeatureFlagSchema,
  type CreateFeatureFlagValues,
} from '../schemas/feature-flag.schema';
import { ENVIRONMENT_OPTIONS } from '../settings.constants';
import type { EnvironmentScope, FeatureFlag } from '../types/settings.types';

interface FeatureFlagDialogProps {
  /** The flag being edited, or null when creating. */
  flag: FeatureFlag | null;
  open: boolean;
  onClose: () => void;
}

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

/** Create or edit a feature flag (A7). Key is immutable once created. */
export function FeatureFlagDialog({ flag, open, onClose }: FeatureFlagDialogProps): ReactElement {
  const toast = useToast();
  const create = useCreateFeatureFlag();
  const update = useUpdateFeatureFlag();
  const isEdit = flag !== null;
  const saving = create.isPending || update.isPending;

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CreateFeatureFlagValues>({
    resolver: zodResolver(createFeatureFlagSchema),
    defaultValues: {
      key: flag?.key ?? '',
      enabled: flag?.enabled ?? false,
      rolloutPercentage: flag?.rolloutPercentage ?? 0,
      environment: flag?.environment ?? 'all',
      description: flag?.description ?? '',
    },
  });

  const onSubmit = handleSubmit((values) => {
    const onSuccess = (): void => {
      toast.success(isEdit ? 'Flag updated.' : 'Flag created.');
      onClose();
    };
    const onError = (error: unknown): void => toast.error(getErrorMessage(error));

    if (isEdit) {
      update.mutate(
        {
          id: flag.id,
          payload: {
            enabled: values.enabled,
            rolloutPercentage: values.rolloutPercentage,
            environment: values.environment as EnvironmentScope,
            description: values.description,
          },
        },
        { onSuccess, onError },
      );
    } else {
      create.mutate(values, { onSuccess, onError });
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={isEdit ? `Edit ${flag.key}` : 'New feature flag'}
      footer={
        <div className="flex justify-end gap-2">
          <QButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </QButton>
          <QButton
            variant="primary"
            onClick={() => void onSubmit()}
            loading={saving}
            disabled={isEdit && !isDirty}
          >
            {isEdit ? 'Save changes' : 'Create flag'}
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
          name="key"
          control={control}
          render={({ field }) => (
            <Field label="Key" error={errors.key?.message}>
              <Input {...field} placeholder="feature.ai.enabled" disabled={isEdit} />
            </Field>
          )}
        />
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Field label="Description" error={errors.description?.message}>
              <Input.TextArea {...field} rows={2} maxLength={300} />
            </Field>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="environment"
            control={control}
            render={({ field }) => (
              <Field label="Environment" error={errors.environment?.message}>
                <Select {...field} options={ENVIRONMENT_OPTIONS} className="w-full" />
              </Field>
            )}
          />
          <Controller
            name="rolloutPercentage"
            control={control}
            render={({ field }) => (
              <Field label="Rollout %" error={errors.rolloutPercentage?.message}>
                <InputNumber
                  className="w-full"
                  min={0}
                  max={100}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? 0)}
                />
              </Field>
            )}
          />
        </div>
        <Controller
          name="enabled"
          control={control}
          render={({ field }) => (
            <Field label="Enabled">
              <div>
                <Switch checked={field.value} onChange={field.onChange} />
              </div>
            </Field>
          )}
        />
      </form>
    </Modal>
  );
}
