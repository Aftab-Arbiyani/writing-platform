import type { RestorePurchasesResponse } from '@qalam/api-types';

import { RestoreResultDto } from './dto/monetization-response.dto';
import type { MonetizationController } from './monetization.controller';

/**
 * Pins `RestorePurchasesResponse` to the **handler's own return type** (W4-2, docs/48 §3.6).
 *
 * The package-wide guard — `common/contract/api-types.contract.spec.ts` — compares every mirrored
 * interface against its DTO's Swagger metadata, and that now covers the request/response key sets this
 * file used to check by hand (six hand-listed pairs that went stale whenever an interface changed; see
 * §3.11). What it cannot cover is the third party in W4-2: the *controller*. The Swagger DTO is only
 * what the route claims to return, and in W4-2 the DTO was wrong too — it was orphaned, carried by no
 * `@ApiOkResponse`, so it agreed with the package and both disagreed with the code.
 *
 * So this stays, reduced to the one assertion that closes that triangle. It is compile-time: Jest
 * transpiles without type-checking, so these fail under `npm run build` / `tsc`, not under `jest`.
 */

/** True only when A and B are mutually assignable — i.e. structurally the same shape. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const _restoreMatchesController: Exact<
  RestorePurchasesResponse,
  Awaited<ReturnType<MonetizationController['restore']>>
> = true;

const _restoreMatchesSwaggerDto: Exact<RestorePurchasesResponse, RestoreResultDto> = true;

describe('api-types responses match the controller', () => {
  it('pins RestorePurchasesResponse to the handler and to the documented DTO', () => {
    // The assertions are the two `const`s above — compile-time, so this body only has to keep them
    // referenced. Drift in either direction fails the build before this test ever runs.
    expect(_restoreMatchesController).toBe(true);
    expect(_restoreMatchesSwaggerDto).toBe(true);
  });
});
