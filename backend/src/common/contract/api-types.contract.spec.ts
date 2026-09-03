import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { getMetadataStorage } from 'class-validator';

import {
  AiCompletionMessageDto,
  AiCompletionRequestDto,
  AiPromptPreviewDto,
  UpdateAiOrgDefaultsDto,
  UpdateAiUserOverridesDto,
} from '../../modules/ai/dto/ai-request.dto';
import {
  AiCompletionResponseDto,
  AiConfigResponseDto,
  AiFeatureFlagInfoDto,
  AiFeaturesResponseDto,
  AiMessageDto,
  AiOrgDefaultsDto,
  AiPromptPreviewResponseDto,
  AiPromptTemplateDto,
  AiProviderInfoDto,
  AiUsageResponseDto,
  AiUsageWindowSummaryDto,
  AiUserOverridesDto,
} from '../../modules/ai/dto/ai-response.dto';
import {
  CancelSubscriptionDto,
  ChangePlanDto,
  CreateSubscriptionDto,
  PurchaseCreditsDto,
  RestorePurchasesDto,
  ValidateCouponDto,
} from '../../modules/monetization/dto/monetization-request.dto';
import {
  CheckoutDto,
  CouponValidationDto,
  CreditBalanceDto,
  CreditTransactionDto,
  EntitlementDecisionDto,
  EntitlementSnapshotDto,
  InvoiceDto,
  PaymentDto,
  PlansDto,
  PurchaseDto,
  RestoreResultDto,
  SubscriptionDto,
  SubscriptionEventDto,
  FeatureQuotaDto,
  UsageSummaryDto,
  UsageWindowDto,
} from '../../modules/monetization/dto/monetization-response.dto';
import {
  RecommendationQueryDto,
  SaveSearchDto,
  SemanticSearchDto,
  UpdateRetrievalConfigDto,
} from '../../modules/retrieval/dto/retrieval-request.dto';
import {
  ExplorerViewResponseDto,
  RecommendationItemDto,
  RecommendationResponseDto,
  RetrievalConfigDto,
  RetrievalResponseMetaDto,
  SavedSearchDto,
  SearchAnalyticsDto,
  SearchResultItemDto,
  SearchSuggestionsResponseDto,
  SemanticSearchResponseDto,
} from '../../modules/retrieval/dto/retrieval-response.dto';
import { AnalyzeStoryDto } from '../../modules/story-intelligence/dto/story-request.dto';
import {
  StoryAnalysisResultDto,
  StoryAnalysisSummaryDto,
  StoryCharacterGraphDto,
  StoryEdgeDto,
  StoryEvidenceDto,
  StoryGraphDto,
  StoryNodeDto,
  StoryTimelineDto,
  StoryTimelineEntryDto,
} from '../../modules/story-intelligence/dto/story-response.dto';

