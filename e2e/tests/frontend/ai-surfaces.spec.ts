import { freshLogin, freshLoginAs } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import {
  AiConversationDetailPage,
  AiConversationsPage,
  AiHubPage,
  AiUsagePage,
  PromptLibraryPage,
} from '../../pages/frontend/ai-pages';

/**
 * The three remaining AI surfaces (AF1/AF2, W8) — conversations, the prompt library and AI token
 * usage — against the real stack.
 *
 * **No AI feature flag is touched, and no lock is taken.** Both routes these surfaces read guard on the
 * `ai.use` **permission** only: `AiConversationsController` is `@Permissions(PERMISSIONS.AiUse)` on
 * every route and `GET /ai/usage/me` likewise. `feature.ai.enabled` gates *completions*, not
 * conversation CRUD or the usage ledger, so these tests are genuinely flag-independent and stay fully
 * parallel — unlike the assistant and AF4 specs, which must queue on the shared flag mutex.
 *
 * `ai.use` itself is worth a word: it was one of the three permissions the PBAC seed-grant defect
 * withheld on pre-existing databases (docs/48 §3.7). If these tests 403, that defect has regressed —
 * which is a more useful failure than a skipped row.
 *
 * What is deliberately NOT asserted:
 *
 * - **Archiving.** No control exists to drive; `PATCH status:'archived'` hides nothing (W8-2).
 * - **Continuing a conversation as a chat.** Web has no composer on the detail view on purpose — the
 *   assistant needs the manuscript and lives in the editor (W2). What IS asserted is the hand-off: the
 *   detail view deep-links into the editor with the conversation bound, which is what lets a
 *   conversation gain messages at all.
 * - **The prompt library's hand-off into the assistant.** "Use in assistant" navigates to the editor
 *   and prefills Ask AI, but the panel renders a notice instead of its controls while
 *   `feature.ai.writingAssistant.enabled` is down — so asserting the prefilled field requires the flag
 *   and the suite's flag mutex. It lives in `assistant.spec.ts`'s serial block for that reason, and
 *   moving it there is what keeps this file fully parallel. Verified locally by the failure: with the
 *   flags at their seeded default the field does not exist to fill.
 * - **A conversation containing messages.** Messages are only ever written by a completion that was
 *   given a `conversationId` (`ai-completion.service.ts:338`), and driving a real completion means
 *   raising the AI flags and taking the lock. That path is already covered by `assistant.spec.ts`;
 *   duplicating it here to populate a list would buy the same coverage at the cost of serializing this
 *   whole file. The empty-history state is asserted instead, which is what a fresh conversation is.
 */
