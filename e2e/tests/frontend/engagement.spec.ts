import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { CollectionDetailPage, CollectionsPage } from '../../pages/frontend/collections-page';
import {
  EngagementBar,
  ReportDialog,
  SaveToCollectionDialog,
} from '../../pages/frontend/engagement';
import { PieceConversation } from '../../pages/frontend/conversation';
import { ProfilePage } from '../../pages/frontend/profile-page';
import { ReaderPage } from '../../pages/frontend/reader-page';

/**
 * Claps, collections and report (W7b, docs/45 §4.4).
 *
 * Claps are the interesting third: **web is the reference for them**, not a port. Mobile's reader
 * action bar has no clap control at all (docs/48 §3.15), so the accumulate → batch → cap → remove
 * model is asserted here from first principles rather than against a shipped counterpart.
 *
 * The clap cap is the shared `MAX_CLAPS_PER_USER_PER_PIECE`; it is duplicated as a literal in ONE
 * place below with a comment, because the e2e package deliberately does not depend on the app's
 * source.
 */

/** `MAX_CLAPS_PER_USER_PER_PIECE` from `@qalam/shared`. Asserted against the server, not assumed. */
const MAX_CLAPS = 50;

test.describe('@phase2 frontend claps', () => {
  /**
   * THE requirement, and the one that cannot be checked from the DOM alone: a burst of clicks is
   * ONE request carrying the accumulated count. Counted by intercepting the route, because
   * "twenty taps, twenty requests" would look identical on screen.
   */
  test('a burst of clap clicks produces ONE request carrying the accumulated count', async ({
    page,
    api,
    data,
  }) => {
    // Over-budgeted for the same harness reason as the collections block below: this test does a full
    // `page.reload()` to prove the batch was really WRITTEN, and under four parallel Firefox workers
    // the Vite dev server's re-transform of the reader route exceeded the default 30 s budget. The
    // reload is the point of the test, so the budget is what moves. CI serves built output.
    test.slow();
    await freshLogin(page, 'writer');
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });

    const clapBodies: unknown[] = [];
    await page.route('**/pieces/*/claps', async (route) => {
      if (route.request().method() === 'POST') {
        clapBodies.push(route.request().postDataJSON());
      }
      await route.fallback();
    });

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    const bar = new EngagementBar(page);
    await expect(bar.clap).toBeVisible({ timeout: 30_000 });
    await bar.clapBurst(7);

    // The count moved optimistically, before anything was sent.
    await bar.expectMine(7);

    // One request, count 7 — not seven requests of one.
    await expect(async () => {
      expect(clapBodies).toHaveLength(1);
    }).toPass({ timeout: 15_000 });
    expect(clapBodies[0]).toEqual({ count: 7 });

    // And it was really written: a reload re-reads the server.
    await page.reload();
    await reader.expectRendered(title);
    await bar.expectMine(7);
  });

  /**
   * The cap, from the server's side of it: pre-spend all fifty over REST, then hammer the button.
   * No error, no phantom increment, and — the part only a route interception can prove — no request.
   */
  test('clapping stops cleanly at the cap: no error, no increment, no request', async ({
    page,
    api,
    data,
  }) => {
    await freshLogin(page, 'writer');
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });

    const spent = await api.clapPiece(piece.id, MAX_CLAPS);
    expect(spent.viewerClaps, 'the server should accept the whole cap in one request').toBe(
      MAX_CLAPS,
    );

    let clapRequests = 0;
    await page.route('**/pieces/*/claps', async (route) => {
      if (route.request().method() === 'POST') clapRequests += 1;
      await route.fallback();
    });

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    const bar = new EngagementBar(page);
    await bar.expectAtCap(MAX_CLAPS);

    // Hammer it. A disabled control swallows the clicks; `force` proves the handler is inert too.
    for (let i = 0; i < 5; i++) {
      await bar.clap.click({ force: true });
    }

    expect(clapRequests, 'a maxed-out clap button must send nothing').toBe(0);
    await bar.expectAtCap(MAX_CLAPS);
    // No phantom increment server-side either.
    const after = await api.pieceEngagement(piece.id);
    expect(after.viewer.clapCount).toBe(MAX_CLAPS);
  });

  /** Removal takes ALL of them, and nothing on screen presents it as a decrement. */
  test('remove-claps clears every clap and is not labelled as a decrement', async ({
    page,
    api,
    data,
  }) => {
    await freshLogin(page, 'writer');
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });
    await api.clapPiece(piece.id, 6);

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    const bar = new EngagementBar(page);
    await bar.expectMine(6);
    await expect(bar.removeClaps).toHaveAccessibleName('Remove my 6 claps');

    await bar.removeClaps.click();

    // All six gone — and the affordance with them, since there is nothing left to remove.
    await expect(bar.removeClaps).toHaveCount(0, { timeout: 30_000 });
    await expect(async () => {
      const after = await api.pieceEngagement(piece.id);
      expect(after.viewer.clapCount).toBe(0);
    }).toPass({ timeout: 15_000 });
  });

  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    /** Counts are public; acting is not. Reading a clap total needs no session. */
    test('a signed-out reader sees the clap count and is routed to sign-in on click', async ({
      page,
      api,
      data,
    }) => {
      const title = data.pieceTitle();
      const piece = await api.createPublishedPiece({ title });
      await api.clapPiece(piece.id, 12);

      const reader = new ReaderPage(page);
      await reader.gotoSlug(piece.slug as string);
      await reader.expectRendered(title);

      const bar = new EngagementBar(page);
      // The piece total is visible without a session.
      await expect(bar.clap).toContainText('12', { timeout: 30_000 });
      // …but it is not attributed to them, and there is nothing to remove.
      await expect(bar.clap).toHaveAccessibleName('Clap for this piece');
      await expect(bar.removeClaps).toHaveCount(0);

      await bar.clap.click();
      await expect(page).toHaveURL(/\/auth\/login\?returnTo=/);
    });
  });
});

