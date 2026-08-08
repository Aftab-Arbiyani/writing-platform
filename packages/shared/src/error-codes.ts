/**
 * Error-code catalogue — the `error.code` half of the API envelope (ADR §5).
 *
 * Convention: `DOMAIN_REASON`, stable forever once shipped (clients and the
 * Flutter app switch on these strings). HTTP status codes remain meaningful;
 * these codes disambiguate WITHIN a status (e.g. two different 409s).
 * Key === value so the object doubles as a lookup table and a namespace.
 */
export const ERROR_CODES = {
  // ── Auth ────────────────────────────────────────────────────────────────
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  /** Rotating-refresh reuse detected — the whole token family is revoked (docs 13 §3.2). */
  AUTH_REFRESH_REUSED: 'AUTH_REFRESH_REUSED',
  /** Session invalidated by "log out everywhere" (session-version bump, docs 13 §3.6). */
  AUTH_SESSION_REVOKED: 'AUTH_SESSION_REVOKED',
  AUTH_EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  /** Action requires a verified email (VerifiedUserGuard, docs 05 §3). */
  AUTH_EMAIL_UNVERIFIED: 'AUTH_EMAIL_UNVERIFIED',
  /** Verification token missing / expired / already used. */
  AUTH_VERIFICATION_INVALID: 'AUTH_VERIFICATION_INVALID',
  /** Resend/verify attempted on an already-verified account. */
  AUTH_EMAIL_ALREADY_VERIFIED: 'AUTH_EMAIL_ALREADY_VERIFIED',
  /** Password-reset token missing / expired / already used. */
  AUTH_RESET_INVALID: 'AUTH_RESET_INVALID',
  /** Password fails policy (length or breached-list, docs 13 §3.1). */
  AUTH_PASSWORD_WEAK: 'AUTH_PASSWORD_WEAK',
  /** Change-password: supplied current password did not match. */
  AUTH_CURRENT_PASSWORD_INVALID: 'AUTH_CURRENT_PASSWORD_INVALID',
  AUTH_OAUTH_FAILED: 'AUTH_OAUTH_FAILED',
  /** OAuth `state` mismatch / expired (CSRF nonce, docs 13 §3.4). */
  AUTH_OAUTH_STATE_INVALID: 'AUTH_OAUTH_STATE_INVALID',
  AUTH_ACCOUNT_SUSPENDED: 'AUTH_ACCOUNT_SUSPENDED',

  // ── Users / profiles ────────────────────────────────────────────────────
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_USERNAME_TAKEN: 'USER_USERNAME_TAKEN',
  /** Usernames are permanent after creation (ADR §4 identity rules). */
  USER_USERNAME_IMMUTABLE: 'USER_USERNAME_IMMUTABLE',
  USER_PRIVATE_ACCOUNT: 'USER_PRIVATE_ACCOUNT',
  USER_CANNOT_FOLLOW_SELF: 'USER_CANNOT_FOLLOW_SELF',
  /** Editing a profile that isn't yours. */
  PROFILE_FORBIDDEN: 'PROFILE_FORBIDDEN',
  /** Selected language is unknown or inactive (taxonomy). */
  LANGUAGE_INVALID: 'LANGUAGE_INVALID',
  /** One or more selected genres are unknown or inactive (taxonomy). */
  GENRE_INVALID: 'GENRE_INVALID',

  // ── Follow graph ──────────────────────────────────────────────────────────
  FOLLOW_ALREADY_EXISTS: 'FOLLOW_ALREADY_EXISTS',
  FOLLOW_REQUEST_PENDING: 'FOLLOW_REQUEST_PENDING',
  FOLLOW_NOT_FOUND: 'FOLLOW_NOT_FOUND',
  FOLLOW_REQUEST_NOT_FOUND: 'FOLLOW_REQUEST_NOT_FOUND',

  // ── Pieces (writing lifecycle) ────────────────────────────────────────────
  PIECE_NOT_FOUND: 'PIECE_NOT_FOUND',
  /** Editing/deleting/publishing a piece that isn't yours. */
  PIECE_FORBIDDEN: 'PIECE_FORBIDDEN',
  PIECE_SCHEDULE_IN_PAST: 'PIECE_SCHEDULE_IN_PAST',
  PIECE_ALREADY_PUBLISHED: 'PIECE_ALREADY_PUBLISHED',
  PIECE_NOT_PUBLISHED: 'PIECE_NOT_PUBLISHED',
  /** Illegal lifecycle transition (e.g. archive a draft, publish an archived piece). */
  PIECE_INVALID_TRANSITION: 'PIECE_INVALID_TRANSITION',
  /** Publish/schedule attempted with required fields missing (title/genre/content). */
  PIECE_INCOMPLETE: 'PIECE_INCOMPLETE',
  /** Stored TipTap document failed the server-side schema whitelist (docs 13 §5.2). */
  PIECE_CONTENT_INVALID: 'PIECE_CONTENT_INVALID',
  PIECE_TAG_LIMIT_EXCEEDED: 'PIECE_TAG_LIMIT_EXCEEDED',

  // ── Engagement ──────────────────────────────────────────────────────────
  /** Cap enforced by MAX_CLAPS_PER_USER_PER_PIECE in limits.ts (E7). */
  CLAP_LIMIT_REACHED: 'CLAP_LIMIT_REACHED',
  // Engagement on a draft/scheduled/archived piece reuses PIECE_NOT_PUBLISHED (409).

  // Comments (E7)
  COMMENT_NOT_FOUND: 'COMMENT_NOT_FOUND',
  /** Editing/deleting a comment that isn't yours (delete also allows admins). */
  COMMENT_FORBIDDEN: 'COMMENT_FORBIDDEN',
  /** Reply nesting would exceed MAX_COMMENT_DEPTH. */
  COMMENT_DEPTH_EXCEEDED: 'COMMENT_DEPTH_EXCEEDED',
  /** Replying to a comment that is already soft-deleted. */
  COMMENT_DELETED: 'COMMENT_DELETED',

  // Collections (E7) — private/owner-only: a missing OR foreign collection is
  // COLLECTION_NOT_FOUND (404), never revealing another user's collection exists.
  COLLECTION_NOT_FOUND: 'COLLECTION_NOT_FOUND',
  /** Owner already has a collection with this title/slug. */
  COLLECTION_NAME_TAKEN: 'COLLECTION_NAME_TAKEN',
  /** The piece is already in the collection. */
  COLLECTION_PIECE_EXISTS: 'COLLECTION_PIECE_EXISTS',
  /** The piece is not in the collection (remove target missing). */
  COLLECTION_PIECE_NOT_FOUND: 'COLLECTION_PIECE_NOT_FOUND',
  /** The default "Favorites" collection cannot be renamed or deleted. */
  COLLECTION_DEFAULT_IMMUTABLE: 'COLLECTION_DEFAULT_IMMUTABLE',

  // Responses (E7) — a response is a new piece linked to a parent piece.
  /** A piece cannot respond to itself. */
  RESPONSE_TO_SELF: 'RESPONSE_TO_SELF',
  /** This piece already responds to a parent (one parent per response). */
  RESPONSE_ALREADY_EXISTS: 'RESPONSE_ALREADY_EXISTS',

  // ── Feeds & Discovery (E6) ────────────────────────────────────────────────
  /** A cursor was supplied but failed to decode/verify — client restarts from page 1. */
  FEED_INVALID_CURSOR: 'FEED_INVALID_CURSOR',

  // ── Search & Discovery (E8) ───────────────────────────────────────────────
  /** `q` shorter than SEARCH_QUERY_MIN (2 chars) after normalization (docs 05 §3.2). */
  SEARCH_QUERY_TOO_SHORT: 'SEARCH_QUERY_TOO_SHORT',
  /** FTS backend degraded/unreachable — client retries with backoff (docs 05 §3.2, 503). */
  SEARCH_UNAVAILABLE: 'SEARCH_UNAVAILABLE',
  /** A recent-search row to delete does not exist (or is not the caller's). */
  SEARCH_RECENT_NOT_FOUND: 'SEARCH_RECENT_NOT_FOUND',

  // ── Notifications (E9) ────────────────────────────────────────────────────
  /** No such notification, or it belongs to another user (privacy-preserving 404). */
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  /** Admin system-notification target does not exist. */
  SYSTEM_NOTIFICATION_NOT_FOUND: 'SYSTEM_NOTIFICATION_NOT_FOUND',

  // ── Moderation ──────────────────────────────────────────────────────────
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
  REPORT_ALREADY_RESOLVED: 'REPORT_ALREADY_RESOLVED',
  /** The reported entity (piece/comment/user/response) does not exist. */
  REPORT_TARGET_NOT_FOUND: 'REPORT_TARGET_NOT_FOUND',
  /** A user cannot report their own content/account. */
  REPORT_SELF: 'REPORT_SELF',
  /** The reporter already has an open report for this entity. */
  REPORT_DUPLICATE: 'REPORT_DUPLICATE',
  /** Resolution requires a decision incompatible with the report's target/state. */
  REPORT_INVALID_RESOLUTION: 'REPORT_INVALID_RESOLUTION',
  /** An appeal was requested but the caller is not the moderated subject, or the report isn't resolved. */
  APPEAL_NOT_ALLOWED: 'APPEAL_NOT_ALLOWED',
  APPEAL_NOT_FOUND: 'APPEAL_NOT_FOUND',
  /** An appeal already exists for this report. */
  APPEAL_ALREADY_EXISTS: 'APPEAL_ALREADY_EXISTS',
  /** Approve/reject attempted on an appeal that is no longer pending. */
  APPEAL_ALREADY_REVIEWED: 'APPEAL_ALREADY_REVIEWED',

  // ── Media ───────────────────────────────────────────────────────────────
  MEDIA_TYPE_UNSUPPORTED: 'MEDIA_TYPE_UNSUPPORTED',
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE',

  // ── System settings (E12.8 — configuration, feature flags, maintenance) ───
  /** Referenced a setting key that is not in the configuration catalogue. */
  SETTING_NOT_FOUND: 'SETTING_NOT_FOUND',
  /** Attempted to change a setting flagged `editable: false` (infra-managed). */
  SETTING_NOT_EDITABLE: 'SETTING_NOT_EDITABLE',
  /** A setting value failed its data-type / validation-rule check. */
  SETTING_INVALID_VALUE: 'SETTING_INVALID_VALUE',
  /** Referenced a feature-flag id/key that does not exist. */
  FEATURE_FLAG_NOT_FOUND: 'FEATURE_FLAG_NOT_FOUND',
  /** Creating a feature flag whose key is already registered. */
  FEATURE_FLAG_ALREADY_EXISTS: 'FEATURE_FLAG_ALREADY_EXISTS',

  // ── Infrastructure / admin (Epic 11 — queue & cache management) ───────────
  /** Admin referenced a queue name that is not registered. */
  QUEUE_NOT_FOUND: 'QUEUE_NOT_FOUND',
  /** Admin referenced a job id that does not exist in the given queue. */
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  /** Retry requested for a job that is not in a failed state. */
  JOB_NOT_RETRYABLE: 'JOB_NOT_RETRYABLE',

  // ── AI platform (AF1 — Phase 2 AI foundation) ─────────────────────────────
  /** AI is globally disabled (`feature.ai.enabled` off). */
  AI_DISABLED: 'AI_DISABLED',
  /** The specific AI feature's flag is off. */
  AI_FEATURE_DISABLED: 'AI_FEATURE_DISABLED',
  /**
   * B5 (docs/45 §4.10) — the CALLER turned AI off for their own account (403).
   *
   * Deliberately its own code, and the remedy is why. `AI_DISABLED` is an
   * administrator's platform-wide switch (the user can do nothing but wait);
   * `AI_FEATURE_DISABLED` is one feature's flag (same). `QUOTA_EXCEEDED` /
   * `AI_USAGE_LIMIT_EXCEEDED` reset on their own, and `ENTITLEMENT_DENIED` /
   * `INSUFFICIENT_CREDITS` end in a plan. This one ends in a switch the caller
   * already owns: **turn it back on in settings** — never "see plans", never
   * "wait for reset". Collapsing distinct remedies into one code was the W4
   * defect (docs/48 §3.6), which is why B4/B6/B7 each minted their own too.
   */
  AI_DISABLED_BY_USER: 'AI_DISABLED_BY_USER',
  /** The selected provider has no credentials / is not configured (503). */
  AI_PROVIDER_NOT_CONFIGURED: 'AI_PROVIDER_NOT_CONFIGURED',
  /** The upstream provider returned an error (502 — provider's fault, not ours). */
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  /** The provider is unreachable/overloaded — safe to retry with backoff (503). */
  AI_PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
  /** Referenced a model id that is not in the registry (404). */
  AI_MODEL_NOT_FOUND: 'AI_MODEL_NOT_FOUND',
  /** The model exists but is deprecated/disabled and cannot be used (409). */
  AI_MODEL_UNAVAILABLE: 'AI_MODEL_UNAVAILABLE',
  /** The request needs a capability (vision/json) the chosen model lacks (422). */
  AI_CAPABILITY_UNSUPPORTED: 'AI_CAPABILITY_UNSUPPORTED',
  /** Unknown prompt template key or version (404). */
  AI_PROMPT_NOT_FOUND: 'AI_PROMPT_NOT_FOUND',
  /** A prompt template failed validation (bad variables/syntax) (422). */
  AI_PROMPT_INVALID: 'AI_PROMPT_INVALID',
  /** Rendering failed — a required template variable was missing/invalid (422). */
  AI_PROMPT_RENDER_FAILED: 'AI_PROMPT_RENDER_FAILED',
  /** Assembled context exceeds the model's context window (422). */
  AI_CONTEXT_TOO_LARGE: 'AI_CONTEXT_TOO_LARGE',
  /** Input exceeds the allowed length (422). */
  AI_INPUT_TOO_LONG: 'AI_INPUT_TOO_LONG',
  /** Input was blocked by a safety hook (validation/sanitization) (422). */
  AI_INPUT_BLOCKED: 'AI_INPUT_BLOCKED',
  /** Generated output was blocked by an output-validation hook (422). */
  AI_OUTPUT_BLOCKED: 'AI_OUTPUT_BLOCKED',
  /** No such conversation, or it belongs to another user (privacy-preserving 404). */
  AI_CONVERSATION_NOT_FOUND: 'AI_CONVERSATION_NOT_FOUND',
  /** Acting on a conversation that isn't yours (403). */
  AI_CONVERSATION_FORBIDDEN: 'AI_CONVERSATION_FORBIDDEN',
  /** A per-user daily/monthly token or request cap was hit (429). */
  AI_USAGE_LIMIT_EXCEEDED: 'AI_USAGE_LIMIT_EXCEEDED',
  /** Provider/stream exceeded its time budget (504). */
  AI_TIMEOUT: 'AI_TIMEOUT',
  /** The request was cancelled by the caller (used in the stream `error` event). */
  AI_REQUEST_CANCELLED: 'AI_REQUEST_CANCELLED',
  /** A streaming response failed mid-flight (generic stream `error` code). */
  AI_STREAM_ERROR: 'AI_STREAM_ERROR',
  /** An AI configuration value failed validation (422). */
  AI_CONFIG_INVALID: 'AI_CONFIG_INVALID',

  // ── Story intelligence (AF3 — structured story knowledge graph) ───────────
  /** No story graph for this owner + story id (missing or foreign). */
  STORY_NOT_FOUND: 'STORY_NOT_FOUND',
  /** No such analysis run for this story (missing or foreign). */
  STORY_ANALYSIS_NOT_FOUND: 'STORY_ANALYSIS_NOT_FOUND',
  /** The model produced no usable structured analysis (422) — raw output retained. */
  STORY_ANALYSIS_FAILED: 'STORY_ANALYSIS_FAILED',
  /** The submitted story text was empty (422). */
  STORY_CONTENT_EMPTY: 'STORY_CONTENT_EMPTY',

  // ── AI discovery / retrieval (AF4 — Retrieval Platform) ───────────────────
  /** The query was empty/too short after normalization (422). */
  RETRIEVAL_QUERY_INVALID: 'RETRIEVAL_QUERY_INVALID',
  /** The retrieval phase failed across all planned sources (503). */
  RETRIEVAL_FAILED: 'RETRIEVAL_FAILED',
  /** Retrieval exceeded its wall-clock budget before any source returned (504). */
  RETRIEVAL_TIMEOUT: 'RETRIEVAL_TIMEOUT',
  /** A recommendation surface could not be produced (503). */
  RECOMMENDATION_UNAVAILABLE: 'RECOMMENDATION_UNAVAILABLE',
  /** No such saved search, or it belongs to another user (privacy-preserving 404). */
  SAVED_SEARCH_NOT_FOUND: 'SAVED_SEARCH_NOT_FOUND',
  /** The per-user saved-search cap was reached (409). */
  SAVED_SEARCH_LIMIT_EXCEEDED: 'SAVED_SEARCH_LIMIT_EXCEEDED',

  // ── Monetization (AF5 — subscriptions, entitlements, billing, credits) ────
  /** The monetization platform is globally disabled (`feature.payments.enabled` off). */
  MONETIZATION_DISABLED: 'MONETIZATION_DISABLED',
  /** No subscription for this user (or it belongs to another — privacy-preserving 404). */
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  /** The user already has an active subscription (create attempted twice) (409). */
  SUBSCRIPTION_ALREADY_ACTIVE: 'SUBSCRIPTION_ALREADY_ACTIVE',
  /** Illegal lifecycle transition (e.g. reactivate an active sub, resume a non-paused one) (409). */
  SUBSCRIPTION_INVALID_TRANSITION: 'SUBSCRIPTION_INVALID_TRANSITION',
  /** Referenced a plan tier that is not in the pricing config (404). */
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  /** The requested plan change is a no-op (same plan + interval) (409). */
  PLAN_CHANGE_NOOP: 'PLAN_CHANGE_NOOP',
  /** A trial was requested but the user is not trial-eligible (already used one) (409). */
  TRIAL_NOT_ELIGIBLE: 'TRIAL_NOT_ELIGIBLE',
  /** The caller lacks entitlement to a premium feature (402 — payment required). */
  ENTITLEMENT_DENIED: 'ENTITLEMENT_DENIED',
  /** No such entitlement override, or it belongs to another user (404). */
  ENTITLEMENT_OVERRIDE_NOT_FOUND: 'ENTITLEMENT_OVERRIDE_NOT_FOUND',
  /** A per-user AI usage/credit quota (daily/monthly/per-feature) was hit (429). */
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  /**
   * The author already holds as many pieces as their plan allows, so creating another is
   * refused (402 — B4, `PlanLimits.maxPieces`). `details` carries `{ used, limit }`.
   *
   * **Deliberately NOT `QUOTA_EXCEEDED`,** which is the code above and means a *flow* cap
   * (tokens/credits spent in a window) whose remedy is to WAIT for the window to reset. This
   * is a *stock* cap on live pieces: waiting never helps, and the two remedies that do are
   * "delete a piece" and "see plans". Telling a blocked author to wait for a reset that will
   * never come is the W4 defect recorded in docs/48 §3.6, so the codes stay separate.
   */
  PIECE_LIMIT_REACHED: 'PIECE_LIMIT_REACHED',
  /**
   * The requested story version is older than the plan shows, so reading or reverting to it is
   * refused (402 — B7, `PlanLimits.maxSnapshotHistory`). `details` carries `{ version, limit }`.
   *
   * **Nothing was deleted.** The version is stored and hidden by a read-time clamp resolved from
   * the STORY OWNER's plan; upgrading makes it readable again, retroactively. That is why this is
   * neither a 404 (the row exists) nor `QUOTA_EXCEEDED` (nothing resets and nothing is spent), and
   * why the message is an upgrade sentence rather than an error: reverting is the whole reason a
   * version history exists, so telling someone to wait — the W4 defect, docs/48 §3.6 — would be
   * both wrong and useless. It is also not `PIECE_LIMIT_REACHED` / `COLLABORATOR_LIMIT_REACHED`:
   * those refuse to CREATE something new and their remedies are "delete one" / "remove one", while
   * nothing an author deletes here makes an older version visible.
   */
  SNAPSHOT_HISTORY_LIMITED: 'SNAPSHOT_HISTORY_LIMITED',
  /** The user has insufficient AI credits for the request (402). */
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  /** A payment attempt failed (card declined / provider rejected) (402). */
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  /** No such payment / invoice for this user (404). */
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  /** The selected payment provider has no credentials / is not configured (503). */
  PAYMENT_PROVIDER_NOT_CONFIGURED: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
  /** The upstream payment provider returned an error (502 — provider's fault). */
  PAYMENT_PROVIDER_ERROR: 'PAYMENT_PROVIDER_ERROR',
  /** A webhook failed signature verification / replay check — rejected (400). */
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  /** Store receipt / purchase-token validation failed (400). */
  RECEIPT_VALIDATION_FAILED: 'RECEIPT_VALIDATION_FAILED',
  /** No such coupon, or it is not currently redeemable (404). */
  COUPON_NOT_FOUND: 'COUPON_NOT_FOUND',
  /** The coupon exists but is expired / used up / not applicable (409). */
  COUPON_NOT_REDEEMABLE: 'COUPON_NOT_REDEEMABLE',
  /** The caller already redeemed this coupon the maximum number of times (409). */
  COUPON_ALREADY_REDEEMED: 'COUPON_ALREADY_REDEEMED',
  /** Creating a coupon whose code already exists (409). */
  COUPON_CODE_TAKEN: 'COUPON_CODE_TAKEN',
  /** A restore/purchase-verification found nothing to restore (404). */
  PURCHASE_NOT_FOUND: 'PURCHASE_NOT_FOUND',

  // ── Policy Engine (AF6 — the single authorization source of truth) ────────
  /** The Policy Engine denied the action (403). `details` carries the matched rule. */
  POLICY_DENIED: 'POLICY_DENIED',
  /** The action is allowed only after review (409 — `requires_review` effect). */
  POLICY_REQUIRES_REVIEW: 'POLICY_REQUIRES_REVIEW',

  // ── Collaboration (AF6 — membership, invitations, comments, suggestions) ──
  /** No membership row for this user on this story. */
  STORY_MEMBERSHIP_NOT_FOUND: 'STORY_MEMBERSHIP_NOT_FOUND',
  /** The user is already a collaborator on this story. */
  STORY_MEMBER_EXISTS: 'STORY_MEMBER_EXISTS',
  /** Adding a collaborator would exceed MAX_STORY_COLLABORATORS (409). */
  STORY_COLLABORATOR_LIMIT: 'STORY_COLLABORATOR_LIMIT',
  /**
   * The story has no collaborator seat left on its OWNER's plan, so the owner cannot invite or add
   * another (402 — B6, `PlanLimits.maxCollaborators`). `details` carries `{ used, limit }`.
   *
   * Three codes it is deliberately not:
   *
   * - **`STORY_COLLABORATOR_LIMIT`** (directly above) is the absolute anti-abuse ceiling —
   *   `MAX_STORY_COLLABORATORS`, the same 20 for every plan, a 409 with no remedy but "remove
   *   someone". This one is plan-driven and upgrading clears it, which is a different conversation
   *   and a different status.
   * - **`PIECE_LIMIT_REACHED`** is B4's cap and its remedies ("delete a piece", "see plans") apply
   *   to the author's own library. This cap is per STORY and can bind an author who is nowhere near
   *   their piece limit.
   * - **`QUOTA_EXCEEDED`** is a flow cap whose remedy is to wait for a window to reset. Nothing
   *   about a seat resets, so that remedy is a lie here — the W4 defect, docs/48 §3.6.
   *
   * Remedy: see plans, or remove a collaborator.
   */
  COLLABORATOR_LIMIT_REACHED: 'COLLABORATOR_LIMIT_REACHED',
  /**
   * The invitee tried to accept an invitation to a story whose owner has no seat left (409 — B6).
   *
   * Separate from `COLLABORATOR_LIMIT_REACHED` because the person reading it is not the person who
   * can fix it: the invite was valid when it was sent and the owner has since downgraded or filled
   * the story. A 402 and an upsell would bill the wrong human for someone else's plan, so this is a
   * state conflict with no remedy the invitee can act on beyond telling the owner.
   */
  COLLABORATOR_SEATS_UNAVAILABLE: 'COLLABORATOR_SEATS_UNAVAILABLE',
  /** The caller's story role is insufficient for this action (403). */
  STORY_ROLE_FORBIDDEN: 'STORY_ROLE_FORBIDDEN',
  /** The owner role cannot be reassigned/removed via membership APIs. */
  STORY_OWNER_IMMUTABLE: 'STORY_OWNER_IMMUTABLE',
  /** No such invitation, or it is not the caller's (privacy-preserving 404). */
  INVITATION_NOT_FOUND: 'INVITATION_NOT_FOUND',
  /** The invitation window has elapsed (409). */
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  /** Accept/decline attempted on an invitation that is no longer pending (409). */
  INVITATION_ALREADY_RESPONDED: 'INVITATION_ALREADY_RESPONDED',
  /** The caller is not the invitee of this invitation (403). */
  INVITATION_NOT_INVITEE: 'INVITATION_NOT_INVITEE',
  /** A user cannot invite themselves to their own story (409). */
  INVITATION_SELF: 'INVITATION_SELF',
  /** No such collaboration comment (privacy-preserving 404). */
  COLLAB_COMMENT_NOT_FOUND: 'COLLAB_COMMENT_NOT_FOUND',
  /** Editing/deleting a comment the caller may not act on (403). */
  COLLAB_COMMENT_FORBIDDEN: 'COLLAB_COMMENT_FORBIDDEN',
  /** Replying to / resolving a comment thread that is already resolved (409). */
  COLLAB_COMMENT_RESOLVED: 'COLLAB_COMMENT_RESOLVED',
  /** No such suggestion (privacy-preserving 404). */
  SUGGESTION_NOT_FOUND: 'SUGGESTION_NOT_FOUND',
  /** Acting on a suggestion the caller may not resolve/withdraw (403). */
  SUGGESTION_FORBIDDEN: 'SUGGESTION_FORBIDDEN',
  /** Accept/reject attempted on a suggestion that is no longer pending (409). */
  SUGGESTION_ALREADY_RESOLVED: 'SUGGESTION_ALREADY_RESOLVED',
  /** The suggestion's anchor no longer matches the content — conflict detected (409). */
  SUGGESTION_CONFLICT: 'SUGGESTION_CONFLICT',

  // ── Publishing workflow (AF6 — review, approval, snapshots) ───────────────
  /** No review session for this story (404). */
  REVIEW_NOT_FOUND: 'REVIEW_NOT_FOUND',
  /** The review is in a state that does not permit this transition (409). */
  REVIEW_INVALID_STATE: 'REVIEW_INVALID_STATE',
  /** A review is already open for this story (409). */
  REVIEW_ALREADY_REQUESTED: 'REVIEW_ALREADY_REQUESTED',
  /** Publish blocked: the story is review-gated and not yet approved (409). */
  PUBLICATION_NOT_APPROVED: 'PUBLICATION_NOT_APPROVED',
  /** No such content snapshot (404). */
  SNAPSHOT_NOT_FOUND: 'SNAPSHOT_NOT_FOUND',

  // ── Trust & Safety (AF6 — reputation, strikes, restrictions, blocks) ──────
  /** No trust profile for this user (404). */
  TRUST_PROFILE_NOT_FOUND: 'TRUST_PROFILE_NOT_FOUND',
  /** No such restriction (404). */
  RESTRICTION_NOT_FOUND: 'RESTRICTION_NOT_FOUND',
  /** The action is blocked by an active restriction on the caller (403). */
  RESTRICTION_ACTIVE: 'RESTRICTION_ACTIVE',
  /** Interaction blocked — one party has blocked the other (403). */
  USER_BLOCKED: 'USER_BLOCKED',
  /** A user cannot block/mute themselves (409). */
  BLOCK_SELF: 'BLOCK_SELF',
  /** No such block/mute edge to remove (404). */
  BLOCK_NOT_FOUND: 'BLOCK_NOT_FOUND',

  // ── Operations platform (P7.4 — incident management, alerting, rollout) ───
  /** Referenced an incident id that does not exist / has been retired. */
  OPERATIONS_INCIDENT_NOT_FOUND: 'OPERATIONS_INCIDENT_NOT_FOUND',
  /** An incident status change that the lifecycle does not permit (409). */
  OPERATIONS_INVALID_TRANSITION: 'OPERATIONS_INVALID_TRANSITION',
  /** Referenced a feature-rollout key that has no backing flag (404). */
  OPERATIONS_ROLLOUT_NOT_FOUND: 'OPERATIONS_ROLLOUT_NOT_FOUND',
  /** A rollout percentage / parameter outside the allowed range (422). */
  OPERATIONS_INVALID_ROLLOUT: 'OPERATIONS_INVALID_ROLLOUT',

  // ── Cross-cutting ───────────────────────────────────────────────────────
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  /** PBAC: authenticated but lacking a required permission (docs 13 §4 — PermissionGuard). */
  AUTH_PERMISSION_DENIED: 'AUTH_PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

/** Union of every catalogued error code string. */
export type ErrorCode = keyof typeof ERROR_CODES;
