import { freshLogin, freshLoginAs } from '../../fixtures/auth';
import { expect, test } from '../../fixtures/test';
import { SettingsBlocksPage } from '../../pages/frontend/settings-blocks-page';
import { StoryPublishingPage } from '../../pages/frontend/story-publishing-page';

/**
 * Frontend publishing + trust (AF6 / **W3c**, design docs/49 §5).
 *
 * Ported from mobile's `publishing_workflow_screen` — but only after that screen was repaired
 * against the contract, which is the precondition this row waited for. Eight defects were fixed
 * there first (P-1…P-8, `qalam-mobile/docs/56` §2.2), five of them shapes no unit test could catch
 * because the server accepted the request and discarded it.
 *
 * The assertions that carry the most weight, in the order they appear:
 *
 * 1. **A story with no review session reads "Draft".** `GET …/review` answers a 200 with
 *    `data: null`, and reading that as an error is what made every story look broken on mobile
 *    (P-4). Nothing else on this page works until that is right.
 * 2. **review → approve → publish end to end**, which also proves the capability map now explains
 *    `review.approve` and `publication.publish` — until commit f6827e0 it did not, so all five of
 *    these controls rendered nothing at all on both clients (C-2).
 * 3. **A version can be captured and reverted.** Revert answers the piece, not the snapshot (P-1).
 * 4. **A restricted account gets the wall**, not an empty page — driven by the server's own
 *    `effect`, arranged with a real admin restriction.
 * 5. **Unblocking works**, which is only true if the client sends the blocked user's id rather than
 *    the block row's (T-1) — the mobile defect this surface was built from scratch to avoid.
 */
test.describe('@phase4 frontend publishing — review, publish, versions', () => {
  test('a story with no review session reads Draft, not an error', async ({ page, api, data }) => {
    await freshLogin(page, 'writer');
    const story = await api.createPiece({ title: data.pieceTitle() });

    const publishing = new StoryPublishingPage(page);
    await publishing.goto(story.id);
    await publishing.expectResolved();

    // The whole point of P-4: `{success: true, data: null}` is a STATE.
    await publishing.expectReviewState('Draft');
    await publishing.expectPublicationControls();
  });

  test('review → approve → publish, end to end', async ({ page, api, data }) => {
    // ONE actor, all of it through the UI. This test used to arrange the approval as the admin,
    // because `review/approve` was coarse-gated on the platform permission `publishing.approve`
    // that only moderator/admin hold — while the capability map told the OWNER they could approve.
    // That was defect **W3c-1**, and it is fixed: the route now carries `collaboration.use` like
    // the rest of the review workflow, and the reviewer decision belongs to the Policy Engine,
    // which allows the owner through its ownership rule. The map and the endpoint agree, so the
    // author drives the whole workflow — which is what the button was always offering.
    await freshLogin(page, 'writer');
    const story = await api.createPiece({ title: data.pieceTitle() });

    const publishing = new StoryPublishingPage(page);
    await publishing.goto(story.id);
    await publishing.expectReviewState('Draft');

    await publishing.requestReview();

    await publishing.approveReview();

    await publishing.publish();
    await publishing.expectToast(/Story published/i);

    // History is append-only and server-written — the proof the transitions actually landed rather
    // than the UI having moved on its own.
    await publishing.expectHistoryEntry('Submitted for review');
    // The approval is now the AUTHOR's own event in the history, not an admin's (W3c-1).
    await publishing.expectHistoryEntry('Review approved');
    await publishing.expectHistoryEntry('Published');
  });

  test('W3c-1: the owner approves their own review — no dead button', async ({
    page,
    api,
    data,
  }) => {
    // The regression test for W3c-1, replacing the one that documented the 403 as expected.
    //
    // The shape of that defect was two authorization gates disagreeing: the Policy Engine (the SSOT
    // AF6 made authoritative) allowed the owner, and a coarser `@Permissions` gate in front of it
    // refused them — so both clients rendered a button that could only ever fail. What this asserts
    // is the agreement: the map offers Approve, and the click MOVES THE STATE rather than raising a
    // permission toast. A client-side role check would have been the wrong fix (docs/49 §3 forbids
    // re-deriving authorization), which is why the repair was the route's.
    await freshLogin(page, 'writer');
    const story = await api.createPiece({ title: data.pieceTitle() });

    const publishing = new StoryPublishingPage(page);
    await publishing.goto(story.id);
    await publishing.requestReview();

    await publishing.approve();

    await publishing.expectReviewState('Approved');
    await expect(page.getByText(/didn’t work|permission/i)).toHaveCount(0);
  });

  test('publishing is refused while an open review is not approved', async ({
    page,
    api,
    data,
  }) => {
    await freshLogin(page, 'writer');
    const story = await api.createPiece({ title: data.pieceTitle() });

    const publishing = new StoryPublishingPage(page);
    await publishing.goto(story.id);
    await publishing.requestReview();

    // `PUBLICATION_NOT_APPROVED` is a named state, not a generic failure: the difference between
    // "try again" and "ask your editor".
    await publishing.publish();
    await publishing.expectToast(/waiting on review/i);
  });

  test('a reviewer sends the story back with notes', async ({ page, api, data }) => {
    // Driven as the ADMIN deliberately, to keep the STAFF path covered: after W3c-1 the route's
    // coarse gate is `collaboration.use`, and the admin is authorized by the Policy Engine's staff
    // rule (`publishing.approve`) rather than by any story role — the path that would have silently
    // broken if narrowing the gate had not been safe. The admin is not a member of the story, so
    // their capability map still denies `publication.publish`: the review card renders, the
    // publication card does not, which is the gating working as designed.
    const story = await api.createPiece({ title: data.pieceTitle() });
    await api.requestReview(story.id);

    await freshLogin(page, 'admin');
    const publishing = new StoryPublishingPage(page);
    await publishing.goto(story.id);
    await publishing.expectReviewState('In review');

    // `notes`, plural — mobile sent `note`, which passed only because nothing ever set it (P-5).
    await publishing.requestChanges('Tighten the closing couplet.');
    await expect(page.getByText('Tighten the closing couplet.')).toBeVisible();
  });

  test('a version is captured and reverted', async ({ page, api, data }) => {
    await freshLogin(page, 'writer');
    const story = await api.createPiece({ title: data.pieceTitle(), body: 'The first draft.' });

    const publishing = new StoryPublishingPage(page);
    await publishing.goto(story.id);
    await publishing.expectVersionCount(0);

    await publishing.captureVersion();
    await publishing.revertNewest();
    await publishing.expectToast(/Reverted to version/i);

    // Reverting captures a `restore` version of the pre-revert text, so the list grows — and that
    // is only visible because the revert response is decoded as the PIECE, not as a snapshot (P-1).
    await publishing.expectHistoryEntry('Reverted to a snapshot');
  });

  test('visibility can be changed, and there are only three options', async ({
    page,
    api,
    data,
  }) => {
    await freshLogin(page, 'writer');
    const story = await api.createPiece({ title: data.pieceTitle() });

    const publishing = new StoryPublishingPage(page);
    await publishing.goto(story.id);

    await publishing.setVisibility('Unlisted');
    await publishing.expectToast(/Visibility set to Unlisted/i);

    // There is no `followers` value; mobile offered one and every tap on it 400'd (P-3).
    await expect(page.getByRole('button', { name: 'Followers', exact: true })).toHaveCount(0);
  });
});

