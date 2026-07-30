import { useMemo, type ReactElement } from 'react';

import { useThemeStore } from '@/stores/theme.store';

import { buildSparklineOption, resolveChartTheme } from '../../lib/chart-options';
import { Chart } from './chart';

/**
 * A decorative sparkline for metric cards (docs: "mini trend charts"). Marked `decorative` — the
 * card's own value + trend badge carry the meaning for screen readers, so the sparkline adds no
 * ARIA/table noise. Renders nothing meaningful with <2 points.
 */
export function MiniTrendChart({
  values,
  height = 36,
}: {
  values: number[];
  height?: number;
}): ReactElement {
  const resolved = useThemeStore((s) => s.resolved);
  const option = useMemo(
    () => buildSparklineOption({ values, theme: resolveChartTheme(resolved) }),
    [values, resolved],
  );

  return (
    <Chart
      option={option}
      ariaLabel=""
      height={height}
      isEmpty={values.length < 2}
      emptyMessage=""
      decorative
    />
  );
}
