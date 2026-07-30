export { SettingsModule } from './settings.module';
export { SettingsService } from './settings.service';
export {
  evaluateFeatureFlag,
  rolloutBucket,
  type EvaluableFlag,
  type FlagEvaluationContext,
} from './feature-flag-evaluator';
export { Setting } from './entities/setting.entity';
export { FeatureFlag } from './entities/feature-flag.entity';
export type { SettingDefinition, FeatureFlagDefinition } from './settings.catalog';
export { SETTING_CATEGORIES, SETTING_DATA_TYPES } from './settings.constants';
