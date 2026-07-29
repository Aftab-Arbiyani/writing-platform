import { ReviewState, Visibility } from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import {
  VISIBILITY_OPTIONS,
  publicationEventLabel,
  restrictionScopeLabel,
  reviewStateTag,
  snapshotReasonLabel,
  visibilityLabel,
} from './publishing-labels';

describe('VISIBILITY_OPTIONS', () => {
  /**
   * Defect **P-3** (`qalam-mobile/docs/56` §2.2). Mobile's visibility list carried a `followers`
   * value the `Visibility` enum does not contain, and rendered a chip per entry — so tapping
   * "Followers" sent it to `ChangeVisibilityDto` (`@IsIn(Object.values(Visibility))`) and got
   * `400 VALIDATION_FAILED` every time. Followers-only is a *profile* privacy setting.
   */
  it('is exactly the three values the server accepts — no `followers`', () => {
    expect(VISIBILITY_OPTIONS).toEqual([
      Visibility.Private,
      Visibility.Unlisted,
      Visibility.Public,
    ]);
    expect(VISIBILITY_OPTIONS).not.toContain('followers');
  });

  it('cannot drift from the shared enum', () => {
    // If `Visibility` grows a value, this fails and the option list has to be considered — rather
    // than the UI quietly offering fewer choices than the server accepts.
    expect([...VISIBILITY_OPTIONS].sort()).toEqual(Object.values(Visibility).sort());
  });
});

describe('reviewStateTag', () => {
  /**
   * Defect **P-4**: `GET /stories/:id/review` answers `data: null` for a story that has never been
   * submitted, and that is the **Draft** state — the review card must not read as an error or a
   * blank.
   */
  it('reads null as Draft', () => {
    expect(reviewStateTag(null).label).toBe('Draft');
    expect(reviewStateTag(undefined).label).toBe('Draft');
  });

  it('names every review state', () => {
    expect(reviewStateTag(ReviewState.InReview).label).toBe('In review');
    expect(reviewStateTag(ReviewState.ChangesRequested).label).toBe('Changes requested');
    expect(reviewStateTag(ReviewState.Approved).label).toBe('Approved');
    expect(reviewStateTag(ReviewState.Published).label).toBe('Published');
  });

  it('renders an unknown state as itself rather than dropping it', () => {
    // These catalogues are open (stored as varchar), so a value the server adds later must still
    // render — an unknown label is debuggable, a blank chip is not.
    expect(reviewStateTag('escalated').label).toBe('escalated');
  });
});

describe('open catalogues fall back to the wire value', () => {
  it('snapshot reasons', () => {
    expect(snapshotReasonLabel('pre_edit')).toBe('Before edit');
    expect(snapshotReasonLabel('future_reason')).toBe('future_reason');
  });

  it('publication events', () => {
    expect(publicationEventLabel('snapshot_created')).toBe('Snapshot captured');
    expect(publicationEventLabel('unheard_of')).toBe('unheard_of');
  });

  it('restriction scopes', () => {
    expect(restrictionScopeLabel('publishing')).toBe('Publishing');
    expect(restrictionScopeLabel('global')).toBe('Everywhere');
  });

  it('visibilities', () => {
    expect(visibilityLabel(Visibility.Unlisted)).toBe('Unlisted');
    expect(visibilityLabel('followers')).toBe('followers');
  });
});