/**
 * Pins every mirrored `@qalam/api-types` interface to the backend DTO it mirrors.
 *
 * ## The class this closes
 *
 * `api-types` is HANDWRITTEN (the package's `generate` script still exits 1 — the backend does not
 * emit `openapi.json`), while the DTOs are the SSOT. Nothing connected the two, so the package drifted
 * three times, each caught by a human reading code rather than by CI:
 *
 * | | drift | how it failed |
 * | --- | --- | --- |
 * | **W4-2** | `RestorePurchasesResponse` declared `{restored, subscription, creditsGranted}`; the handler returns `{restored, providerRef, expiresAt}` | silent `undefined` on two fields, and a third field invisible |
 * | **W4-5** | `ChangePlanRequest` declared `couponCode`; `ChangePlanDto` has no such property | **400 `VALIDATION_FAILED` on the whole plan change** |
 * | **W5-1** | `SemanticSearchRequest` declared a nested `filters` object; `SemanticSearchDto` has flat `language`/`genre`/`tags` | **400 `VALIDATION_FAILED` on every filtered search** |
 *
 * Two of the three are 400s rather than type errors because `main.ts` runs
 * `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` — an undeclared key is not dropped,
 * it rejects the request. And because this is a *package*, every consumer inherits the same break: the
 * blast radius is larger than the same mistake made inside one client.
 *
 * ## Two mechanisms, because the two directions fail differently
 *
 * 1. **Requests → class-validator metadata.** A key survives `whitelist: true` only if the DTO property
 *    carries a validation decorator. `@ApiProperty()` alone does NOT count — that is precisely the trap,
 *    since a field can look documented and still 400.
 * 2. **Responses → Swagger `@ApiProperty` metadata.** A wrong response type does not throw; it reads
 *    `undefined`. The documented DTO is what the route publishes, so it is the shape to pin against.
 *
 * Both compare **both directions**: a key the package has and the DTO does not is the breaking drift;
 * a key the DTO has and the package does not is a feature reachable from the API and invisible to every
 * typed client (which is how `CreateSubscriptionRequest.region` went missing).
 *
 * ## Why it cannot go stale
 *
 * The declared keys are read out of the package's own source rather than restated here — the same
 * technique `e2e/tests/frontend/a11y.spec.ts` uses to read `QTag`'s colour map out of `q-tag.tsx`, and
 * for the same reason: a test that restates what it checks drifts from it, a test that reads it cannot.
 * `MIRRORS` and `UNMIRRORED` must between them account for **every** exported name in the package, so a
 * new interface fails this file until it is either paired with a DTO or exempted with a reason. That
 * completeness check is the part that stops the fourth instance; the pairs only close the first three.
 *
 * Recorded as a closed class in `docs/48_PlatformParityRegister.md` §3.11.
 */

// ── Reading the package's declared shapes ─────────────────────────────────────

const PACKAGE_SRC = resolve(__dirname, '../../../../packages/api-types/src');
/** `@qalam/shared` is indexed too: several api-types exports are aliases of shared vocabulary. */
const SHARED_SRC = resolve(__dirname, '../../../../packages/shared/src');

interface Declaration {
  /** Which file it was declared in (for the failure message). */
  file: string;
  /** Property names written directly in the body, before `extends` is folded in. */
  ownKeys: string[];
  /** Interface names this one extends. */
  extends: string[];
  /** For `export type X = Y` / `Partial<Y>` / `Pick<Y, …>` — the aliased name, if resolvable. */
  aliasOf: string | null;
}

/** Every `export interface`/`export type` in a package's `src`, indexed by name. */
function indexDeclarations(dir: string, into: Map<string, Declaration>): Map<string, Declaration> {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    // Strip block comments first so prose like "declared `filters?: {…}`" is not read as a property.
    const source = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

    for (const match of source.matchAll(
      /^export interface (\w+)(?: extends ([^{]+))?\s*\{([\s\S]*?)\n\}/gm,
    )) {
      const [, name = '', extendsClause = '', body = ''] = match;
      into.set(name, {
        file,
        // Only top-level properties: nested object literals are indented further, and a `}` at the
        // start of a line closes the interface, so the non-greedy body never spans two declarations.
        ownKeys: [...body.matchAll(/^ {2}(\w+)\??[?!]?:/gm)].map(([, key]) => key ?? ''),
        extends: extendsClause
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
        aliasOf: null,
      });
    }

    for (const match of source.matchAll(/^export type (\w+) = ([^;]+);/gm)) {
      const [, name = '', rhs = ''] = match;
      if (into.has(name)) continue;
      const alias = /^(?:Partial|Required|Readonly)<(\w+)>$/.exec(rhs.trim())?.[1] ?? rhs.trim();
      into.set(name, {
        file,
        ownKeys: [],
        extends: [],
        aliasOf: /^\w+$/.test(alias) ? alias : null,
      });
    }
  }
  return into;
}

const DECLARATIONS = indexDeclarations(SHARED_SRC, indexDeclarations(PACKAGE_SRC, new Map()));

