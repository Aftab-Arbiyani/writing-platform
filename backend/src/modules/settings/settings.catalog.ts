import type { EnvironmentScope, SettingCategory, SettingDataType } from './settings.constants';

/**
 * A catalogued setting: its identity, type, default, and validation rules. This
 * TypeScript catalogue — NOT the database schema — is the source of truth for
 * what settings exist. On boot {@link SettingsService.syncDefaults} idempotently
 * upserts every entry as a row, so adding a setting here (and shipping) is all it
 * takes; no migration, no new column. Values already overridden by an admin are
 * preserved on re-sync (only metadata is refreshed).
 */
export interface SettingDefinition {
  key: string;
  category: SettingCategory;
  dataType: SettingDataType;
  defaultValue: unknown;
  description: string;
  editable: boolean;
  environmentScope: EnvironmentScope;
  /** Type-specific constraints read by `validateSettingValue`. */
  validationRules: Record<string, unknown>;
}

/** Convenience builder — defaults `editable: true`, `environmentScope: 'all'`. */
function def(entry: {
  key: string;
  category: SettingCategory;
  dataType: SettingDataType;
  defaultValue: unknown;
  description: string;
  editable?: boolean;
  environmentScope?: EnvironmentScope;
  validationRules?: Record<string, unknown>;
}): SettingDefinition {
  return {
    editable: entry.editable ?? true,
    environmentScope: entry.environmentScope ?? 'all',
    validationRules: entry.validationRules ?? {},
    ...entry,
  };
}

const SUPPORTED_LANGUAGES = ['hi', 'ur', 'en'] as const;

/**
 * Every platform setting. Grouped by category for readability; order here is the
 * order returned by the API within a category.
 */
