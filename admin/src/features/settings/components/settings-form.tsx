import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@qalam/ui';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { getErrorMessage } from '@/lib/errors';

import { useUpdateSettings } from '../hooks/use-settings';
import { buildSettingsForm } from '../schemas/build-schema';
import { useSettingsUi } from '../stores/settings-ui.store';
import { useUnsavedChanges } from '../stores/unsaved-changes.store';
import type { Setting } from '../types/settings.types';
import { ConfigurationCard } from './configuration-card';
import { SaveBar } from './save-bar';
import { SettingGroup } from './setting-group';

interface SettingsFormProps {
  category: string;
  settings: Setting[];
  title: string;
  description: string;
  icon: LucideIcon;
  /** Optional honest note (e.g. storage usage is not exposed by the API). */
  note?: string;
}

/**
 * The data-driven Settings Form (A7) — renders + validates any category's
 * settings from their `dataType` + rules, with RHF + a dynamic Zod schema. Only
 * dirty fields are PATCHed; the form resets to server values after a save or an
 * external refetch. Syncs its dirty state to the unsaved-changes store so the
 * page can guard navigation.
 */
export function SettingsForm({
  category,
  settings,
  title,
  description,
  icon,
  note,
}: SettingsFormProps): ReactElement {
  const toast = useToast();
  const update = useUpdateSettings();
  const compact = useSettingsUi((state) => state.compact);
  const setDirty = useUnsavedChanges((state) => state.setDirty);

  const model = useMemo(() => buildSettingsForm(settings), [settings]);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(model.schema),
    defaultValues: model.defaults,
    mode: 'onChange',
  });

  // Re-sync when the server data changes (after a save or a background refetch).
  useEffect(() => reset(model.defaults), [model, reset]);

  // Publish dirty state to the store for the navigation blocker; clear on unmount.
  useEffect(() => {
    setDirty(isDirty);
    return () => setDirty(false);
  }, [isDirty, setDirty]);

  const dirtyCount = Object.keys(dirtyFields).length;

  const onSubmit = handleSubmit((values) => {
    const updates = model.fields
      .filter((field) => dirtyFields[field.name] === true)
      .map((field) => ({ key: field.key, value: values[field.name] }));
    if (updates.length === 0) {
      return;
    }
    update.mutate(
      { category, payload: { updates } },
      {
        onSuccess: () => {
          toast.success('Settings saved.');
          reset(values);
          setDirty(false);
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  });

  return (
    <form
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <ConfigurationCard title={title} description={description} icon={icon}>
        {model.fields.map((field) => (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            render={({ field: rhf }) => (
              <SettingGroup
                id={`setting-${field.name}`}
                setting={field.setting}
                value={rhf.value}
                onChange={rhf.onChange}
                error={errors[field.name]?.message as string | undefined}
                compact={compact}
              />
            )}
          />
        ))}
      </ConfigurationCard>

      {note !== undefined ? <p className="mt-2 text-xs text-ink-muted">{note}</p> : null}

      <SaveBar
        dirtyCount={dirtyCount}
        saving={update.isPending}
        onSave={() => void onSubmit()}
        onReset={() => reset(model.defaults)}
      />
    </form>
  );
}