/** The full property set of a declared shape, following `extends` and single-name aliases. */
function declaredKeys(name: string, seen = new Set<string>()): string[] {
  if (seen.has(name)) return [];
  seen.add(name);
  const declaration = DECLARATIONS.get(name);
  if (declaration === undefined) {
    throw new Error(`"${name}" is not declared in @qalam/api-types or @qalam/shared`);
  }
  if (declaration.aliasOf !== null) return declaredKeys(declaration.aliasOf, seen);
  return [
    ...new Set([
      ...declaration.ownKeys,
      ...declaration.extends.flatMap((parent) =>
        DECLARATIONS.has(parent) ? declaredKeys(parent, seen) : [],
      ),
    ]),
  ];
}

/** Names exported from `@qalam/api-types` itself (its `src`, not the re-exported shared vocabulary). */
const EXPORTED_BY_PACKAGE = new Set(
  [...indexDeclarations(PACKAGE_SRC, new Map()).keys()].filter((name) => name.length > 0),
);

// ── Reading the backend's declared shapes ─────────────────────────────────────

type DtoClass = new (...args: never[]) => object;

/** Properties that survive `whitelist: true` — those carrying at least one class-validator decorator. */
function validatedProperties(dto: DtoClass): string[] {
  const metadata = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false, []);
  return [...new Set(metadata.map((entry) => entry.propertyName))];
}

/** Properties the route publishes via `@ApiProperty` / `@ApiPropertyOptional`, including inherited. */
function documentedProperties(dto: DtoClass): string[] {
  const keys = new Set<string>();
  for (
    let prototype: object | null = dto.prototype as object;
    prototype !== null && prototype !== Object.prototype;
    prototype = Object.getPrototypeOf(prototype) as object | null
  ) {
    const own = (Reflect.getOwnMetadata('swagger/apiModelPropertiesArray', prototype) ??
      []) as string[];
    for (const key of own) keys.add(key.replace(/^:/, ''));
  }
  return [...keys];
}

// ── The register ──────────────────────────────────────────────────────────────

interface Mirror {
  /** The `@qalam/api-types` export. */
  type: string;
  dto: DtoClass;
  /**
   * `request` compares against class-validator metadata (what the pipe accepts); `response` against
   * Swagger metadata (what the route publishes).
   */
  direction: 'request' | 'response';
}

