import { zodResolver } from '@hookform/resolvers/zod';
import { QButton, useToast } from '@qalam/ui';
import { Input, Select, Switch } from 'antd';
import { Wrench } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { EmptyState } from '@/components/empty-state';
import { getErrorMessage } from '@/lib/errors';

import { useMaintenance, useUpdateMaintenance } from '../hooks/use-maintenance';
import { maintenanceSchema, type MaintenanceFormValues } from '../schemas/maintenance.schema';
import { MAINTENANCE_ROLE_OPTIONS } from '../settings.constants';
import { useUnsavedChanges } from '../stores/unsaved-changes.store';
import type { UpdateMaintenancePayload } from '../types/settings.types';
import { ConfigurationCard } from './configuration-card';
import { SettingsSkeleton } from './settings-skeleton';

const pad = (value: number): string => String(value).padStart(2, '0');

/** ISO 8601 → `YYYY-MM-DDTHH:mm` for a `datetime-local` input (local time). */
function isoToLocalInput(iso: string | null): string {
  if (iso === null || iso === '') return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `datetime-local` value → ISO 8601 (undefined when blank — the API can't clear it). */
function localInputToIso(local: string): string | undefined {
  if (local === '') return undefined;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement;
}): ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      {hint !== undefined ? <span className="text-xs text-ink-muted">{hint}</span> : null}
      {children}
      {error !== undefined ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

/**
 * Maintenance Mode configuration (A7). Enabling maintenance is consequential, so
 * turning it ON prompts a confirmation before applying. Integrates with
 * `/admin/maintenance`.
 */
export function MaintenanceSection(): ReactElement {
  const toast = useToast();
  const query = useMaintenance();
  const update = useUpdateMaintenance();
  const setDirty = useUnsavedChanges((state) => state.setDirty);
  const [confirmEnable, setConfirmEnable] = useState<MaintenanceFormValues | null>(null);

  const data = query.data;
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    values: data
      ? {
          enabled: data.enabled,
          message: data.message,
          estimatedCompletion: isoToLocalInput(data.estimatedCompletion),
          allowedRoles: data.allowedRoles as MaintenanceFormValues['allowedRoles'],
        }
      : undefined,
  });

  useEffect(() => {
    setDirty(isDirty);
    return () => setDirty(false);
  }, [isDirty, setDirty]);

  const apply = (values: MaintenanceFormValues): void => {
    const payload: UpdateMaintenancePayload = {
      enabled: values.enabled,
      message: values.message,
      allowedRoles: values.allowedRoles,
    };
    const iso = localInputToIso(values.estimatedCompletion);
    if (iso !== undefined) payload.estimatedCompletion = iso;
    update.mutate(payload, {
      onSuccess: () => {
        toast.success('Maintenance settings saved.');
        reset(values);
        setDirty(false);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  };

  const onSubmit = handleSubmit((values) => {
    // Turning maintenance ON is consequential — confirm first.
    if (values.enabled && data?.enabled === false) {
      setConfirmEnable(values);
      return;
    }
    apply(values);
  });

  if (query.isLoading || data === undefined) {
    return query.isError ? (
      <EmptyState
        title="Couldn’t load maintenance settings"
        description={getErrorMessage(query.error)}
        action={
          <QButton variant="secondary" size="sm" onClick={() => void query.refetch()}>
            Retry
          </QButton>
        }
      />
    ) : (
      <SettingsSkeleton rows={4} />
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <ConfigurationCard
        title="Maintenance mode"
        description="Take the platform offline for scheduled work. Allowed roles keep access."
        icon={Wrench}
      >
        <div className="flex flex-col gap-5 py-4">
          <Controller
            name="enabled"
            control={control}
            render={({ field }) => (
              <Field
                label="Maintenance mode"
                hint="When on, only allowed roles can access the platform."
              >
                <div>
                  <Switch
                    checked={field.value}
                    onChange={field.onChange}
                    aria-label="Maintenance mode"
                  />
                </div>
              </Field>
            )}
          />
          <Controller
            name="message"
            control={control}
            render={({ field }) => (
              <Field label="Maintenance message" error={errors.message?.message}>
                <Input.TextArea {...field} rows={3} maxLength={500} />
              </Field>
            )}
          />
          <Controller
            name="estimatedCompletion"
            control={control}
            render={({ field }) => (
              <Field label="Estimated completion" hint="Optional. Shown to visitors.">
                <input
                  type="datetime-local"
                  value={field.value}
                  onChange={field.onChange}
                  className="w-full max-w-xs rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink"
                  aria-label="Estimated completion"
                />
              </Field>
            )}
          />
          <Controller
            name="allowedRoles"
            control={control}
            render={({ field }) => (
              <Field label="Allowed roles" hint="Roles that keep access during maintenance.">
                <Select
                  mode="multiple"
                  value={field.value}
                  onChange={field.onChange}
                  options={MAINTENANCE_ROLE_OPTIONS}
                  className="w-full max-w-md"
                  aria-label="Allowed roles"
                />
              </Field>
            )}
          />
          <div className="flex items-center gap-2">
            <QButton
              variant="primary"
              size="sm"
              onClick={() => void onSubmit()}
              loading={update.isPending}
              disabled={!isDirty}
            >
              Save changes
            </QButton>
            <QButton
              variant="secondary"
              size="sm"
              onClick={() => reset()}
              disabled={!isDirty || update.isPending}
            >
              Reset
            </QButton>
          </div>
        </div>
      </ConfigurationCard>

      <ConfirmationDialog
        open={confirmEnable !== null}
        danger
        title="Enable maintenance mode?"
        message="Visitors without an allowed role will be locked out until you disable it."
        confirmLabel="Enable maintenance"
        loading={update.isPending}
        onConfirm={() => {
          if (confirmEnable !== null) apply(confirmEnable);
          setConfirmEnable(null);
        }}
        onCancel={() => setConfirmEnable(null)}
      />
    </form>
  );
}
