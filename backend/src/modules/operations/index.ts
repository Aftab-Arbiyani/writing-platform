/**
 * Operations Platform (P7.4) public surface. Other modules import the facade +
 * health indicator + the rollout service from here; the seams live in `common/`.
 */
export { OperationsModule } from './operations.module';
export { OperationsPlatformService } from './operations-platform.service';
export type { OperationsPlatformStatus, OperationsReport } from './operations-platform.service';
export { OperationsHealthIndicator } from './operations-health.indicator';
export { FeatureRolloutService } from './rollout/feature-rollout.service';
