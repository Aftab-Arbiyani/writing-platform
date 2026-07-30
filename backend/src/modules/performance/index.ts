/**
 * Public reuse surface of the Performance Platform (P7.3). Other modules inject
 * the facade / verification service through DI (both are `@Global`-exported); the
 * scripts + tests import the constants, types, and pure helpers from here.
 */
export { PerformanceModule } from './performance.module';
export { PerformancePlatformService } from './performance-platform.service';
export type { PerformancePlatformStatus } from './performance-platform.service';
export { PerformanceVerificationService } from './verification/performance-verification.service';
export type { VerificationOutcome } from './verification/performance-verification.service';
export { PerformanceBudgetService } from './budgets/performance-budget.service';
export { BenchmarkService } from './benchmark/benchmark.service';
export { buildBenchmarkScenarios } from './benchmark/benchmark-catalog';
export type { BenchmarkScenario } from './benchmark/benchmark-catalog';
export { evaluateBudget } from './budgets/budget.rules';
export * from './performance.constants';
export * from './performance.types';
