import { QButton } from '@qalam/ui';
import { Moon, Sun } from 'lucide-react';
import type { ReactElement } from 'react';

import { useTheme } from '@/hooks/use-theme';

/** Light/dark toggle. Persisted via the theme store; no-flash handled by the inline head script. */
export function ThemeToggle(): ReactElement {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <QButton
      variant="ghost"
      size="sm"
      icon={isDark ? Sun : Moon}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggle}
    />
  );
}
