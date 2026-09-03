import type { AiFeature, AiProvider } from '@qalam/shared';

/**
 * The AI usage-metering seam (AF5). Lives in `common` (dependency-free) so the AI
 * platform and the Monetization platform both reference it WITHOUT importing each
 * other's module — exactly like {@link JobEnqueuer}/`JOB_ENQUEUER`.
 *
 * The AI orchestrator (`AiCompletionService`) injects this OPTIONALLY: it calls
 * `checkQuota` before a generation and `recordConsumption` after. When the Monetization
 * module is loaded it provides the token globally with a credit-aware implementation, so
 * every AI request is metered against the user's plan quota + credit balance and every
 * completion debits the credit ledger — the mandate "every AI request must pass through
 * the Usage Service" without duplicating any token counting (the AI platform still owns
 * `ai_usage_logs`). When absent (AI-only deployment / unit tests), the orchestrator falls
 * back to its own token-cap check with zero behavior change.
 */
export interface AiUsageQuotaCheck {
  userId: string;
  feature: AiFeature;
  provider: AiProvider;
  model: string;
  /** Pre-call token estimate (the reservation the meter may check against a budget). */
  estimatedTokens: number;
  /**
   * How many of this feature's allowance the caller is about to spend. Defaults to 1.
   *
   * A caller that will make several calls as ONE user action — "Map this story" runs five
   * analyses — passes the total so the whole thing is refused up front rather than dying
   * three analyses in, having spent them and left a half-built graph behind.
   */
  reserve?: number;
}

/**
 * The metering port the AI orchestrator delegates the quota decision to.
 *
 * **Ask-only since D5.** It used to have a `recordConsumption` half that ran after every
 * generation to debit a credit wallet; with the credit economy gone there is nothing to debit,
 * and the allowance is counted from `ai_usage_logs`, which the AI platform writes itself. A
 * second write-path here would be a copy to keep in step, and metering that only READS cannot
 * corrupt anything after a generation the user already paid for in time.
 */
export interface AiUsageMeter {
  /**
   * Throw a domain exception (QUOTA_EXCEEDED / ENTITLEMENT_DENIED) if the user may not make
   * this AI request. Called BEFORE the provider call.
   */
  checkQuota(input: AiUsageQuotaCheck): Promise<void>;
}

/** DI token for the {@link AiUsageMeter} (provided globally by the Monetization module). */
export const AI_USAGE_METER = Symbol('AI_USAGE_METER');