export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  // ── General ────────────────────────────────────────────────────────────────
  def({
    key: 'platform.name',
    category: 'general',
    dataType: 'string',
    defaultValue: 'Qalam',
    description: 'Public platform name.',
    validationRules: { minLength: 1, maxLength: 80 },
  }),
  def({
    key: 'platform.description',
    category: 'general',
    dataType: 'string',
    defaultValue: 'A premium writing sanctuary for Hindi and Urdu writers.',
    description: 'Public platform description / tagline.',
    validationRules: { maxLength: 300 },
  }),
  def({
    key: 'platform.logoUrl',
    category: 'general',
    dataType: 'string',
    defaultValue: '',
    description: 'Absolute URL of the platform logo.',
    validationRules: { maxLength: 500 },
  }),
  def({
    key: 'platform.faviconUrl',
    category: 'general',
    dataType: 'string',
    defaultValue: '',
    description: 'Absolute URL of the favicon.',
    validationRules: { maxLength: 500 },
  }),
  def({
    key: 'general.defaultLanguage',
    category: 'general',
    dataType: 'enum',
    defaultValue: 'hi',
    description: 'Default content language for new writers.',
    validationRules: { enum: [...SUPPORTED_LANGUAGES] },
  }),
  def({
    key: 'general.timezone',
    category: 'general',
    dataType: 'string',
    defaultValue: 'UTC',
    description: 'Default display timezone (IANA name).',
    validationRules: { maxLength: 40 },
  }),
  def({
    key: 'general.dateFormat',
    category: 'general',
    dataType: 'string',
    defaultValue: 'YYYY-MM-DD',
    description: 'Default date display format.',
    validationRules: { maxLength: 40 },
  }),

  // ── Authentication ───────────────────────────────────────────────────────────
  def({
    key: 'auth.google.enabled',
    category: 'authentication',
    dataType: 'boolean',
    defaultValue: true,
    description: 'Allow signing in with Google.',
  }),
  def({
    key: 'auth.password.minLength',
    category: 'authentication',
    dataType: 'number',
    defaultValue: 8,
    description: 'Minimum password length.',
    validationRules: { min: 6, max: 128, integer: true },
  }),
  def({
    key: 'auth.password.requireStrong',
    category: 'authentication',
    dataType: 'boolean',
    defaultValue: true,
    description: 'Require a mix of character classes in passwords.',
  }),
  def({
    key: 'auth.session.timeoutMinutes',
    category: 'authentication',
    dataType: 'number',
    defaultValue: 1440,
    description: 'Idle session timeout in minutes.',
    validationRules: { min: 5, max: 43200, integer: true },
  }),

  // ── Registration ─────────────────────────────────────────────────────────────
  def({
    key: 'auth.registration.enabled',
    category: 'registration',
    dataType: 'boolean',
    defaultValue: true,
    description: 'Allow new account sign-ups.',
  }),
  def({
    key: 'auth.emailVerification.required',
    category: 'registration',
    dataType: 'boolean',
    defaultValue: true,
    description: 'Require email verification before full access.',
  }),

  // ── Security ─────────────────────────────────────────────────────────────────
  def({
    key: 'security.maxLoginAttempts',
    category: 'security',
    dataType: 'number',
    defaultValue: 5,
    description: 'Failed logins before a temporary lockout.',
    validationRules: { min: 1, max: 20, integer: true },
  }),
  def({
    key: 'security.lockoutDurationMinutes',
    category: 'security',
    dataType: 'number',
    defaultValue: 15,
    description: 'Lockout duration after too many failed logins.',
    validationRules: { min: 1, max: 1440, integer: true },
  }),
  def({
    key: 'security.passwordExpiryDays',
    category: 'security',
    dataType: 'number',
    defaultValue: 0,
    description: 'Days before a password must be changed (0 = never).',
    validationRules: { min: 0, max: 365, integer: true },
  }),
  def({
    key: 'security.rateLimit.enabled',
    category: 'security',
    dataType: 'boolean',
    defaultValue: true,
    description: 'Enforce API rate limiting.',
  }),

  // ── Content ──────────────────────────────────────────────────────────────────
  def({
    key: 'content.maxTitleLength',
    category: 'content',
    dataType: 'number',
    defaultValue: 200,
    description: 'Maximum piece title length.',
    validationRules: { min: 10, max: 500, integer: true },
  }),
  def({
    key: 'content.maxContentLength',
    category: 'content',
    dataType: 'number',
    defaultValue: 100000,
    description: 'Maximum piece body length (characters).',
    validationRules: { min: 100, max: 1000000, integer: true },
  }),
  def({
    key: 'content.maxTags',
    category: 'content',
    dataType: 'number',
    defaultValue: 5,
    description: 'Maximum tags per piece.',
    validationRules: { min: 0, max: 20, integer: true },
  }),
  def({
    key: 'content.maxCoverImageSize',
    category: 'content',
    dataType: 'number',
    defaultValue: 5242880,
    description: 'Maximum cover image size in bytes.',
    validationRules: { min: 1024, max: 52428800, integer: true },
  }),
  def({
    key: 'content.supportedLanguages',
    category: 'content',
    dataType: 'array',
    defaultValue: [...SUPPORTED_LANGUAGES],
    description: 'Languages a writer may publish in.',
    validationRules: { itemType: 'string', enum: [...SUPPORTED_LANGUAGES], maxItems: 20 },
  }),
  def({
    key: 'content.supportedGenres',
    category: 'content',
    dataType: 'array',
    defaultValue: ['poetry', 'story', 'essay', 'article'],
    description: 'Genres available when publishing.',
    validationRules: { itemType: 'string', maxItems: 50 },
  }),

  // ── Moderation ───────────────────────────────────────────────────────────────
  def({
    key: 'moderation.autoModeration.enabled',
    category: 'moderation',
    dataType: 'boolean',
    defaultValue: false,
    description: 'Run automated moderation on new content.',
  }),
  def({
    key: 'moderation.reportThreshold',
    category: 'moderation',
    dataType: 'number',
    defaultValue: 5,
    description: 'Open reports before content is auto-hidden for review.',
    validationRules: { min: 1, max: 100, integer: true },
  }),
  def({
    key: 'moderation.appealWindowDays',
    category: 'moderation',
    dataType: 'number',
    defaultValue: 14,
    description: 'Days a moderated user may appeal.',
    validationRules: { min: 1, max: 90, integer: true },
  }),
  def({
    key: 'moderation.defaultPriority',
    category: 'moderation',
    dataType: 'enum',
    defaultValue: 'normal',
    description: 'Default priority for new reports.',
    validationRules: { enum: ['low', 'normal', 'high', 'urgent'] },
  }),
  def({
    key: 'moderation.defaultContentVisibility',
    category: 'moderation',
    dataType: 'enum',
    defaultValue: 'public',
    description: 'Default visibility for newly published content.',
    validationRules: { enum: ['public', 'private'] },
  }),

  // ── Notifications ────────────────────────────────────────────────────────────
  def({
    key: 'notification.email.enabled',
    category: 'notifications',
    dataType: 'boolean',
    defaultValue: true,
    description: 'Send notification emails.',
  }),
  def({
    key: 'notification.inApp.enabled',
    category: 'notifications',
    dataType: 'boolean',
    defaultValue: true,
    description: 'Deliver in-app notifications.',
  }),
  def({
    key: 'notification.digest.enabled',
    category: 'notifications',
    dataType: 'boolean',
    defaultValue: true,
    description: 'Send periodic digest emails.',
  }),
  def({
    key: 'notification.digest.frequency',
    category: 'notifications',
    dataType: 'enum',
    defaultValue: 'weekly',
    description: 'Digest cadence.',
    validationRules: { enum: ['daily', 'weekly', 'off'] },
  }),
  def({
    key: 'notification.systemBroadcast.enabled',
    category: 'notifications',
    dataType: 'boolean',
    defaultValue: true,
    description: 'Allow platform-wide system broadcasts.',
  }),

  // ── Email ────────────────────────────────────────────────────────────────────
  def({
    key: 'email.fromName',
    category: 'email',
    dataType: 'string',
    defaultValue: 'Qalam',
    description: 'Display name on outbound email.',
    validationRules: { minLength: 1, maxLength: 80 },
  }),
  def({
    key: 'email.fromAddress',
    category: 'email',
    dataType: 'string',
    defaultValue: 'no-reply@qalam.app',
    description: 'From address on outbound email.',
    validationRules: { maxLength: 200, pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
  }),
  def({
    key: 'email.replyTo',
    category: 'email',
    dataType: 'string',
    defaultValue: '',
    description: 'Reply-to address (blank = none).',
    validationRules: { maxLength: 200 },
  }),

  // ── Storage ──────────────────────────────────────────────────────────────────
  def({
    key: 'storage.provider',
    category: 'storage',
    dataType: 'enum',
    defaultValue: 'minio',
    description: 'Object storage provider (infra-managed).',
    editable: false,
    validationRules: { enum: ['minio', 's3', 'local'] },
  }),
  def({
    key: 'storage.maxUploadSize',
    category: 'storage',
    dataType: 'number',
    defaultValue: 10485760,
    description: 'Maximum upload size in bytes.',
    validationRules: { min: 1024, max: 104857600, integer: true },
  }),
  def({
    key: 'storage.allowedFileTypes',
    category: 'storage',
    dataType: 'array',
    defaultValue: ['image/jpeg', 'image/png', 'image/webp'],
    description: 'Allowed upload MIME types.',
    validationRules: { itemType: 'string', maxItems: 50 },
  }),
  def({
    key: 'storage.retentionDays',
    category: 'storage',
    dataType: 'number',
    defaultValue: 0,
    description: 'Days to retain orphaned uploads (0 = keep).',
    validationRules: { min: 0, max: 3650, integer: true },
  }),

  // ── Maintenance ──────────────────────────────────────────────────────────────
  def({
    key: 'maintenance.enabled',
    category: 'maintenance',
    dataType: 'boolean',
    defaultValue: false,
    description: 'Whether the platform is in maintenance mode.',
  }),
  def({
    key: 'maintenance.message',
    category: 'maintenance',
    dataType: 'string',
    defaultValue: 'We are performing scheduled maintenance and will be back shortly.',
    description: 'Message shown while in maintenance mode.',
    validationRules: { maxLength: 500 },
  }),
  def({
    key: 'maintenance.estimatedCompletion',
    category: 'maintenance',
    dataType: 'string',
    defaultValue: '',
    description: 'Estimated completion time (ISO 8601; blank = unknown).',
    validationRules: { maxLength: 40 },
  }),
  def({
    key: 'maintenance.allowedRoles',
    category: 'maintenance',
    dataType: 'array',
    defaultValue: ['super_admin', 'admin'],
    description: 'Roles that may still access the platform during maintenance.',
    validationRules: {
      itemType: 'string',
      enum: ['super_admin', 'admin', 'moderator', 'user'],
      maxItems: 4,
    },
  }),

  // ── Appearance ───────────────────────────────────────────────────────────────
  def({
    key: 'appearance.theme',
    category: 'appearance',
    dataType: 'enum',
    defaultValue: 'system',
    description: 'Default theme for new visitors.',
    validationRules: { enum: ['light', 'dark', 'system'] },
  }),
  def({
    key: 'appearance.primaryColor',
    category: 'appearance',
    dataType: 'string',
    defaultValue: '#1f6f5c',
    description: 'Primary brand colour (hex).',
    validationRules: { pattern: '^#([0-9a-fA-F]{6})$', maxLength: 7 },
  }),
  def({
    key: 'appearance.accentColor',
    category: 'appearance',
    dataType: 'string',
    defaultValue: '#d9a441',
    description: 'Accent brand colour (hex).',
    validationRules: { pattern: '^#([0-9a-fA-F]{6})$', maxLength: 7 },
  }),

  // ── Localization ─────────────────────────────────────────────────────────────
  def({
    key: 'localization.defaultLocale',
    category: 'localization',
    dataType: 'enum',
    defaultValue: 'hi',
    description: 'Default UI locale.',
    validationRules: { enum: [...SUPPORTED_LANGUAGES] },
  }),
  def({
    key: 'localization.availableLocales',
    category: 'localization',
    dataType: 'array',
    defaultValue: [...SUPPORTED_LANGUAGES],
    description: 'Locales offered in the UI language switcher.',
    validationRules: { itemType: 'string', enum: [...SUPPORTED_LANGUAGES], maxItems: 20 },
  }),
  def({
    key: 'localization.rtlEnabled',
    category: 'localization',
    dataType: 'boolean',
    defaultValue: true,
    description: 'Enable right-to-left layouts (Urdu).',
  }),

  // ── AI retrieval (AF4 — Retrieval Platform) ──────────────────────────────────
  // Admin-tunable search/ranking/recommendation config. Stored as one JSON blob;
  // RetrievalConfigService merges it over compiled defaults defensively, so a
  // missing/partial value never breaks retrieval. Mirrors DEFAULT_RETRIEVAL_CONFIG.
  def({
    key: 'ai.retrieval.config',
    category: 'content',
    dataType: 'json',
    defaultValue: {
      topK: 10,
      candidatesPerSource: 40,
      contextTokens: 2000,
      timeoutMs: 8000,
      sources: { knowledge_graph: true, metadata: true, keyword: true, vector: true },
      rankingWeights: {
        semantic_similarity: 1.0,
        graph_distance: 0.5,
        popularity: 0.3,
        freshness: 0.2,
        user_preferences: 0.4,
        reading_history: 0.3,
        writing_history: 0.3,
        engagement: 0.3,
        confidence: 0.6,
      },
      synthesisEnabled: true,
    },
    description: 'AI Retrieval Platform config: sources, ranking weights, budgets (AF4).',
    validationRules: {},
  }),

  // ── Monetization (AF5 — Monetization Platform) ───────────────────────────────
  // Admin-tunable plan catalogue + cross-cutting billing config. Stored as JSON
  // blobs; MonetizationConfigService merges each over compiled defaults defensively,
  // so a missing/partial value never breaks billing. Mirrors compiledPlans() /
  // DEFAULT_CONFIG. Configurable pricing (regional/currency/promo) lives here as data.
  def({
    key: 'monetization.plans',
    category: 'monetization',
    dataType: 'json',
    defaultValue: {
      free: {
        tier: 'free',
        name: 'Free',
        description: 'Free plan',
        features: ['ai_budget'],
        limits: {
          aiDailyTokens: 20000,
          aiMonthlyTokens: 200000,
          aiMonthlyCredits: 0,
          maxPieces: 25,
        },
        monthlyCredits: 0,
        prices: { none: { usd: 0 } },
        trialDays: 0,
      },
      plus: {
        tier: 'plus',
        name: 'Plus',
        description: 'Plus plan',
        features: ['ai_budget', 'ai_writing', 'ai_discovery', 'premium_search'],
        limits: {
          aiDailyTokens: 100000,
          aiMonthlyTokens: 2000000,
          aiMonthlyCredits: 5000,
          maxPieces: 250,
        },
        monthlyCredits: 5000,
        prices: { monthly: { usd: 499 }, yearly: { usd: 4990 } },
        trialDays: 14,
      },
      pro: {
        tier: 'pro',
        name: 'Pro',
        description: 'Pro plan',
        features: [
          'ai_budget',
          'ai_writing',
          'ai_discovery',
          'story_intelligence',
          'premium_search',
          'premium_recommendations',
          'advanced_analytics',
          'publishing_pro',
        ],
        limits: {
          aiDailyTokens: 500000,
          aiMonthlyTokens: 10000000,
          aiMonthlyCredits: 25000,
          maxPieces: 0,
        },
        monthlyCredits: 25000,
        prices: { monthly: { usd: 1499 }, yearly: { usd: 14990 } },
        trialDays: 14,
      },
      enterprise: {
        tier: 'enterprise',
        name: 'Enterprise',
        description: 'Enterprise plan',
        features: [
          'ai_budget',
          'ai_writing',
          'ai_discovery',
          'story_intelligence',
          'premium_search',
          'premium_recommendations',
          'advanced_analytics',
          'publishing_pro',
        ],
        limits: {
          aiDailyTokens: 0,
          aiMonthlyTokens: 0,
          aiMonthlyCredits: 100000,
          maxPieces: 0,
        },
        monthlyCredits: 100000,
        prices: { monthly: { usd: 4999 }, yearly: { usd: 49990 } },
        trialDays: 14,
      },
    },
    description: 'Monetization plan catalogue: tiers, features, limits, prices, trials (AF5).',
    validationRules: {},
  }),
  def({
    key: 'monetization.config',
    category: 'monetization',
    dataType: 'json',
    defaultValue: {
      creditsPerUsd: 100,
      trialDays: 14,
      gracePeriodDays: 7,
      lowCreditThreshold: 500,
      taxRates: { default: 0, GB: 0.2, DE: 0.19, IN: 0.18, US: 0 },
      currencyRates: { usd: 1, eur: 0.92, gbp: 0.79, inr: 83, pkr: 278 },
      regionCurrency: { US: 'usd', GB: 'gbp', DE: 'eur', IN: 'inr', PK: 'pkr' },
    },
    description: 'Monetization config: credit rate, trial/grace, tax + currency tables (AF5).',
    validationRules: {},
  }),
];