test.describe('@phase4 frontend trust — restricted wall and blocks', () => {
  test('a restricted account gets the wall instead of the workflow', async ({
    page,
    api,
    data,
  }) => {
    // A THROWAWAY user: restricting the shared writer would leak into every other spec.
    const password = 'ChangeMe!Restricted1';
    const user = await api.createVerifiedUser({
      email: `restricted-${data.username()}@qalam.local`,
      username: data.username(),
      password,
    });
    const token = await api.loginToken(user.email, password);
    const story = await api.createPieceAs(token, { title: data.pieceTitle() });

    // The Policy Engine resolves trust status from this row, so the capability decision comes back
    // with a restrictive `effect` — which is what the wall keys on, never a client-side derivation.
    const restriction = await api.restrictUser(user.id, {
      type: 'read_only',
      scope: 'global',
      reason: 'E2E arranged restriction',
    });

    try {
      await freshLoginAs(page, user.email, password);
      const publishing = new StoryPublishingPage(page);
      await publishing.goto(story.id);

      await publishing.expectRestrictedWall(/your account is read-only/i);
      // The wall explains itself from the server's own data rather than a generic refusal.
      await expect(page.getByText('E2E arranged restriction')).toBeVisible();
    } finally {
      await api.liftRestriction(restriction.id);
    }
  });

  test('the safety page lists a block and a mute, and unblocking works', async ({
    page,
    api,
    data,
  }) => {
    // A THROWAWAY blocker, not the seeded writer. A block list is cumulative and the writer is
    // shared, so counting rows as the writer passes only until the first re-run — the exact trap
    // W3b found in `drafts-page` ("Published" matched more rows as the database filled).
    const password = 'ChangeMe!Blocker1';
    const blocker = await api.createVerifiedUser({
      email: `blocker-${data.username()}@qalam.local`,
      username: data.username(),
      password,
    });
    const blockerToken = await api.loginToken(blocker.email, password);
    const blocked = await api.createVerifiedUser({
      email: `blocked-${data.username()}@qalam.local`,
      username: data.username(),
      password: 'ChangeMe!Blocked1',
    });
    const muted = await api.createVerifiedUser({
      email: `muted-${data.username()}@qalam.local`,
      username: data.username(),
      password: 'ChangeMe!Muted1',
    });
    await api.blockUser(blocked.id, blockerToken);
    await api.muteUser(muted.id, blockerToken);

    await freshLoginAs(page, blocker.email, password);
    const blocks = new SettingsBlocksPage(page);
    await blocks.goto();
    await blocks.expectResolved();
    await blocks.expectInSettingsNav();

    // In good standing, the standing row reassures rather than warns.
    await blocks.expectStanding('Good standing');

    await blocks.expectRowCount(2);
    await blocks.expectKind('Blocked');
    await blocks.expectKind('Muted');

    // The T-1 assertion: the row can only leave the list if `DELETE /users/:id/block` was given the
    // blocked USER's id. Mobile passed the block ROW's id — also a UUID, so it reached the service
    // and 404'd, and unblocking could never work.
    await blocks.remove('Unblock');
    // And a mute is removed through its OWN route — the other one would 404.
    await blocks.remove('Unmute');
    await blocks.expectEmpty();
  });
});
