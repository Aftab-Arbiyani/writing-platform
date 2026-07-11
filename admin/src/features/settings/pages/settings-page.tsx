import { QButton } from '@qalam/ui';
import { Select, Switch } from 'antd';
import { AlertTriangle, WifiOff } from 'lucide-react';
import { lazy, Suspense, useMemo, useState, type ReactElement } from 'react';
import { useBlocker, useSearchParams } from 'react-router';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage } from '@/lib/errors';

import { MaintenanceBanner } from '../components/maintenance-banner';
import { SettingsForm } from '../components/settings-form';
import { SettingsNav } from '../components/settings-nav';
import { SettingsSkeleton } from '../components/settings-skeleton';
import { UnsavedChangesDialog } from '../components/unsaved-changes-dialog';
import { useSettings } from '../hooks/use-settings';
import {
  DEFAULT_SECTION,
  GENERAL_SECTION,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from '../settings.constants';
import { useSettingsUi } from '../stores/settings-ui.store';
import { useUnsavedChanges } from '../stores/unsaved-changes.store';

// Lazy-loaded, heavier sections (docs — lazy-loaded settings sections).
const LazyFeatureFlagTable = lazy(() =>
  import('../components/feature-flag-table').then((m) => ({ default: m.FeatureFlagTable })),
);
const LazyMaintenanceSection = lazy(() =>
  import('../components/maintenance-section').then((m) => ({ default: m.MaintenanceSection })),
);

const STORAGE_NOTE =
  'Live storage usage isn’t exposed by the settings API — the fields below configure the provider, upload limits, and allowed file types.';

/**
 * System Settings (A7) — a two-pane console: section nav (left) + the active
 * section's form (right). The active section lives in the URL (`?section=`); a
 * dirty form guards both in-page section switches and navigation away. Generic
 * settings render through the data-driven `SettingsForm`; Feature Flags and
 * Maintenance are lazy-loaded dedicated surfaces. Admin-only (route-gated).
 */
export function SettingsPage(): ReactElement {
  usePageTitle('Settings');
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsQuery = useSettings();

  const dirty = useUnsavedChanges((state) => state.dirty);
  const setDirty = useUnsavedChanges((state) => state.setDirty);
  const lastSection = useSettingsUi((state) => state.lastSection);
  const setLastSection = useSettingsUi((state) => state.setLastSection);
  const compact = useSettingsUi((state) => state.compact);
  const toggleCompact = useSettingsUi((state) => state.toggleCompact);

  const settings = settingsQuery.data;

  // Hide settings-categories the API doesn't return; keep flags + maintenance always.
  const availableSections = useMemo<readonly SettingsSection[]>(() => {
    if (settings === undefined) return SETTINGS_SECTIONS;
    const categories = new Set(settings.map((setting) => setting.category));
    return SETTINGS_SECTIONS.filter(
      (section) =>
        section.kind !== 'settings' ||
        section.category === null ||
        categories.has(section.category),
    );
  }, [settings]);

  const requested = searchParams.get('section') ?? lastSection;
  const activeSection: SettingsSection =
    availableSections.find((section) => section.key === requested) ??
    availableSections.find((section) => section.key === DEFAULT_SECTION) ??
    availableSections[0] ??
    GENERAL_SECTION;

  // Unsaved-changes guards: cross-route (useBlocker) + in-page section switch.
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  const applySection = (key: string): void => {
    const next = new URLSearchParams(searchParams);
    next.set('section', key);
    setSearchParams(next);
    setLastSection(key);
  };

  const requestSection = (key: string): void => {
    if (key === activeSection.key) return;
    if (dirty) {
      setPendingSection(key);
      return;
    }
    applySection(key);
  };

  const dialogOpen = blocker.state === 'blocked' || pendingSection !== null;
  const onDiscard = (): void => {
    setDirty(false);
    if (blocker.state === 'blocked') {
      blocker.proceed();
    } else if (pendingSection !== null) {
      applySection(pendingSection);
      setPendingSection(null);
    }
  };
  const onCancelLeave = (): void => {
    if (blocker.state === 'blocked') {
      blocker.reset();
    } else {
      setPendingSection(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Global platform configuration."
        actions={
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <Switch
              size="small"
              checked={compact}
              onChange={toggleCompact}
              aria-label="Compact layout"
            />
            Compact
          </label>
        }
      />

      <MaintenanceBanner />

      {/* Mobile section picker (the sidebar is desktop/tablet). */}
      <div className="lg:hidden">
        <Select
          value={activeSection.key}
          onChange={requestSection}
          options={availableSections.map((section) => ({
            label: section.label,
            value: section.key,
          }))}
          className="w-full"
          aria-label="Settings section"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <SettingsNav
            sections={availableSections}
            activeKey={activeSection.key}
            onSelect={requestSection}
          />
        </aside>

        <div className="min-w-0">
          <SettingsContent
            section={activeSection}
            settings={settings}
            loading={settingsQuery.isLoading}
            error={settingsQuery.isError ? settingsQuery.error : null}
            onRetry={() => void settingsQuery.refetch()}
          />
        </div>
      </div>

      <UnsavedChangesDialog open={dialogOpen} onDiscard={onDiscard} onCancel={onCancelLeave} />
    </PageContainer>
  );
}

/** Chooses the right surface for the active section (settings form / flags / maintenance). */
function SettingsContent({
  section,
  settings,
  loading,
  error,
  onRetry,
}: {
  section: SettingsSection;
  settings: ReturnType<typeof useSettings>['data'];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}): ReactElement {
  if (section.kind === 'feature-flags') {
    return (
      <Suspense fallback={<SettingsSkeleton rows={4} />}>
        <LazyFeatureFlagTable />
      </Suspense>
    );
  }
  if (section.kind === 'maintenance') {
    return (
      <Suspense fallback={<SettingsSkeleton rows={4} />}>
        <LazyMaintenanceSection />
      </Suspense>
    );
  }

  if (loading) {
    return <SettingsSkeleton />;
  }
  if (error !== null) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    return (
      <EmptyState
        icon={offline ? WifiOff : AlertTriangle}
        title={offline ? 'You’re offline' : 'Couldn’t load settings'}
        description={offline ? 'Reconnect to load platform settings.' : getErrorMessage(error)}
        action={
          <QButton variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </QButton>
        }
      />
    );
  }

  const sectionSettings = (settings ?? []).filter(
    (setting) => setting.category === section.category,
  );
  if (sectionSettings.length === 0) {
    return (
      <EmptyState
        title="Configuration missing"
        description="No settings are available in this section yet."
      />
    );
  }

  return (
    <SettingsForm
      key={section.key}
      category={section.category ?? ''}
      settings={sectionSettings}
      title={section.label}
      description={section.description}
      icon={section.icon}
      note={section.category === 'storage' ? STORAGE_NOTE : undefined}
    />
  );
}