const MIRRORS: readonly Mirror[] = [
  // AF1 — AI platform.
  { type: 'AiProviderInfo', dto: AiProviderInfoDto, direction: 'response' },
  { type: 'AiOrgDefaults', dto: AiOrgDefaultsDto, direction: 'response' },
  { type: 'AiUserOverrides', dto: AiUserOverridesDto, direction: 'response' },
  { type: 'AiConfigResponse', dto: AiConfigResponseDto, direction: 'response' },
  { type: 'UpdateAiUserOverridesRequest', dto: UpdateAiUserOverridesDto, direction: 'request' },
  { type: 'UpdateAiOrgDefaultsRequest', dto: UpdateAiOrgDefaultsDto, direction: 'request' },
  { type: 'AiFeatureFlagInfo', dto: AiFeatureFlagInfoDto, direction: 'response' },
  { type: 'AiFeaturesResponse', dto: AiFeaturesResponseDto, direction: 'response' },
  { type: 'AiPromptTemplateInfo', dto: AiPromptTemplateDto, direction: 'response' },
  { type: 'AiPromptPreviewRequest', dto: AiPromptPreviewDto, direction: 'request' },
  { type: 'AiPromptPreviewResponse', dto: AiPromptPreviewResponseDto, direction: 'response' },
  { type: 'AiMessageDto', dto: AiMessageDto, direction: 'response' },
  { type: 'AiCompletionMessage', dto: AiCompletionMessageDto, direction: 'request' },
  { type: 'AiCompletionRequest', dto: AiCompletionRequestDto, direction: 'request' },
  { type: 'AiCompletionResponse', dto: AiCompletionResponseDto, direction: 'response' },
  { type: 'AiUsageWindowSummary', dto: AiUsageWindowSummaryDto, direction: 'response' },
  { type: 'AiUsageResponse', dto: AiUsageResponseDto, direction: 'response' },

  // AF3 — Story intelligence.
  { type: 'StoryEvidence', dto: StoryEvidenceDto, direction: 'response' },
  { type: 'StoryGraphNode', dto: StoryNodeDto, direction: 'response' },
  { type: 'StoryGraphEdge', dto: StoryEdgeDto, direction: 'response' },
  { type: 'StoryGraph', dto: StoryGraphDto, direction: 'response' },
  { type: 'StoryCharacterGraph', dto: StoryCharacterGraphDto, direction: 'response' },
  { type: 'StoryAnalysisResult', dto: StoryAnalysisResultDto, direction: 'response' },
  { type: 'StoryAnalysisSummary', dto: StoryAnalysisSummaryDto, direction: 'response' },
  { type: 'StoryTimelineEntry', dto: StoryTimelineEntryDto, direction: 'response' },
  { type: 'StoryTimelineView', dto: StoryTimelineDto, direction: 'response' },
  { type: 'AnalyzeStoryRequest', dto: AnalyzeStoryDto, direction: 'request' },

  // AF4 — Retrieval platform.
  { type: 'RetrievalResponseMeta', dto: RetrievalResponseMetaDto, direction: 'response' },
  { type: 'SemanticSearchRequest', dto: SemanticSearchDto, direction: 'request' },
  { type: 'SearchResultItem', dto: SearchResultItemDto, direction: 'response' },
  { type: 'SemanticSearchResponse', dto: SemanticSearchResponseDto, direction: 'response' },
  { type: 'SearchSuggestionsResponse', dto: SearchSuggestionsResponseDto, direction: 'response' },
  { type: 'ExplorerViewResponse', dto: ExplorerViewResponseDto, direction: 'response' },
  { type: 'RecommendationRequest', dto: RecommendationQueryDto, direction: 'request' },
  { type: 'RecommendationItem', dto: RecommendationItemDto, direction: 'response' },
  { type: 'RecommendationResponse', dto: RecommendationResponseDto, direction: 'response' },
  { type: 'SavedSearch', dto: SavedSearchDto, direction: 'response' },
  { type: 'SaveSearchRequest', dto: SaveSearchDto, direction: 'request' },
  { type: 'RetrievalAdminConfig', dto: RetrievalConfigDto, direction: 'response' },
  { type: 'UpdateRetrievalAdminConfig', dto: UpdateRetrievalConfigDto, direction: 'request' },
  { type: 'SearchAnalytics', dto: SearchAnalyticsDto, direction: 'response' },

  // AF5 — Monetization.
  { type: 'SubscriptionResponse', dto: SubscriptionDto, direction: 'response' },
  { type: 'CreateSubscriptionRequest', dto: CreateSubscriptionDto, direction: 'request' },
  { type: 'ChangePlanRequest', dto: ChangePlanDto, direction: 'request' },
  { type: 'CheckoutResponse', dto: CheckoutDto, direction: 'response' },
  { type: 'CancelSubscriptionRequest', dto: CancelSubscriptionDto, direction: 'request' },
  { type: 'SubscriptionEventResponse', dto: SubscriptionEventDto, direction: 'response' },
  { type: 'EntitlementsResponse', dto: EntitlementSnapshotDto, direction: 'response' },
  { type: 'FeatureEntitlementResponse', dto: EntitlementDecisionDto, direction: 'response' },
  { type: 'UsageWindowResponse', dto: UsageWindowDto, direction: 'response' },
  { type: 'UsageSummaryResponse', dto: UsageSummaryDto, direction: 'response' },
  { type: 'FeatureQuotaResponse', dto: FeatureQuotaDto, direction: 'response' },
  { type: 'CreditBalanceResponse', dto: CreditBalanceDto, direction: 'response' },
  { type: 'CreditTransactionResponse', dto: CreditTransactionDto, direction: 'response' },
  { type: 'PurchaseCreditsRequest', dto: PurchaseCreditsDto, direction: 'request' },
  { type: 'InvoiceResponse', dto: InvoiceDto, direction: 'response' },
  { type: 'PaymentResponse', dto: PaymentDto, direction: 'response' },
  { type: 'RestorePurchasesRequest', dto: RestorePurchasesDto, direction: 'request' },
  { type: 'RestorePurchasesResponse', dto: RestoreResultDto, direction: 'response' },
  { type: 'PurchaseResponse', dto: PurchaseDto, direction: 'response' },
  { type: 'PlansResponse', dto: PlansDto, direction: 'response' },
  { type: 'ValidateCouponRequest', dto: ValidateCouponDto, direction: 'request' },
  { type: 'ValidateCouponResponse', dto: CouponValidationDto, direction: 'response' },
];

