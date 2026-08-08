import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';
import type { AiFeature, AiProvider } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/**
 * Domain exceptions for the AI platform (AF1). Every code comes from the
 * append-only `ERROR_CODES` catalogue; the `AllExceptionsFilter` maps these onto
 * the response envelope with a meaningful HTTP status (docs 05 §3–§4).
 */

/** AI is globally disabled (`feature.ai.enabled` off). */
export class AiDisabledException extends AppException {
  constructor() {
    super(ERROR_CODES.AI_DISABLED, 'AI features are currently disabled.', HttpStatus.FORBIDDEN);
  }
}

/** The specific AI feature's flag is off. */
export class AiFeatureDisabledException extends AppException {
  constructor(feature: AiFeature) {
    super(
      ERROR_CODES.AI_FEATURE_DISABLED,
      `The AI feature "${feature}" is not enabled.`,
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * B5 (docs/45 §4.10) — the caller turned AI off for their own account.
 *
 * Separate from {@link AiDisabledException} and {@link AiFeatureDisabledException}
 * because the remedy is the caller's own, not an administrator's: this message
 * points at their settings, and it must never be conflated with the quota
 * ("wait for reset") or entitlement ("see plans") families either.
 *
 * It governs the USER, not the story — a co-author who has AI on may still use it
 * on a story this caller co-authors.
 */
export class AiDisabledByUserException extends AppException {
  constructor() {
    super(
      ERROR_CODES.AI_DISABLED_BY_USER,
      'You have turned AI off for your account. You can turn it back on in settings.',
      HttpStatus.FORBIDDEN,
    );
  }
}

/** The selected provider has no credentials / is not configured. */
export class AiProviderNotConfiguredException extends AppException {
  constructor(provider: AiProvider) {
    super(
      ERROR_CODES.AI_PROVIDER_NOT_CONFIGURED,
      `AI provider "${provider}" is not configured.`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/** The upstream provider returned an error (provider's fault, not ours). */
export class AiProviderErrorException extends AppException {
  constructor(provider: AiProvider, detail: string) {
    super(
      ERROR_CODES.AI_PROVIDER_ERROR,
      `AI provider "${provider}" returned an error: ${detail}`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}

/** The provider is unreachable/overloaded — safe to retry with backoff. */
export class AiProviderUnavailableException extends AppException {
  constructor(provider: AiProvider) {
    super(
      ERROR_CODES.AI_PROVIDER_UNAVAILABLE,
      `AI provider "${provider}" is temporarily unavailable.`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/** Referenced a model id that is not in the registry. */
export class AiModelNotFoundException extends AppException {
  constructor(model: string) {
    super(ERROR_CODES.AI_MODEL_NOT_FOUND, `Unknown AI model: "${model}".`, HttpStatus.NOT_FOUND);
  }
}

/** The model exists but is deprecated/disabled and cannot be used. */
export class AiModelUnavailableException extends AppException {
  constructor(model: string) {
    super(
      ERROR_CODES.AI_MODEL_UNAVAILABLE,
      `AI model "${model}" is not available.`,
      HttpStatus.CONFLICT,
    );
  }
}

/** The request needs a capability the chosen model lacks (vision/json). */
export class AiCapabilityUnsupportedException extends AppException {
  constructor(model: string, capability: string) {
    super(
      ERROR_CODES.AI_CAPABILITY_UNSUPPORTED,
      `AI model "${model}" does not support "${capability}".`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/** Unknown prompt template key or version. */
export class AiPromptNotFoundException extends AppException {
  constructor(key: string, version?: number) {
    super(
      ERROR_CODES.AI_PROMPT_NOT_FOUND,
      `Unknown prompt template: "${key}"${version !== undefined ? ` v${version}` : ''}.`,
      HttpStatus.NOT_FOUND,
    );
  }
}

/** A prompt template failed validation (bad variables/syntax). */
export class AiPromptInvalidException extends AppException {
  constructor(reason: string) {
    super(
      ERROR_CODES.AI_PROMPT_INVALID,
      `Invalid prompt template: ${reason}.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/** Rendering failed — a required template variable was missing/invalid. */
export class AiPromptRenderFailedException extends AppException {
  constructor(reason: string) {
    super(
      ERROR_CODES.AI_PROMPT_RENDER_FAILED,
      `Prompt render failed: ${reason}.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/** Assembled context exceeds the model's context window. */
export class AiContextTooLargeException extends AppException {
  constructor(estimatedTokens: number, contextWindow: number) {
    super(
      ERROR_CODES.AI_CONTEXT_TOO_LARGE,
      `Assembled context (~${estimatedTokens} tokens) exceeds the model window (${contextWindow}).`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/** Input exceeds the allowed length. */
export class AiInputTooLongException extends AppException {
  constructor() {
    super(ERROR_CODES.AI_INPUT_TOO_LONG, 'The input is too long.', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

/** Input was blocked by a safety hook. */
export class AiInputBlockedException extends AppException {
  constructor(reason: string) {
    super(
      ERROR_CODES.AI_INPUT_BLOCKED,
      `Input rejected: ${reason}.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/** Generated output was blocked by an output-validation hook. */
export class AiOutputBlockedException extends AppException {
  constructor(reason: string) {
    super(
      ERROR_CODES.AI_OUTPUT_BLOCKED,
      `Output rejected: ${reason}.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/** No such conversation, or it belongs to another user (privacy-preserving). */
export class AiConversationNotFoundException extends AppException {
  constructor() {
    super(ERROR_CODES.AI_CONVERSATION_NOT_FOUND, 'No such conversation.', HttpStatus.NOT_FOUND);
  }
}

/** Acting on a conversation that isn't yours. */
export class AiConversationForbiddenException extends AppException {
  constructor() {
    super(
      ERROR_CODES.AI_CONVERSATION_FORBIDDEN,
      'You do not have access to this conversation.',
      HttpStatus.FORBIDDEN,
    );
  }
}

/** A per-user daily/monthly token or request cap was hit. */
export class AiUsageLimitExceededException extends AppException {
  constructor(window: string) {
    super(
      ERROR_CODES.AI_USAGE_LIMIT_EXCEEDED,
      `Your ${window} AI usage limit has been reached.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/** Provider/stream exceeded its time budget. */
export class AiTimeoutException extends AppException {
  constructor() {
    super(ERROR_CODES.AI_TIMEOUT, 'The AI request timed out.', HttpStatus.GATEWAY_TIMEOUT);
  }
}

/** An AI configuration value failed validation. */
export class AiConfigInvalidException extends AppException {
  constructor(reason: string) {
    super(
      ERROR_CODES.AI_CONFIG_INVALID,
      `Invalid AI configuration: ${reason}.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
