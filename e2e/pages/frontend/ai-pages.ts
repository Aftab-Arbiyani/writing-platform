import { type Locator, type Page, expect } from '@playwright/test';

/**
 * The three AI surfaces W8 adds under `/settings/ai` — conversations (list + detail), the prompt
 * library, and AI token usage — plus the hub that links them.
 *
 * One file because they share a shape: a settings sub-route, a heading, and a settled state that must
 * be distinguishable from an error panel. Each `expectResolved` asserts the ABSENCE of the error path,
 * so a failed read cannot masquerade as a rendered surface (the rule `billing-detail-pages.ts` and the
 * admin dashboards spec both follow).
 *
 * **None of these is gated on an AI feature flag**, which is why they need no `withAiFlags` lock:
 * `AiConversationsController` and `GET /ai/usage/me` guard on the `ai.use` **permission** only, not on
 * `feature.ai.enabled`. The one exception is the hub's "AI is switched off" note, which reads
 * `GET /ai/features` — {@link AiHubPage.expectResolved} deliberately does not assert on that line.
 */

/** `/settings/ai` — the hub the settings nav links to. */
export class AiHubPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { name: 'AI', exact: true });
  }

  get sectionLinks(): Locator {
    return this.page.getByRole('navigation', { name: 'AI sections' }).getByRole('link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/ai');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  async expectResolved(): Promise<void> {
    await expect(this.sectionLinks).toHaveCount(4, { timeout: 30_000 });
  }

  /**
   * The hub is reachable from the settings section nav — not only by typing the URL.
   *
   * Asserted because "built but unreachable" has shipped three times here (R-1, M5-1, W5-3), and each
   * time the surface itself worked.
   */
  async expectInSettingsNav(): Promise<void> {
    const nav = this.page.getByRole('navigation', { name: 'Settings sections' });
    await expect(nav.getByRole('link', { name: 'AI' })).toBeVisible();
  }

  /** Each sub-surface is linked from the hub, by name. */
  async expectAllSectionsLinked(): Promise<void> {
    for (const name of ['Conversations', 'Prompt library', 'Token usage']) {
      await expect(this.sectionLinks.filter({ hasText: name })).toHaveCount(1);
    }
  }
}