/**
 * Exports with no DTO to mirror — each needs a reason, because "there is no DTO" is exactly the excuse
 * that let `RestorePurchasesResponse` stay orphaned through W4-2.
 */
const UNMIRRORED: Readonly<Record<string, string>> = {
  AuthTokens:
    'Documented placeholder for the not-yet-generated auth spec; no DTO publishes it (see manual.ts).',
  AiModelInfo:
    'Alias of `AiModelMetadata` from @qalam/shared, which `AiModelDto implements` — pinned by tsc, not here.',
  AiStreamEvent:
    'The SSE `data:` payload, not a body: it never passes a ValidationPipe and no DTO documents it.',

  // AF4 grounding blocks: carried inside response DTOs as `@ApiProperty({ type: Object })`, so Swagger
  // records the containing property and not these fields. The backend counterpart is the interface set
  // in `modules/retrieval/retrieval.types.ts` — a source-to-source pin, which this guard deliberately
  // does not do (see docs/48 §3.11, "not covered").
  RetrievalEvidence: 'Structural sub-block; backend counterpart is retrieval.types.ts, not a DTO.',
  RelatedEntity: 'Structural sub-block; backend counterpart is retrieval.types.ts, not a DTO.',
  NavigationTarget: 'Structural sub-block; backend counterpart is retrieval.types.ts, not a DTO.',
  RankingExplanation: 'Structural sub-block; backend counterpart is retrieval.types.ts, not a DTO.',

  // D5 removed these surfaces from the server. The types stay in `@qalam/api-types` only until
  // the web clients stop importing them — deleting them here first would break the clients'
  // typecheck in a commit that cannot also fix them. They are exempted with the reason rather
  // than quietly dropped, so the completeness check still accounts for every export and the
  // debt has an expiry rather than becoming permanent.
  AskCitation: 'Removed server-side (D5); type retained until the client half lands.',
  AskBookRequest: 'Removed server-side (D5); type retained until the client half lands.',
  AskBookResponse: 'Removed server-side (D5); type retained until the client half lands.',
  AskBookStreamEvent: 'Removed server-side (D5); type retained until the client half lands.',
  AiConversationSummary: 'Removed server-side (D5); type retained until the client half lands.',
  AiConversationDetail: 'Removed server-side (D5); type retained until the client half lands.',
  AiConversationExport: 'Removed server-side (D5); type retained until the client half lands.',
  AiConversationExportMessage:
    'Removed server-side (D5); type retained until the client half lands.',
  CreateAiConversationRequest:
    'Removed server-side (D5); type retained until the client half lands.',
  UpdateAiConversationRequest:
    'Removed server-side (D5); type retained until the client half lands.',

  // AF3 per-kind payloads: `StoryAnalysisResultDto.structured` is `Record<string, unknown>` by design
  // (the shape varies by analysis kind), so there is no per-kind DTO to compare against.
  StoryIssue: 'Nested inside the `structured` payload, which no DTO types field-by-field.',
  AnalyzedCharacter: 'Nested inside the `structured` payload, which no DTO types field-by-field.',
  AnalyzedRelationship:
    'Nested inside the `structured` payload, which no DTO types field-by-field.',
  CharacterAnalysisData:
    'A `structured` payload variant; the DTO types it as Record<string, unknown>.',
  PlotAct: 'Nested inside the `structured` payload, which no DTO types field-by-field.',
  PlotAnalysisData: 'A `structured` payload variant; the DTO types it as Record<string, unknown>.',
  WorldBuildingData: 'A `structured` payload variant; the DTO types it as Record<string, unknown>.',
  StyleAnalysisData: 'A `structured` payload variant; the DTO types it as Record<string, unknown>.',
  TimelineEvent: 'Nested inside the `structured` payload, which no DTO types field-by-field.',
  TimelineData: 'A `structured` payload variant; the DTO types it as Record<string, unknown>.',
};

