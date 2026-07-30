/**
 * Public surface of the analytics module (docs 16 §5.2). Feature modules never
 * import this — they emit domain events; analytics subscribes.
 */
export { AnalyticsModule } from './analytics.module';
export { AnalyticsService } from './analytics.service';
