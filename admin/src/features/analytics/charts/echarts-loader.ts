/**
 * Lazily loads Apache ECharts with ONLY the modules the dashboard uses
 * (tree-shaken), registered once. The dynamic `import()`s keep ECharts out of the
 * main bundle — it lands in its own chunk fetched when the first chart mounts
 * (docs 24 perf: lazy-loaded charts + dynamic imports).
 */

/** The minimal ECharts instance surface the dashboard drives. */
export interface ChartInstance {
  setOption: (option: unknown, notMerge?: boolean) => void;
  resize: () => void;
  dispose: () => void;
}

interface EChartsCore {
  init: (el: HTMLElement, theme?: unknown, opts?: { renderer?: 'canvas' | 'svg' }) => ChartInstance;
  use: (modules: unknown[]) => void;
}

let corePromise: Promise<EChartsCore> | null = null;

export function loadECharts(): Promise<EChartsCore> {
  if (corePromise === null) {
    corePromise = (async () => {
      const [core, charts, components, renderers] = await Promise.all([
        import('echarts/core'),
        import('echarts/charts'),
        import('echarts/components'),
        import('echarts/renderers'),
      ]);
      core.use([
        charts.LineChart,
        charts.BarChart,
        charts.PieChart,
        charts.HeatmapChart,
        components.GridComponent,
        components.TooltipComponent,
        components.LegendComponent,
        components.DatasetComponent,
        components.VisualMapComponent,
        components.CalendarComponent,
        renderers.CanvasRenderer,
      ]);
      return core as unknown as EChartsCore;
    })();
  }
  return corePromise;
}
