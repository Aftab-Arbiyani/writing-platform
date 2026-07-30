import {
  Bell,
  FileText,
  Flag,
  Gavel,
  HardDrive,
  KeyRound,
  Languages,
  Mail,
  Palette,
  Settings2,
  ShieldCheck,
  UserPlus,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/** What renders on the right when a section is active. */
export type SectionKind = 'settings' | 'feature-flags' | 'maintenance';

export interface SettingsSection {
  /** URL slug (`?section=`). */
  key: string;
  /** Backend settings category (for `kind: 'settings'`), else null. */
  category: string | null;
  label: string;
  description: string;
  icon: LucideIcon;
  group: string;
  kind: SectionKind;
}

/**
 * The Settings navigation map (A7). Generic settings categories render through the
 * data-driven `SettingsForm`; Feature Flags and Maintenance get dedicated
 * surfaces. Order here is the nav order. A category with no settings returned by
 * the API is hidden by the nav, so this can stay ahead of the backend.
 */
/** The default section — also the definite fallback when none matches. */
export const GENERAL_SECTION: SettingsSection = {
  key: 'general',
  category: 'general',
  label: 'General',
  description: 'Platform identity, default language, timezone, and formats.',
  icon: Settings2,
  group: 'Platform',
  kind: 'settings',
};

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  GENERAL_SECTION,
  {
    key: 'appearance',
    category: 'appearance',
    label: 'Appearance',
    description: 'Default theme and brand colours.',
    icon: Palette,
    group: 'Platform',
    kind: 'settings',
  },
  {
    key: 'localization',
    category: 'localization',
    label: 'Localization',
    description: 'Locales offered in the UI and RTL support.',
    icon: Languages,
    group: 'Platform',
    kind: 'settings',
  },
  {
    key: 'authentication',
    category: 'authentication',
    label: 'Authentication',
    description: 'Sign-in methods, password policy, and sessions.',
    icon: KeyRound,
    group: 'Access & Security',
    kind: 'settings',
  },
  {
    key: 'registration',
    category: 'registration',
    label: 'Registration',
    description: 'Sign-ups and email verification.',
    icon: UserPlus,
    group: 'Access & Security',
    kind: 'settings',
  },
  {
    key: 'security',
    category: 'security',
    label: 'Security',
    description: 'Lockouts, password expiry, and rate limiting.',
    icon: ShieldCheck,
    group: 'Access & Security',
    kind: 'settings',
  },
  {
    key: 'content',
    category: 'content',
    label: 'Content',
    description: 'Limits, supported languages/genres, and upload caps.',
    icon: FileText,
    group: 'Content & Community',
    kind: 'settings',
  },
  {
    key: 'moderation',
    category: 'moderation',
    label: 'Moderation',
    description: 'Auto-moderation, thresholds, and defaults.',
    icon: Gavel,
    group: 'Content & Community',
    kind: 'settings',
  },
  {
    key: 'notifications',
    category: 'notifications',
    label: 'Notifications',
    description: 'Email, in-app, digest, and broadcast defaults.',
    icon: Bell,
    group: 'Content & Community',
    kind: 'settings',
  },
  {
    key: 'email',
    category: 'email',
    label: 'Email',
    description: 'Sender identity for outbound mail.',
    icon: Mail,
    group: 'Content & Community',
    kind: 'settings',
  },
  {
    key: 'storage',
    category: 'storage',
    label: 'Storage',
    description: 'Provider, upload limits, and allowed file types.',
    icon: HardDrive,
    group: 'Content & Community',
    kind: 'settings',
  },
  {
    key: 'feature-flags',
    category: null,
    label: 'Feature flags',
    description: 'Dark-launch and roll out platform capabilities.',
    icon: Flag,
    group: 'Operations',
    kind: 'feature-flags',
  },
  {
    key: 'maintenance',
    category: 'maintenance',
    label: 'Maintenance mode',
    description: 'Take the platform offline for scheduled work.',
    icon: Wrench,
    group: 'Operations',
    kind: 'maintenance',
  },
];

export const DEFAULT_SECTION = 'general';

/** Explicit, friendly labels for known keys (fallback humanises the key). */
export const SETTING_LABELS: Record<string, string> = {
  'platform.name': 'Platform name',
  'platform.description': 'Platform description',
  'platform.logoUrl': 'Logo URL',
  'platform.faviconUrl': 'Favicon URL',
  'general.defaultLanguage': 'Default language',
  'general.timezone': 'Timezone',
  'general.dateFormat': 'Date format',
  'auth.google.enabled': 'Google login enabled',
  'auth.password.minLength': 'Minimum password length',
  'auth.password.requireStrong': 'Require strong passwords',
  'auth.session.timeoutMinutes': 'Session timeout (minutes)',
  'auth.registration.enabled': 'Registration enabled',
  'auth.emailVerification.required': 'Email verification required',
  'security.maxLoginAttempts': 'Allowed login attempts',
  'security.lockoutDurationMinutes': 'Account lockout duration (minutes)',
  'security.passwordExpiryDays': 'Password expiry (days, 0 = never)',
  'security.rateLimit.enabled': 'Rate limiting enabled',
  'content.maxTitleLength': 'Maximum title length',
  'content.maxContentLength': 'Maximum content length',
  'content.maxTags': 'Maximum tags',
  'content.maxCoverImageSize': 'Maximum cover image size (bytes)',
  'content.supportedLanguages': 'Supported languages',
  'content.supportedGenres': 'Supported genres',
  'moderation.autoModeration.enabled': 'Auto moderation',
  'moderation.reportThreshold': 'Report threshold',
  'moderation.appealWindowDays': 'Appeal window (days)',
  'moderation.defaultPriority': 'Default moderation priority',
  'moderation.defaultContentVisibility': 'Content visibility default',
  'notification.email.enabled': 'Email notifications',
  'notification.inApp.enabled': 'In-app notifications',
  'notification.digest.enabled': 'Digest enabled',
  'notification.digest.frequency': 'Digest frequency',
  'notification.systemBroadcast.enabled': 'System broadcast default',
  'email.fromName': 'From name',
  'email.fromAddress': 'From address',
  'email.replyTo': 'Reply-to address',
  'storage.provider': 'Storage provider',
  'storage.maxUploadSize': 'Maximum upload size (bytes)',
  'storage.allowedFileTypes': 'Allowed file types',
  'storage.retentionDays': 'Retention (days, 0 = keep)',
  'appearance.theme': 'Default theme',
  'appearance.primaryColor': 'Primary colour',
  'appearance.accentColor': 'Accent colour',
  'localization.defaultLocale': 'Default locale',
  'localization.availableLocales': 'Available locales',
  'localization.rtlEnabled': 'RTL enabled',
};

/** Turns an unmapped dot-cased key into a readable label. */
export function humanizeKey(key: string): string {
  const tail = key.split('.').slice(1).join(' ') || key;
  const words = tail.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The display label for a setting key. */
export function settingLabel(key: string): string {
  return SETTING_LABELS[key] ?? humanizeKey(key);
}

export const ENVIRONMENT_OPTIONS = [
  { label: 'All environments', value: 'all' },
  { label: 'Production', value: 'production' },
  { label: 'Staging', value: 'staging' },
  { label: 'Development', value: 'development' },
];

/** Roles selectable for maintenance allow-list (highest privilege first). */
export const MAINTENANCE_ROLE_OPTIONS = [
  { label: 'Super admin', value: 'super_admin' },
  { label: 'Admin', value: 'admin' },
  { label: 'Moderator', value: 'moderator' },
  { label: 'User', value: 'user' },
];
