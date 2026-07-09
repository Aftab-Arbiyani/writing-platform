import { Visibility, type ThemePreference } from '@qalam/shared';
import { QErrorState, QSelect, QSpinner, useToast } from '@qalam/ui';
import type { ReactElement } from 'react';

import { usePageTitle } from '@/hooks/use-page-title';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage, getRequestId } from '@/lib/errors';

import { NotificationPreferences } from '../components/notification-preferences';
import { ThemePicker } from '../components/theme-picker';
import { useSettings, useUpdateSettings } from '../hooks/use-settings';

const VISIBILITY_OPTIONS = [
  { value: Visibility.Public, label: 'Public — anyone can read' },
  { value: Visibility.Unlisted, label: 'Unlisted — only people with the link' },
  { value: Visibility.Private, label: 'Private — only you' },
];

/**
 * Appearance & preferences (`/settings/appearance`, docs/06 §3.8, docs/26 §9). Theme is driven by
 * the local `useThemeStore` (instant, pre-paint) AND persisted to `PATCH /settings.theme` for
 * cross-device sync (docs/12 §2.4). Default piece visibility + notification flags are
 * save-on-interaction. Reading size / reduced-motion overrides aren't backed by `v1` (honored via
 * the OS setting + MotionProvider) so they're omitted rather than faked.
 */
export function AppearancePage(): ReactElement {
  usePageTitle('Appearance');
  const toast = useToast();
  const { mode, setMode } = useTheme();
  const settings = useSettings();
  const update = useUpdateSettings();

  const onThemeChange = (value: ThemePreference): void => {
    setMode(value); // instant local render
    update.mutate(
      { theme: value },
      {
        onError: (err) =>
          toast.error('Couldn’t save your theme', { description: getErrorMessage(err) }),
      },
    );
  };

  const onVisibilityChange = (value: Visibility): void => {
    update.mutate(
      { defaultPieceVisibility: value },
      {
        onSuccess: () => toast.success('Saved'),
        onError: (err) => toast.error('Couldn’t save that', { description: getErrorMessage(err) }),
      },
    );
  };

  const onNotificationToggle = (key: string, value: boolean): void => {
    const current = settings.data?.notificationPreferences ?? {};
    update.mutate(
      { notificationPreferences: { ...current, [key]: value } },
      {
        onError: (err) => toast.error('Couldn’t save that', { description: getErrorMessage(err) }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-1 font-serif text-xl font-semibold text-ink">Appearance</h2>
        <p className="text-sm text-ink-secondary">How Qalam looks and what you hear about.</p>
      </section>

      {/* Theme — always available (local store). */}
      <section>
        <ThemePicker value={mode as ThemePreference} onChange={onThemeChange} />
      </section>

      {/* Preferences backed by GET/PATCH /settings. */}
      {settings.isLoading ? (
        <div role="status" aria-label="Loading preferences" className="flex justify-center py-8">
          <QSpinner />
        </div>
      ) : settings.isError ? (
        <QErrorState
          title="Couldn’t load your preferences."
          description={getErrorMessage(settings.error)}
          requestId={getRequestId(settings.error)}
          onRetry={() => {
            void settings.refetch();
          }}
        />
      ) : settings.data ? (
        <>
          <section className="max-w-md">
            <QSelect
              label="Default visibility for new pieces"
              hint="You can still change this for each piece."
              value={settings.data.defaultPieceVisibility}
              onChange={(value) => {
                if (typeof value === 'string') onVisibilityChange(value as Visibility);
              }}
              options={VISIBILITY_OPTIONS}
            />
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold text-ink">Notifications</h3>
            <p className="mb-2 text-xs text-ink-muted">
              Choose what you’d like to hear about. Delivery arrives in a later release.
            </p>
            <NotificationPreferences
              preferences={settings.data.notificationPreferences}
              disabled={update.isPending}
              onToggle={onNotificationToggle}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
