/**
 * Public surface of the Policy Engine (AF6). Consumers inject
 * `PolicyEngineService` and call `assert(...)` / `evaluate(...)`; provider
 * modules import the port interfaces to self-register their data sources.
 */
export { PolicyModule } from './policy.module';
export { PolicyEngineService } from './policy-engine.service';
export { PolicyCacheService } from './policy-cache.service';
export { PolicyDeniedException } from './policy.exceptions';
export type {
  PolicyEvaluationRequest,
  PolicySubject,
  PolicyResource,
  PolicyEvaluationContext,
  TrustContext,
  TrustStatusPort,
  StoryMembershipPort,
  PolicyEntitlementPort,
  PolicyFeatureFlagPort,
  PolicyRule,
} from './policy.types';