test.describe('@phase4 frontend AI surfaces (W8)', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('the AI hub is a settings section and links its sub-surfaces', async ({ page }) => {
    const hub = new AiHubPage(page);
    await hub.goto();
    await hub.expectResolved();
    // The entry point, asserted rather than assumed — three surfaces have shipped unreachable here.
    await hub.expectInSettingsNav();
    await hub.expectAllSectionsLinked();
  });

  /**
   * The conversation tests run as a **THROWAWAY user**, not the shared writer.
   *
   * Conversations are owner-scoped and every one this suite creates through the UI is untitled — the
   * "New conversation" button sends `{feature}` with no title, because there is nowhere to type one
   * before the row exists. On the shared writer, with `fullyParallel` across 8 workers and the a11y
   * and visual projects creating rows of their own, "the row titled Untitled conversation" resolves to
   * however many rows happen to exist: a strict-mode violation, and worse, a delete that could remove
   * a neighbouring test's row. Observed exactly that way while writing this file.
   *
   * A private account makes the list deterministic without a serial modifier or a `.first()` guess,
   * and leaves nothing behind to clean up. Same reasoning as `publishing.spec.ts`'s restricted-user
   * test, and the case `freshLoginAs`'s docblock was written for.
   */
  test.describe('conversations', () => {
    const PASSWORD = 'ChangeMe!AiSurfaces1';

    test('create → rename → export → delete, through the real endpoints', async ({
      page,
      api,
      data,
    }) => {
      const user = await api.createVerifiedUser({
        email: `ai-conv-${data.username()}@qalam.local`,
        username: data.username(),
        password: PASSWORD,
      });
      await freshLoginAs(page, user.email, PASSWORD);

      const conversations = new AiConversationsPage(page);
      await conversations.goto();
      await conversations.expectResolved();
      // A brand-new account starts with none — which is also the state mobile never leaves (W8-1).
      await expect(page.getByText('No conversations yet')).toBeVisible();

      // Create. This is the operation mobile ships a client for and never calls (W8-1), so it is the
      // single most important assertion in this file: without it the surface cannot populate at all.
      await conversations.createConversation();
      // A conversation created with no title stores `null`, and the client renders a placeholder
      // rather than an empty row.
      await expect(conversations.row('Untitled conversation')).toHaveCount(1);

      // Rename — PATCH with `title` only.
      await conversations.rename('Untitled conversation', 'A W8 conversation');

      // Export — assert the DOWNLOAD, and that its contents are the export document's shape, which is
      // NOT the detail route's message shape (W8-3).
      const download = await conversations.exportAndReadDownload('A W8 conversation');
      expect(download.filename).toMatch(/^qalam-conversation-a-w8-conversation-[0-9a-f]{8}\.json$/);
      const document_ = JSON.parse(download.body) as {
        id: string;
        title: string;
        feature: string;
        status: string;
        messages: unknown[];
      };
      expect(document_.title).toBe('A W8 conversation');
      expect(document_.feature).toBe('writing_assistant');
      expect(document_.status).toBe('active');
      expect(Array.isArray(document_.messages)).toBe(true);
      // The export carries the conversation itself, not the detail route's message DTO.
      expect(document_).not.toHaveProperty('messageCount');

      // Delete, through the real confirmation.
      await conversations.deleteConversation('A W8 conversation');
      await expect(page.getByText('No conversations yet')).toBeVisible();
    });

    test('a conversation opens its own detail view, read-only', async ({ page, api, data }) => {
      const user = await api.createVerifiedUser({
        email: `ai-detail-${data.username()}@qalam.local`,
        username: data.username(),
        password: PASSWORD,
      });
      await freshLoginAs(page, user.email, PASSWORD);

      const conversations = new AiConversationsPage(page);
      await conversations.goto();
      await conversations.expectResolved();
      await conversations.createConversation();
      await conversations.openFirstRow();

      const detail = new AiConversationDetailPage(page);
      await detail.expectResolved();
      // A fresh conversation has no messages: nothing writes one until a completion is given this id.
      await expect(page.getByText('No messages yet')).toBeVisible();
      await detail.expectNoComposer();
      await expect(detail.backLink).toBeVisible();
      await detail.backLink.click();
      await expect(page).toHaveURL(/\/settings\/ai\/conversations$/);
    });

    test('offers no archive control, because archiving would hide nothing', async ({ page }) => {
      // Read-only, so the shared writer is fine here.
      const conversations = new AiConversationsPage(page);
      await conversations.goto();
      await conversations.expectResolved();
      await conversations.expectNoArchiveControl();
    });

    /**
     * The hand-off that makes a conversation able to gain messages at all.
     *
     * A completion is persisted only when it carried a `conversationId`
     * (`ai-completion.service.ts:338`). Nothing on either client sent one before W8, which is the root
     * of W8-1 — and without this link web's list would fill with permanently empty rows, the same trap
     * one layer over. Asserted as far as the bound editor URL; the completion itself needs the AI flag
     * mutex that `assistant.spec.ts` owns.
     */
    test('a conversation hands off to the editor with itself bound', async ({
      page,
      api,
      data,
    }) => {
      const user = await api.createVerifiedUser({
        email: `ai-bind-${data.username()}@qalam.local`,
        username: data.username(),
        password: PASSWORD,
      });
      await freshLoginAs(page, user.email, PASSWORD);

      const conversations = new AiConversationsPage(page);
      await conversations.goto();
      await conversations.expectResolved();
      await conversations.createConversation();
      await conversations.openFirstRow();

      const detail = new AiConversationDetailPage(page);
      await detail.expectResolved();
      await detail.continueInEditor();
      // The editor picks the binding out of the URL, so it survives a reload rather than living in a
      // store that a refresh would clear.
      await page.reload();
      await expect(page).toHaveURL(/conversation=[0-9a-f-]+/);
    });
  });

  test.describe('prompt library', () => {
    test('ships the built-in shelf and persists what the writer adds', async ({ page }) => {
      const library = new PromptLibraryPage(page);
      await library.goto();
      await library.expectResolved();

      await library.savePrompt('W8 scene starter', 'Continue this scene in the same register.');
      // The only copy of this data is `localStorage` — there is no server surface for presets — so
      // surviving a reload is the whole contract, and nothing on the backend could assert it.
      await library.expectPersistsAcrossReload('W8 scene starter');

      await library.favorite('Novel');
      await library.expectFavorited('Novel');
    });

    test('says plainly that presets are device-local', async ({ page }) => {
      // Without this, a writer would reasonably assume their prompts follow them to another browser.
      const library = new PromptLibraryPage(page);
      await library.goto();
      await expect(page.getByText('Saved on this device only.')).toBeVisible();
    });
  });

  test.describe('AI token usage', () => {
    test('renders the AF1 ledger with its caps stated honestly', async ({ page }) => {
      const usage = new AiUsagePage(page);
      await usage.goto();
      await usage.expectResolved();
      await usage.expectInputOutputSplit();
      await usage.expectCapsRenderedHonestly();
    });

    test('is a different page from billing usage, and links to it', async ({ page }) => {
      // The two overlap visibly — three window cards and a per-feature list each — so the thing worth
      // pinning is that they are distinct routes reading distinct endpoints, and that each points at
      // the other. A future refactor that merged them would fail here.
      const usage = new AiUsagePage(page);
      await usage.goto();
      await usage.expectResolved();
      await usage.expectBillingCrossLink();

      await page.getByRole('link', { name: /Billing usage and allowance/ }).click();
      await expect(page).toHaveURL(/\/settings\/billing\/usage$/);
      await expect(page.getByRole('heading', { name: 'AI usage', exact: true })).toBeVisible({
        timeout: 30_000,
      });
      // …and back the other way.
      await page.getByRole('link', { name: 'AI token usage' }).click();
      await expect(page).toHaveURL(/\/settings\/ai\/usage$/);
    });
  });
});
