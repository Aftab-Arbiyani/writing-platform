import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
// `use` is echarts' feature registration (aliased so eslint's react-hooks rule doesn't mistake it
// for React's `use` hook — it is called at module scope, which is correct for echarts).
import { init, use as registerFeatures, type ECharts } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

/**
 * The echarts registration seam — imported DYNAMICALLY by the `Chart` wrapper so the whole chart
 * engine (echarts + only the pieces we use: line/bar/pie + grid/tooltip/legend + canvas) is code-
 * split into its own chunk and loaded only on the analytics pages (docs: "lazy loaded chart
 * modules"). Tree-shaken registration keeps the chunk far smaller than the full `echarts` bundle.
 */
registerFeatures([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

export function createChart(dom: HTMLElement): ECharts {
  return init(dom, undefined, { renderer: 'canvas' });
}

export type { ECharts };
