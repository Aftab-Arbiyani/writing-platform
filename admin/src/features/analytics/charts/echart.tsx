import { QSpinner } from '@qalam/ui';
import { memo, useEffect, useRef, useState, type ReactElement } from 'react';

import { loadECharts, type ChartInstance } from './echarts-loader';

/** A plain ECharts option object (wrappers build these). */
export type EChartOption = Record<string, unknown>;

interface EChartProps {
  option: EChartOption;
  height?: number;
  /** Required — the chart is `role="img"` for screen readers. */
  ariaLabel: string;
}

/**
 * The base ECharts renderer (A8): lazily boots ECharts, applies the option, keeps
 * the chart sized to its container (ResizeObserver), and disposes on unmount.
 * Dumb — the wrappers own the themed option, so a theme flip just re-sets it.
 * Memoized so a parent re-render with the same option doesn't churn.
 */
function EChartBase({ option, height = 280, ariaLabel }: EChartProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartInstance | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    void loadECharts().then((echarts) => {
      if (disposed || containerRef.current === null) return;
      chartRef.current = echarts.init(containerRef.current, undefined, { renderer: 'canvas' });
      setReady(true);
    });
    return () => {
      disposed = true;
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready && chartRef.current !== null) {
      chartRef.current.setOption(option, true);
    }
  }, [option, ready]);

  useEffect(() => {
    const el = containerRef.current;
    if (el === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => chartRef.current?.resize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative" style={{ height }}>
      <div ref={containerRef} role="img" aria-label={ariaLabel} className="h-full w-full" />
      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <QSpinner />
        </div>
      ) : null}
    </div>
  );
}

export const EChart = memo(EChartBase);
