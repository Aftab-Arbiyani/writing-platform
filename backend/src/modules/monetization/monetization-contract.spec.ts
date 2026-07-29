import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getMetadataStorage } from 'class-validator';
import type { RestorePurchasesResponse } from '@qalam/api-types';

import {
  CancelSubscriptionDto,
  ChangePlanDto,
  CreateSubscriptionDto,
  PurchaseCreditsDto,
  RestorePurchasesDto,
  ValidateCouponDto,
} from './dto/monetization-request.dto';
import { RestoreResultDto } from './dto/monetization-response.dto';
import type { MonetizationController } from './monetization.controller';

/**
 * Pins `@qalam/api-types` to the backend it describes (W4-2 / W4-5, docs/48 §3.6).
 *
 * `api-types` is handwritten until the backend emits `openapi.json`, so nothing stopped it drifting —
 * and it had drifted three ways at once: a request field the DTO **rejects**, a response with two of
 * three fields wrong, and a request field the DTO accepts but the type never mentioned. Every future
 * consumer inherits a package-level error, which is what makes this worse than the same mistake in a
 * client: mobile's **M-1** was one app shipping a broken invite; this class ships a broken invite to
 * everyone who installs the package.
 *
 * Two kinds of check, because the two directions fail differently:
 *
 * 1. **Requests — a runtime whitelist check.** The app runs
 *    `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` (`main.ts`), so a key that is not
 *    a *validated* property of the DTO does not get dropped — it **400s the whole request**. So every
 *    key a request interface declares must correspond to a property carrying at least one
 *    class-validator decorator. `@ApiProperty()` alone does not count, which is precisely the trap:
 *    a field can look documented and still be rejected.
 *
 * 2. **Responses — a compile-time structural check.** A response type that is merely *wrong* does not
 *    throw; it silently reads `undefined`. `Exact<A, B>` below fails `tsc` when the two sides diverge in
 *    either direction, so a field added to the controller and not the package (or vice versa) breaks the
 *    build rather than a client.
 *
 * This is deliberately not an exhaustive schema comparison — it pins the shapes that actually drifted
 * plus the mechanism that let them, which is what stops the next one.
 */

/** Properties of a DTO that survive `whitelist: true` — those with a validation decorator. */
function whitelistedProperties(dto: new () => object): Set<string> {
  const metadata = getMetadataStorage().getTargetValidationMetadatas(
    dto,
    '',
    false,
    false,
    undefined,
  );
  return new Set(metadata.map((entry) => entry.propertyName));
}

/**
 * The keys each request interface declares, **read out of the package's own source**.
 *
 * The first version of this hand-listed them with a `satisfies Record<keyof T, true>` guard, and it was
 * useless twice over: the list went stale the moment the interface changed (adding a field to the
 * interface does not add it to a literal), and the compile-time guard never ran because Jest transpiles
 * without type-checking. Re-introducing the exact W4-5 drift proved it — nine green tests over a live
 * defect.
 *
 * Parsing the source is the same technique `e2e/tests/frontend/a11y.spec.ts` uses to read `QTag`'s colour
 * map out of `q-tag.tsx`, and for the same reason: a test that restates what it is checking drifts from
 * it, while a test that reads it cannot. Add a field to any request interface and it is checked on the
 * next run with no edit here.
 */
const API_TYPES_SOURCE = readFileSync(
  resolve(__dirname, '../../../../packages/api-types/src/monetization.ts'),
  'utf8',
);

/** Property names declared by `export interface <name> { … }` in the package source. */
function declaredKeys(interfaceName: string): string[] {
  const block = new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`).exec(
    API_TYPES_SOURCE,
  );
  if (block === null) {
    throw new Error(`could not find "export interface ${interfaceName}" — update this parser`);
  }
  const body = block[1] ?? '';
  // Strip block comments so a `key:` inside prose is not mistaken for a property.
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...withoutComments.matchAll(/^\s*(\w+)\??:/gm)].map(([, key]) => key ?? '');
}

const REQUEST_PAIRS: ReadonlyArray<{ name: string; dto: new () => object }> = [
  { name: 'CreateSubscriptionRequest', dto: CreateSubscriptionDto },
  { name: 'ChangePlanRequest', dto: ChangePlanDto },
  { name: 'CancelSubscriptionRequest', dto: CancelSubscriptionDto },
  { name: 'PurchaseCreditsRequest', dto: PurchaseCreditsDto },
  { name: 'RestorePurchasesRequest', dto: RestorePurchasesDto },
  { name: 'ValidateCouponRequest', dto: ValidateCouponDto },
];

describe('api-types requests are accepted by the DTOs that validate them', () => {
  it.each(REQUEST_PAIRS)('$name declares no key the DTO would reject', ({ name, dto }) => {
    const allowed = whitelistedProperties(dto);
    const declared = declaredKeys(name);
    const rejected = declared.filter((key) => !allowed.has(key));
    // The DTO name rides in the compared value rather than an assertion message: Jest's `expect` takes
    // no message argument, and a bare `toEqual([])` failure would not say which class was missing which
    // field.
    expect({ validatedBy: dto.name, keysTheDtoWouldReject: rejected }).toEqual({
      validatedBy: dto.name,
      keysTheDtoWouldReject: [],
    });
  });

  it('the DTOs really do expose validated properties (guards the guard)', () => {
    // If `getTargetValidationMetadatas` ever returns nothing — a class-validator upgrade, a changed
    // signature — every assertion above would pass vacuously and this file would be decoration.
    expect(whitelistedProperties(CreateSubscriptionDto).size).toBeGreaterThan(0);
    expect(whitelistedProperties(ChangePlanDto).has('tier')).toBe(true);
  });

  it('catches the W4-5 shape specifically: couponCode is NOT accepted on a plan change', () => {
    // The regression this whole file exists for. `CreateSubscriptionDto` takes a coupon; `ChangePlanDto`
    // does not. If someone re-adds `couponCode` to `ChangePlanRequest`, the parameterised test above
    // fails — and this states the asymmetry outright so the reason is not lost.
    expect(whitelistedProperties(CreateSubscriptionDto).has('couponCode')).toBe(true);
    expect(whitelistedProperties(ChangePlanDto).has('couponCode')).toBe(false);
  });
});

// ── Response shapes (compile-time) ────────────────────────────────────────────

/** True only when A and B are mutually assignable — i.e. structurally the same shape. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * `POST /monetization/purchases/restore` — the shape that was wrong in **three** places at once: this
 * package, the orphaned Swagger DTO, and therefore any client that trusted either. All three now agree
 * with the controller's own declared return type, and these assertions fail `tsc` if they stop agreeing.
 */
const _restoreMatchesController: Exact<
  RestorePurchasesResponse,
  Awaited<ReturnType<MonetizationController['restore']>>
> = true;

const _restoreMatchesSwaggerDto: Exact<RestorePurchasesResponse, RestoreResultDto> = true;

describe('api-types responses match the controller', () => {
  it('pins RestorePurchasesResponse to the handler and to the documented DTO', () => {
    // The assertions are the two `const`s above — they are compile-time, so this body only has to keep
    // them referenced. A drift in either direction fails the build before this test ever runs.
    expect(_restoreMatchesController).toBe(true);
    expect(_restoreMatchesSwaggerDto).toBe(true);
  });
});
