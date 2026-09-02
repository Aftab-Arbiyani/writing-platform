import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../../../common/constants/metadata.constants';
import { SemanticSearchController } from './semantic-search.controller';

/**
 * D5 made search the product's one search engine, for everyone. That is a ROUTE-METADATA
 * fact, and route metadata is exactly what a unit test that calls the service directly
 * cannot see — the E2E suite found this class of defect the hard way (an authenticated read
 * firing for anonymous readers, 48 §3.25). So the guard posture is pinned here, on the
 * decorators themselves:
 *
 * - the two query routes are `@Public()` and carry no permission requirement, so an
 *   anonymous reader can search;
 * - the three saved-search routes are NOT public, because saving belongs to an account.
 *
 * A future `@Permissions(...)` re-added to `search` would silently 403 every signed-out
 * visitor; this fails instead.
 */
describe('SemanticSearchController route metadata', () => {
  const reflector = new Reflector();
  const proto = SemanticSearchController.prototype;

  const isPublic = (handler: unknown): boolean =>
    reflector.get<boolean>(IS_PUBLIC_KEY, handler as never) === true;
  const permissions = (handler: unknown): string[] | undefined =>
    reflector.get<string[]>(PERMISSIONS_KEY, handler as never);

  it.each([
    ['search_', proto.search_],
    ['suggestions', proto.suggestions],
  ])('%s is public and unpermissioned — anonymous readers can search', (_name, handler) => {
    expect(isPublic(handler)).toBe(true);
    expect(permissions(handler)).toBeUndefined();
  });

  it.each([
    ['listSaved', proto.listSaved],
    ['saveSearch', proto.saveSearch],
    ['removeSaved', proto.removeSaved],
  ])('%s stays behind authentication — saved searches belong to an account', (_name, handler) => {
    expect(isPublic(handler)).toBe(false);
  });
});
