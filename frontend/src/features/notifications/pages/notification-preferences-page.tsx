import { Switch } from 'antd';
import { QErrorState, QSpinner, useToast } from '@qalam/ui';
import type { ReactElement } from 'react';

import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId } from '@/lib/errors';

import { NotificationPreferencesForm } from '../components/notification-preferences-form';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../hooks/use-notification-preferences';
import { useNotificationsStore } from '../stores/notifications.store';
import type { NotificationPreferenceKey } from '../types/notification.types';

/**
 * Notification preferences (`/settings/notifications`, docs/06 §3.8) — the DELIVERY-GATING E9
 * categories (`PATCH /notification-preferences`), each toggle optimistic. Also exposes one local
 * device preference: whether to show a toast when new notifications arrive (there is no WebSocket;
 * freshness is polled). Rendered inside the settings shell's `<Outlet/>`.
 */
export function NotificationPreferencesPage(): ReactElement {
  usePageTitle('Notification settings');
  const toast = useToast();
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const toastsEnabled = useNotificationsStore((s) => s.toastsEnabled);
  const setToastsEnabled = useNotificationsStore((s) => s.setToastsEnabled);

  const onToggle = (key: NotificationPreferenceKey, value: boolean): void => {
    update.mutate(
      { [key]: value },
      {
        onError: (err) => {
          toast.error('Couldn’t save that', { description: getErrorMessage(err) });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-1 font-serif text-xl font-semibold text-ink">Notifications</h2>
        <p className="text-sm text-ink-secondary">
          Choose what you’re notified about. Turning a category off stops those notifications from
          being created.
        </p>
      </section>

      {prefs.isLoading ? (
        <div role="status" aria-label="Loading preferences" className="flex justify-center py-8">
          <QSpinner />
        </div>
      ) : prefs.isError ? (
        <QErrorState
          title="Couldn’t load your preferences."
          description={getErrorMessage(prefs.error)}
          requestId={getRequestId(prefs.error)}
          onRetry={() => {
            void prefs.refetch();
          }}
        />
      ) : prefs.data ? (
        <section aria-label="Notification categories">
          <NotificationPreferencesForm
            preferences={prefs.data}
            disabled={update.isPending}
            onToggle={onToggle}
          />
        </section>
      ) : null}

      <section className="border-line border-t pt-6">
        <div className="flex items-center justify-between gap-4">
          <span className="flex flex-col">
            <span className="text-sm font-medium text-ink">New-notification toasts</span>
            <span className="text-xs text-ink-muted">
              Show a brief toast on this device when new notifications arrive.
            </span>
          </span>
          <Switch
            checked={toastsEnabled}
            aria-label="New-notification toasts"
            onChange={setToastsEnabled}
          />
        </div>
      </section>
    </div>
  );
}