// ── The guard ─────────────────────────────────────────────────────────────────

describe('@qalam/api-types matches the DTOs it mirrors', () => {
  const requests = MIRRORS.filter((m) => m.direction === 'request');
  const responses = MIRRORS.filter((m) => m.direction === 'response');

  it.each(requests)('$type is accepted, in full, by the DTO that validates it', ({ type, dto }) => {
    const validated = new Set(validatedProperties(dto));
    const declared = declaredKeys(type);
    // The DTO name rides in the compared value rather than an assertion message: Jest's `expect` takes
    // no message argument, and a bare `toEqual([])` would not say which class was missing which field.
    expect({
      contract: `${type} ⇄ ${dto.name}`,
      // Sending one of these 400s the whole request (`forbidNonWhitelisted: true`) — W4-5, W5-1.
      keysTheDtoWouldReject: declared.filter((key) => !validated.has(key)),
      // The DTO accepts these and no typed client can discover them — CreateSubscriptionRequest.region.
      keysTheDtoAcceptsButTheTypeHides: [...validated].filter((key) => !declared.includes(key)),
    }).toEqual({
      contract: `${type} ⇄ ${dto.name}`,
      keysTheDtoWouldReject: [],
      keysTheDtoAcceptsButTheTypeHides: [],
    });
  });

  it.each(responses)('$type matches the DTO the route publishes', ({ type, dto }) => {
    const documented = new Set(documentedProperties(dto));
    const declared = declaredKeys(type);
    expect({
      contract: `${type} ⇄ ${dto.name}`,
      // Reading one of these gives `undefined` at runtime — W4-2.
      keysTheServerNeverSends: declared.filter((key) => !documented.has(key)),
      keysTheServerSendsButTheTypeHides: [...documented].filter((key) => !declared.includes(key)),
    }).toEqual({
      contract: `${type} ⇄ ${dto.name}`,
      keysTheServerNeverSends: [],
      keysTheServerSendsButTheTypeHides: [],
    });
  });

  it('accounts for every export in the package — a new type cannot arrive unpinned', () => {
    const accounted = new Set([...MIRRORS.map((m) => m.type), ...Object.keys(UNMIRRORED)]);
    expect([...EXPORTED_BY_PACKAGE].filter((name) => !accounted.has(name))).toEqual([]);
  });

  it('lists nothing it no longer needs to', () => {
    const stale = [...MIRRORS.map((m) => m.type), ...Object.keys(UNMIRRORED)].filter(
      (name) => !EXPORTED_BY_PACKAGE.has(name),
    );
    expect(stale).toEqual([]);
  });

  it('really is reading metadata (guards the guard)', () => {
    // If either metadata source ever returns nothing — a class-validator or @nestjs/swagger upgrade, a
    // changed signature — every assertion above would pass vacuously and this file would be decoration.
    expect(validatedProperties(ChangePlanDto)).toEqual(
      expect.arrayContaining(['tier', 'interval']),
    );
    expect(documentedProperties(RestoreResultDto)).toEqual(
      expect.arrayContaining(['restored', 'providerRef', 'expiresAt']),
    );
    // …and reading the package source, which the whole file depends on.
    expect(declaredKeys('ChangePlanRequest')).toEqual(['tier', 'interval', 'atPeriodEnd']);
  });

  it('catches the W4-5 shape specifically: couponCode is NOT accepted on a plan change', () => {
    // `CreateSubscriptionDto` takes a coupon; `ChangePlanDto` does not. The parameterised test above
    // fails if someone re-adds it to `ChangePlanRequest`; this states the asymmetry so the reason for
    // the absence is not lost and quietly "fixed".
    expect(validatedProperties(CreateSubscriptionDto)).toContain('couponCode');
    expect(validatedProperties(ChangePlanDto)).not.toContain('couponCode');
  });
});