/** Fast key → definition lookup. */
export const SETTING_DEFINITION_BY_KEY: ReadonlyMap<string, SettingDefinition> = new Map(
  SETTING_DEFINITIONS.map((definition) => [definition.key, definition]),
);

/** A seeded feature flag (E12.8). Upserted on boot, preserving admin changes. */
export interface FeatureFlagDefinition {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  environment: EnvironmentScope;
  description: string;
}

/**
 * Phase-2+ capabilities pre-registered as (disabled) feature flags so they are
 * dark-launchable the moment their code lands — no schema change required.
 */
export const FEATURE_FLAG_DEFINITIONS: readonly FeatureFlagDefinition[] = [
  {
    key: 'feature.ai.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI writing assistance master switch (AF1). Gates all AI features.',
  },
  // Per-feature AI flags (AF1). Each rides the master `feature.ai.enabled` AND
  // its own switch, so a single feature can be dark-launched independently. All
  // disabled at seed; keys match `aiFeatureFlagKey()` in @qalam/shared.
  {
    key: 'feature.ai.grammar.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI grammar assistance (future feature).',
  },
  {
    key: 'feature.ai.rewrite.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI rewrite assistance (future feature).',
  },
  {
    key: 'feature.ai.summarization.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI summarization (future feature).',
  },
  {
    key: 'feature.ai.craftCoach.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI craft coach — chapter/scene/pacing/readability/consistency feedback (AF2).',
  },
  {
    key: 'feature.ai.writingAssistant.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description:
      'AI writing assistant — in-editor continue/rewrite/expand/condense/simplify/improve/tone (AF2).',
  },
  {
    key: 'feature.ai.characterAnalysis.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI character analysis — Story Intelligence character graph (AF3).',
  },
  {
    key: 'feature.ai.plotAnalysis.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI plot analysis — Story Intelligence plot structure (AF3).',
  },
  {
    key: 'feature.ai.worldBuilding.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI world-building analysis — Story Intelligence world graph (AF3).',
  },
  {
    key: 'feature.ai.styleAnalysis.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI style analysis — Story Intelligence prose metrics (AF3).',
  },
  {
    key: 'feature.ai.storyTimeline.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI timeline analysis — Story Intelligence chronological graph (AF3).',
  },
  {
    key: 'feature.ai.semanticSearch.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI semantic search (future feature).',
  },
  {
    key: 'feature.ai.recommendations.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI recommendations (future feature).',
  },
  {
    key: 'feature.ai.askBook.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI "Ask My Book" — grounded Q&A over the story knowledge graph (AF4).',
  },
  {
    key: 'feature.ai.moderation.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI moderation assistance (future feature).',
  },
  {
    key: 'feature.payments.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'Payments, subscriptions, and monetization (Phase 2).',
  },
  {
    key: 'feature.mobile.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'Flutter mobile app parity (Phase 3).',
  },
  {
    key: 'feature.creatorEconomy.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'Creator economy features (Phase 2+).',
  },
];