test.describe('@phase2 frontend collections', () => {
  /**
   * Over-budgeted, and for a harness reason worth naming rather than retrying past.
   *
   * `/me/collections` and `/me/collections/:id` are NEW lazy route modules. Locally Playwright drives
   * the Vite **dev** server, which transforms a route's module graph on first request — and with four
   * workers hammering Firefox that first load blew the default 30 s budget and left a blank page,
   * consistently (3 runs, 3 tests). Serially the same tests finish in 4–7 s, which is what identifies
   * it as contention rather than a defect.
   *
   * CI serves `vite preview` (pre-built output), so it does not pay this at all. The budget is here so
   * a local whole-suite run is not red for a reason that has nothing to do with collections.
   */
  test.slow();

  test('create, rename and delete a collection', async ({ page, data }) => {
    await freshLogin(page, 'writer');
    const collections = new CollectionsPage(page);
    await collections.goto();
    await collections.expectLoaded();

    const name = `E2E Collection ${data.username()}`;
    await collections.create(name);

    // It survives a reload, so it reached the server rather than the DOM.
    await page.reload();
    await collections.expectLoaded();
    await expect(collections.card(name)).toBeVisible({ timeout: 30_000 });

    const renamed = `${name} (kept)`;
    await collections.rename(name, renamed);
    await collections.remove(renamed);
  });

  /**
   * The round trip the row is really about: save from the READER, then find the piece in the
   * collection's own detail. Both halves, because a save that never appears is the defect class this
   * codebase repeats.
   */
  test('save a piece from the reader, then find it in that collection', async ({
    page,
    api,
    data,
  }) => {
    await freshLogin(page, 'writer');
    const collectionName = `E2E Save Target ${data.username()}`;
    const collection = await api.createCollection({ title: collectionName });
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    await new EngagementBar(page).openSaveToCollection();
    await new SaveToCollectionDialog(page).save(collectionName);
    await expect(page.getByText(`Saved to ${collectionName}`)).toBeVisible({ timeout: 30_000 });

    // Server-side truth, then the surface that renders it.
    const saved = await api.collectionPieces(collection.id);
    expect(saved.map((row) => row.pieceId)).toContain(piece.id);

    const detail = new CollectionDetailPage(page);
    await detail.goto(collection.id);
    await expect(detail.heading(collectionName)).toBeVisible({ timeout: 30_000 });
    await expect(detail.piece(title)).toBeVisible({ timeout: 30_000 });

    await api.deleteCollection(collection.id);
  });

  /** Removing a piece from a collection un-files it. The piece itself must be untouched. */
  test('removing a piece from a collection leaves the piece itself alone', async ({
    page,
    api,
    data,
  }) => {
    await freshLogin(page, 'writer');
    const collectionName = `E2E Remove From ${data.username()}`;
    const collection = await api.createCollection({ title: collectionName });
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });
    await api.addPieceToCollection(collection.id, piece.id);

    const detail = new CollectionDetailPage(page);
    await detail.goto(collection.id);
    await expect(detail.piece(title)).toBeVisible({ timeout: 30_000 });

    await detail.removePiece(title);

    // Off the list…
    const remaining = await api.collectionPieces(collection.id);
    expect(remaining.map((row) => row.pieceId)).not.toContain(piece.id);

    // …and the piece is still published and still readable, which is the whole point.
    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    await api.deleteCollection(collection.id);
  });

  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('collections are owner-only, so a visitor is sent to sign-in', async ({ page }) => {
      await page.goto('/me/collections');
      await expect(page).toHaveURL(/\/auth\/login\?returnTo=/, { timeout: 30_000 });
    });
  });
});

