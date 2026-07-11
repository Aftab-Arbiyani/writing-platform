import {
  Activity,
  FileText,
  Gauge,
  LayoutDashboard,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

import type { AnalyticsDataset, TrendRange } from './types/analytics.types';

export interface AnalyticsSectionDef {
  key: AnalyticsDataset;
  label: string;
  icon: LucideIcon;
}

/** The dashboard sections (also the export datasets). Order = tab order. */
export const ANALYTICS_SECTIONS: readonly AnalyticsSectionDef[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'content', label: 'Content', icon: FileText },
  { key: 'engagement', label: 'Engagement', icon: Activity },
  { key: 'moderation', label: 'Moderation', icon: ShieldCheck },
  { key: 'system', label: 'System', icon: Gauge },
];

export const DEFAULT_SECTION: AnalyticsDataset = 'overview';

/** Date-range presets offered by the selector (backend `AdminTrendRange`). */
export const RANGE_OPTIONS: { label: string; value: TrendRange }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last year', value: 'year' },
  { label: 'Custom', value: 'custom' },
];

export const LANGUAGE_OPTIONS = [
  { label: 'All languages', value: '' },
  { label: 'Hindi', value: 'hi' },
  { label: 'Urdu', value: 'ur' },
  { label: 'English', value: 'en' },
];

export const GENRE_OPTIONS = [
  { label: 'All genres', value: '' },
  { label: 'Poetry', value: 'poetry' },
  { label: 'Story', value: 'story' },
  { label: 'Essay', value: 'essay' },
  { label: 'Article', value: 'article' },
];

/** Categorical chart palette — accessible in both light and dark themes. */
export const CHART_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

/** Formats a byte count as KB/MB/GB. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/** Formats a duration in seconds as `2h 30m` / `45m` / `12s`. */
export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** Formats a 0–1 rate as a percentage string. */
export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
