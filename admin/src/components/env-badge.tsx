import { QTag } from '@qalam/ui';
import type { ReactElement } from 'react';

import { env } from '@/config/env';

/**
 * Environment badge in the header (docs/10 §3.4) — a constant, unmissable reminder of which
 * environment a tab points at, so an operator never runs a destructive action against prod thinking
 * it's staging. Renders nothing in production (no badge = prod).
 */
export function EnvBadge(): ReactElement | null {
  if (env.VITE_APP_ENV === 'production') return null;
  const color = env.VITE_APP_ENV === 'staging' ? 'warning' : 'info';
  return (
    <QTag color={color} size="sm">
      {env.VITE_APP_ENV}
    </QTag>
  );
}