test.describe('@phase2 frontend report', () => {
  /**
   * ONE dialog, four entity types — the reason this is one component and not four. Each case files a
   * real report through `POST /reports` and takes the honest confirmation as the assertion.
   */
  /**
   * **Every case here reports someone ELSE's content, and that is a contract fact rather than a
   * stylistic choice.** `POST /reports` refuses a self-report with `422 REPORT_SELF` ("You cannot
   * report your own content or account"). Neither the W7 row nor `CreateReportDto` mentions it, and
   * the first version of this spec reported the shared writer's own piece and failed on it — so the
   * refusal is also asserted in its own right, below.
   */
  test('reports a PIECE', async ({ page, api, data }) => {
    const stranger = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    const strangerToken = await api.loginToken(stranger.email, stranger.password);
    const title = data.pieceTitle();
    const piece = await api.createPublishedPieceAs(strangerToken, { title });

    await freshLogin(page, 'writer');
    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    await new EngagementBar(page).openReport();
    const dialog = new ReportDialog(page);
    await dialog.expectTitled('this piece');
    await dialog.file('Spam');
  });

  /**
   * The refusal, surfaced rather than swallowed. Found by this spec's own first run: the dialog sat
   * on a spinner because the assertion only looked for success. A reader who reports their own piece
   * must be told why, and must keep what they typed.
   */
  test('a self-report is refused, and the refusal is shown', async ({ page, api, data }) => {
    await freshLogin(page, 'writer');
    const title = data.pieceTitle();
    // The seeded writer's OWN piece — the case the server rejects.
    const piece = await api.createPublishedPiece({ title });

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    await new EngagementBar(page).openReport();
    const dialog = new ReportDialog(page);
    await expect(dialog.dialog).toBeVisible({ timeout: 15_000 });
    await dialog.details.fill('Testing the self-report refusal.');
    await dialog.submit.click();

    await expect(page.getByText('Couldn’t send the report')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Report sent for review')).toHaveCount(0);
    // The dialog stays open with the text intact, so nothing the reader wrote is lost.
    await expect(dialog.details).toHaveValue('Testing the self-report refusal.');
    await expect(dialog.submit).toBeEnabled();
  });

  test('reports a COMMENT — the affordance W7a held back for this row', async ({
    page,
    api,
    data,
  }) => {
    // Someone else's comment: reporting your own is meaningless, so the control is not offered there.
    const stranger = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    const strangerToken = await api.loginToken(stranger.email, stranger.password);

    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });
    const body = `Reportable comment ${data.username()}`;
    await api.commentOnPieceAs(strangerToken, piece.id, body);

    await freshLogin(page, 'writer');
    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    const conversation = new PieceConversation(page);
    await conversation.expectLoaded();
    await conversation.comment(body).getByRole('button', { name: 'Report' }).click();

    const dialog = new ReportDialog(page);
    await dialog.expectTitled('this comment');
    await dialog.file('Harassment or bullying', 'They have posted this repeatedly.');
  });

  test('reports a RESPONSE', async ({ page, api, data }) => {
    const stranger = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });
    const strangerToken = await api.loginToken(stranger.email, stranger.password);

    await freshLogin(page, 'writer');
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });
    const responseTitle = data.pieceTitle();
    // Authored by the stranger, so it is reportable by the viewer.
    await api.createPublishedResponseAs(strangerToken, piece.id, responseTitle);

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    const conversation = new PieceConversation(page);
    await conversation.expectLoaded();
    await expect(conversation.response(responseTitle)).toBeVisible({ timeout: 30_000 });
    await conversation.responses.getByRole('button', { name: 'Report' }).first().click();

    const dialog = new ReportDialog(page);
    await dialog.expectTitled('this response');
    await dialog.file('Copyright infringement');
  });

  test('reports a USER, from their profile', async ({ page, api, data }) => {
    const stranger = await api.createVerifiedUser({
      email: data.email(),
      username: data.username(),
      password: data.password(),
    });

    await freshLogin(page, 'writer');
    const profile = new ProfilePage(page);
    await profile.gotoUser(stranger.username);

    // Self never sees this control; a stranger's profile does.
    await page.getByRole('button', { name: 'Report' }).click();
    const dialog = new ReportDialog(page);
    await dialog.expectTitled('this person');
    await dialog.file('Impersonation', 'This account is pretending to be someone else.');
  });

  /** The 1000-char bound is `CreateReportDto`'s, and it is enforced before the request. */
  test('a description over 1000 characters is refused client-side', async ({ page, api, data }) => {
    await freshLogin(page, 'writer');
    const title = data.pieceTitle();
    const piece = await api.createPublishedPiece({ title });

    let reportRequests = 0;
    await page.route('**/reports', async (route) => {
      if (route.request().method() === 'POST') reportRequests += 1;
      await route.fallback();
    });

    const reader = new ReaderPage(page);
    await reader.gotoSlug(piece.slug as string);
    await reader.expectRendered(title);

    await new EngagementBar(page).openReport();
    const dialog = new ReportDialog(page);
    await expect(dialog.dialog).toBeVisible({ timeout: 15_000 });

    await dialog.details.fill('x'.repeat(1001));
    await expect(dialog.submit).toBeDisabled();
    await expect(dialog.dialog).toContainText('Keep it under 1,000 characters.');

    // Nothing was sent — the reader keeps what they typed instead of losing it to a 400.
    expect(reportRequests).toBe(0);
  });
});