/** `/settings/ai/conversations` — ported from mobile's `ai_conversations_screen`. */
export class AiConversationsPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { name: 'AI conversations', exact: true });
  }

  /** Scoped to the named list: the settings section nav is also a list on this page. */
  get rows(): Locator {
    return this.page.getByRole('list', { name: 'Conversations' }).getByRole('listitem');
  }

  get newButton(): Locator {
    return this.page.getByRole('button', { name: 'New conversation' });
  }

  get filter(): Locator {
    return this.page.getByRole('searchbox', { name: /Filter conversations/ });
  }

  /** The Active / Archived shelf tabs (docs/48 §3.21). */
  shelfTab(name: 'Active' | 'Archived'): Locator {
    return this.page.getByRole('tab', { name });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/ai/conversations');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /**
   * The list has settled into either its empty state or real rows — and NOT into an error.
   *
   * Both are legitimate: a writer with no conversations is the ordinary starting state (and is
   * permanently mobile's, per docs/48 §3.12 W8-1). What must not pass silently is a failed read.
   */
  async expectResolved(): Promise<void> {
    await expect(
      this.page
        .getByRole('list', { name: 'Conversations' })
        .or(this.page.getByText('No conversations yet')),
    ).toBeVisible({ timeout: 30_000 });
  }

  /** Create one through the real button and the real endpoint, and wait for the list to show it. */
  async createConversation(): Promise<void> {
    const before = await this.rows.count().catch(() => 0);
    await this.newButton.click();
    await expect(this.rows).toHaveCount(before + 1, { timeout: 30_000 });
  }

  /** A row by its rendered title (the untitled placeholder counts). */
  row(title: string): Locator {
    return this.rows.filter({ hasText: title });
  }

  /**
   * Switch shelves and wait for the new one to settle.
   *
   * The wait is on the destination content, not on the tab's own state: the status is a QUERY
   * PARAMETER, so switching issues a fresh request, and asserting the tab looks selected would pass
   * before the rows it controls have arrived.
   */
  async openShelf(name: 'Active' | 'Archived'): Promise<void> {
    await this.shelfTab(name).click();
    await expect(this.shelfTab(name)).toHaveAttribute('aria-selected', 'true');
    await expect(
      this.page
        .getByRole('list', { name: 'Conversations' })
        .or(this.page.getByText(name === 'Archived' ? 'Nothing archived' : 'No conversations yet')),
    ).toBeVisible({ timeout: 30_000 });
  }

  /** Archive from the active shelf; the row leaves it for real, because the route filters by status. */
  async archive(title: string): Promise<void> {
    await this.row(title)
      .getByRole('button', { name: /^Archive / })
      .click();
    await expect(this.row(title)).toHaveCount(0, { timeout: 30_000 });
  }

  /** Restore from the archived shelf — the half that makes archiving something other than a delete. */
  async restore(title: string): Promise<void> {
    await this.row(title)
      .getByRole('button', { name: /^Restore / })
      .click();
    await expect(this.row(title)).toHaveCount(0, { timeout: 30_000 });
  }

  async rename(currentTitle: string, nextTitle: string): Promise<void> {
    await this.row(currentTitle)
      .getByRole('button', { name: /^Rename / })
      .click();
    const field = this.page.getByRole('textbox', { name: 'Conversation title' });
    await field.fill(nextTitle);
    await this.page.getByRole('button', { name: 'Save' }).click();
    await expect(this.row(nextTitle)).toHaveCount(1, { timeout: 30_000 });
  }

  /**
   * Export as a real browser download.
   *
   * Asserted as a download, not as a rendered page: the route returns plain JSON with no
   * `Content-Disposition` (`ai-conversations.controller.ts:123-133`), so the file only exists because
   * the client builds a Blob and clicks an anchor. Waiting on `page.waitForEvent('download')` is the
   * only assertion that proves that half works — a passing network call would not.
   */
  async exportAndReadDownload(title: string): Promise<{ filename: string; body: string }> {
    const downloadPromise = this.page.waitForEvent('download', { timeout: 30_000 });
    await this.row(title)
      .getByRole('button', { name: /^Export / })
      .click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return {
      filename: download.suggestedFilename(),
      body: Buffer.concat(chunks).toString('utf8'),
    };
  }

  async deleteConversation(title: string): Promise<void> {
    await this.row(title)
      .getByRole('button', { name: /^Delete / })
      .click();
    // The AntD confirm dialog's own OK button — the confirmation is part of the flow, not stubbed.
    await this.page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(this.row(title)).toHaveCount(0, { timeout: 30_000 });
  }

  async openFirstRow(): Promise<void> {
    await this.rows.first().getByRole('link').click();
  }
}

/** `/settings/ai/conversations/:id` — ported from mobile's `ai_conversation_screen`. */
export class AiConversationDetailPage {
  constructor(private readonly page: Page) {}

  get messages(): Locator {
    return this.page.getByRole('list', { name: 'Messages' }).getByRole('listitem');
  }

  get backLink(): Locator {
    return this.page.getByRole('link', { name: 'All conversations' });
  }

  /** Settled into a message list or the empty state, and not into an error. */
  async expectResolved(): Promise<void> {
    await expect(
      this.page.getByRole('list', { name: 'Messages' }).or(this.page.getByText('No messages yet')),
    ).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Read-only: no composer.
   *
   * Mobile can continue a conversation from this screen; web deliberately cannot, because the
   * assistant needs the manuscript and lives in the editor (W2). Continuing is offered as a LINK into
   * the editor instead — see {@link continueInEditorLink} — which is why this asserts the absence of a
   * text input specifically rather than of any continue affordance.
   */
  async expectNoComposer(): Promise<void> {
    await expect(this.page.getByRole('textbox')).toHaveCount(0);
  }

  /** The deep link that binds the editor's assistant to this conversation. */
  get continueInEditorLink(): Locator {
    return this.page.getByRole('link', { name: 'Continue in the editor' });
  }

  /**
   * Continuing hands off to the editor with this conversation bound in the URL.
   *
   * The binding is the mechanism that lets a conversation gain messages at all: the orchestrator
   * persists a turn only when the completion carried a `conversationId`
   * (`ai-completion.service.ts:338`). Asserted as far as the bound URL — driving a real completion
   * needs the AI flags and the suite's flag mutex, which `assistant.spec.ts` already owns.
   */
  async continueInEditor(conversationId?: string): Promise<void> {
    await this.continueInEditorLink.click();
    await expect(this.page).toHaveURL(
      conversationId === undefined
        ? /\/write\?conversation=[0-9a-f-]+/
        : new RegExp(`/write\\?conversation=${conversationId}`),
    );
  }
}

/** `/settings/ai/prompts` — ported from mobile's `prompt_library_screen`. Client-side only. */
export class PromptLibraryPage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Prompt library', exact: true });
  }

  get builtIn(): Locator {
    return this.page.getByRole('list', { name: 'Built in' }).getByRole('listitem');
  }

  get yourPrompts(): Locator {
    return this.page.getByRole('list', { name: 'Your prompts' }).getByRole('listitem');
  }

  get history(): Locator {
    return this.page.getByRole('list', { name: 'Recently used prompts' }).getByRole('listitem');
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/ai/prompts');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Seven built-in presets.
   *
   * A contract constant, not a data count — they ship in code, matching mobile's
   * `kBuiltInPromptPresets` — so pinning the number is safe here in a way pinning a row count from the
   * database would not be.
   */
  async expectResolved(): Promise<void> {
    await expect(this.builtIn).toHaveCount(7, { timeout: 30_000 });
  }

  async savePrompt(title: string, instruction: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Prompt title' }).fill(title);
    await this.page.getByRole('textbox', { name: 'Prompt instruction' }).fill(instruction);
    await this.page.getByRole('button', { name: 'Save prompt' }).click();
    await expect(this.yourPrompts.filter({ hasText: title })).toHaveCount(1, { timeout: 30_000 });
  }

  async favorite(presetTitle: string): Promise<void> {
    await this.page
      .getByRole('button', { name: `Favourite ${presetTitle}` })
      .first()
      .click();
  }

  async expectFavorited(presetTitle: string): Promise<void> {
    await expect(this.page.getByRole('list', { name: 'Favourites' })).toBeVisible();
    await expect(
      this.page.getByRole('button', { name: `Favourite ${presetTitle}`, pressed: true }).first(),
    ).toBeVisible();
  }

  /**
   * Presets survive a reload — they are persisted, and they are the only copy that exists.
   *
   * There is no server surface for them (docs/48 §3.12), so if `localStorage` persistence broke, a
   * writer would silently lose saved prompts and no backend assertion could catch it.
   */
  async expectPersistsAcrossReload(title: string): Promise<void> {
    await this.page.reload();
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
    await expect(this.yourPrompts.filter({ hasText: title })).toHaveCount(1, { timeout: 30_000 });
  }

  /**
   * Hand a preset to the editor's assistant.
   *
   * The route that does not depend on the clipboard — which needs a secure context and can be denied
   * outright, and which is all mobile can offer. Both are kept: Copy still exists for text wanted
   * somewhere other than the assistant.
   */
  async useInAssistant(presetTitle: string): Promise<void> {
    await this.page
      .getByRole('button', { name: `Use ${presetTitle} in the assistant` })
      .first()
      .click();
  }
}

/** `/settings/ai/usage` — the AF1 token ledger. NOT `/settings/billing/usage` (the AF5 rollup). */
export class AiUsagePage {
  constructor(private readonly page: Page) {}

  private get heading(): Locator {
    return this.page.getByRole('heading', { name: 'AI token usage', exact: true });
  }

  get windows(): Locator {
    return this.page.getByRole('list', { name: 'Token usage windows' }).getByRole('listitem');
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/ai/usage');
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Three windows rendered from `GET /ai/usage/me`.
   *
   * Three is a contract constant — the payload always carries daily, monthly and total
   * (`usage.service.ts:95-103`) — and the absence of the error panel is asserted with it.
   */
  async expectResolved(): Promise<void> {
    await expect(this.page.getByRole('status')).toHaveCount(0);
    await expect(this.windows).toHaveCount(3, { timeout: 30_000 });
  }

  /** The in/out split is the one figure the AF5 billing page cannot show. */
  async expectInputOutputSplit(): Promise<void> {
    await expect(this.page.getByText(/\d[\d,]* in · \d[\d,]* out/).first()).toBeVisible();
  }

  /**
   * A capped window exposes its bar with ARIA values; an uncapped one shows no bar.
   *
   * Which windows are capped depends on the stack's `aiConfig` (0 = unlimited), so this asserts the
   * INVARIANT rather than a count: every window either has a valued progressbar or says it has no cap.
   */
  async expectCapsRenderedHonestly(): Promise<void> {
    const count = await this.windows.count();
    for (let index = 0; index < count; index += 1) {
      const card = this.windows.nth(index);
      const bar = card.getByRole('progressbar');
      if ((await bar.count()) > 0) {
        await expect(bar).toHaveAttribute('aria-valuenow', /\d+/);
        await expect(bar).toHaveAttribute('aria-valuetext', /% used/);
      } else {
        await expect(card.getByText('No cap on this window.')).toBeVisible();
      }
    }
  }

  /** The cross-link to the AF5 rollup, present only while monetization is on. */
  async expectBillingCrossLink(): Promise<void> {
    await expect(
      this.page.getByRole('link', { name: /Billing usage and allowance/ }),
    ).toBeVisible();
  }
}
