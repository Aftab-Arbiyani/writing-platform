import { freshLogin, freshLoginAs } from '../../fixtures/auth';
import { expect, test } from '../../fixtures/test';
import { CollaboratorsPage } from '../../pages/frontend/collaborators-page';
import { InvitationsPage } from '../../pages/frontend/invitations-page';

/**
 * Frontend collaboration — membership (AF6 / **W3a**, `features/collaboration`, design docs/49).
 *
 * The suite runs with `VITE_ENABLE_COLLABORATION=true` (playwright.config `webServer`): the surface
 * ships dark to mirror mobile, so without that env the only thing visible would be the disabled
 * state. The backend's own `feature.collaboration.enabled` **fails open**, so no seed is needed to
 * turn the platform on — which is why this epic has no untestable half, unlike `af2` (§6).
 *
 * What is deliberately asserted here:
 *
 * 1. **The roster resolves** for a story's owner, with the owner row and its role badge — i.e. the
 *    capability map came back and the page reflected it.
 * 2. **Invite resolves a handle and sends an id.** This is the regression guard for defect **M-1**
 *    (docs/48 §3.1): mobile invites by email against an endpoint that only accepts `inviteeId`, so
 *    every mobile invite 400s. Driving the dialog through the UI proves the resolution step works.
 * 3. **A second actor accepts and becomes a member** — the full round trip, ending in a server-side
 *    membership rather than a UI state.
 * 4. **A bad handle cannot be sent**, so a typo fails before the request rather than after it.
 */
test.describe('@phase4 frontend collaboration — membership', () => {
  test('the story owner sees the roster and may invite', async ({ page, api, data }) => {
    await freshLogin(page, 'writer');
    const story = await api.createPiece({ title: data.pieceTitle() });

    const collaborators = new CollaboratorsPage(page);
    await collaborators.goto(story.id);
    await collaborators.expectResolved();
    await collaborators.expectSelfListed();
    await collaborators.expectRoleBadge('Owner');
    // Capability-gated: visible only because the server returned an `allow` for `story.invite`.
    await collaborators.expectCanInvite();
  });

  test('inviting by handle sends the invitation, and the invitee accepts it', async ({
    page,
    api,
    data,
  }) => {
    // A throwaway second actor — never the shared writer account (docs/e2e/04 §6).
    const password = data.password();
    const invitee = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password,
    });

    await freshLogin(page, 'writer');
    const story = await api.createPiece({ title: data.pieceTitle() });

    // ── Invite through the UI: handle in, user id out ────────────────────────────────────────
    const collaborators = new CollaboratorsPage(page);
    await collaborators.goto(story.id);
    await collaborators.invite(invitee.username);
    await collaborators.expectPendingInvitation();

    // ── The invitee accepts from their own inbox ─────────────────────────────────────────────
    await freshLoginAs(page, invitee.email, password);
    const inbox = new InvitationsPage(page);
    await inbox.goto();
    await inbox.expectPending();
    await inbox.acceptFirst();

    // The authoritative outcome is the membership the server now holds, not the inbox's own row.
    const members = await api.storyMembers(story.id);
    expect(members.map((member) => member.userId)).toContain(invitee.id);
  });

  test('an invitation arranged via the API shows up in the inbox', async ({ page, api, data }) => {
    const password = data.password();
    const invitee = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password,
    });
    const story = await api.createPiece({ title: data.pieceTitle() });
    await api.inviteToStory(story.id, invitee.id, 'reviewer');

    await freshLoginAs(page, invitee.email, password);
    const inbox = new InvitationsPage(page);
    await inbox.goto();
    await inbox.expectResolved();
    await inbox.expectPending();
  });

  test('a handle nobody owns cannot be invited', async ({ page, api, data }) => {
    await freshLogin(page, 'writer');
    const story = await api.createPiece({ title: data.pieceTitle() });

    const collaborators = new CollaboratorsPage(page);
    await collaborators.goto(story.id);
    await collaborators.expectHandleNotFound(`no_such_${data.username()}`);
  });

  test('a writer with no invitations sees the empty inbox', async ({ page, api, data }) => {
    const password = data.password();
    const user = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password,
    });

    await freshLoginAs(page, user.email, password);
    const inbox = new InvitationsPage(page);
    await inbox.goto();
    await inbox.expectEmpty();
  });
});
