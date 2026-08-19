import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { AiRetrievalPage, RETRIEVAL_ROUTES } from '../../pages/admin/ai-retrieval-page';

/**
 * A3 — the admin AI retrieval surface: the retrieval config editor and search analytics.
 *
 * **The write is exercised WITHOUT changing what retrieval does, deliberately.** `ai.retrieval.config`
 * is global and read by every AF4 request, and this suite runs `fullyParallel` with the frontend AF4
 * specs asserting ranked results, a grounded answer and recommendation shelves. Saving a mutated
 * topK, a disabled source or `synthesisEnabled: false` would change those specs' subject matter
 * mid-run — the same trap B8 avoided by having its config-table spec CANCEL rather than save
 * ([10 §2] visual notes). So the round trip here saves the form UNCHANGED: the PUT, the audited
 * settings write, the cache invalidation and the re-read all execute, and the effective config is
 * byte-identical afterwards. What a mutation would additionally prove — that a specific field
 * persists — is covered where it can be proved safely, in the admin unit specs and the backend
 * service spec.
 */
test.describe('@phase5 admin AI retrieval (A3)', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'admin');
  });

  test('both retrieval routes mount and their reads settle', async ({ page }) => {
    const retrieval = new AiRetrievalPage(page);

    for (const route of RETRIEVAL_ROUTES) {
      await retrieval.expectRenders(route);
    }
  });

  test('the config editor renders the effective config: every source and every signal', async ({
    page,
  }) => {
    const retrieval = new AiRetrievalPage(page);
    await retrieval.goto(AiRetrievalPage.config);

    // Budgets arrive populated — the read merges the settings row over compiled defaults, so a value
    // is always present. Asserted as "not empty" rather than as a number, because an operator on a
    // tuned install has legitimately changed it.
    await expect(retrieval.budgets.getByLabel('Results per request')).not.toHaveValue('');
    await expect(retrieval.budgets.getByLabel('Retrieval timeout in milliseconds')).not.toHaveValue(
      '',
    );

    // All four sources, in the planner's execution order, graph first.
    await expect(retrieval.sources.getByRole('switch')).toHaveCount(4);
    await expect(retrieval.sources.getByText('Knowledge graph')).toBeVisible();

    // The inert one says so — the toggle is enabled by default and its retriever never runs.
    await expect(retrieval.sources.getByText(/reserved extension point/i)).toBeVisible();

    // All nine ranking signals, each with a weight input.
    await expect(retrieval.ranking.getByRole('spinbutton')).toHaveCount(9);
    await expect(retrieval.weight('Semantic similarity')).not.toHaveValue('');

    // And the rule an operator would otherwise have to discover: 0 disables a signal.
    await expect(page.getByText(/0 removes the signal from ranking/i)).toBeVisible();
  });

  test('the form holds a budget to the bound the route enforces', async ({ page }) => {
    const retrieval = new AiRetrievalPage(page);
    await retrieval.goto(AiRetrievalPage.config);

    const topK = retrieval.budgets.getByLabel('Results per request');
    // 999 is past `RETRIEVAL_CONFIG_BOUNDS.topK.max` (50) — the same constant the DTO validates
    // against. The control clamps on blur rather than letting a 400 be the feedback.
    await topK.fill('999');
    await topK.blur();

    await expect(topK).toHaveValue('50');
  });

  test('saving the config round-trips through the audited write path', async ({ page }) => {
    const retrieval = new AiRetrievalPage(page);
    await retrieval.goto(AiRetrievalPage.config);

    // Capture what the server sent, save it back unchanged, then prove the re-read matches. The
    // point is the PUT → settings write → cache invalidation → GET chain, not a value change.
    const before = await retrieval.weight('Semantic similarity').inputValue();
    const timeoutBefore = await retrieval.budgets
      .getByLabel('Retrieval timeout in milliseconds')
      .inputValue();

    await page.getByRole('button', { name: 'Save config' }).click();
    await expect(page.getByText('Retrieval config saved.')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Retrieval config' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(retrieval.weight('Semantic similarity')).toHaveValue(before);
    await expect(retrieval.budgets.getByLabel('Retrieval timeout in milliseconds')).toHaveValue(
      timeoutBefore,
    );
    await retrieval.expectNoErrorPanel();
  });

  test('the analytics window can be changed and the read still resolves', async ({ page }) => {
    const retrieval = new AiRetrievalPage(page);
    await retrieval.expectRenders(AiRetrievalPage.analytics);

    await retrieval.selectWindow('Last 30 days');

    // Either branch is a pass — whether this stack has AF4 telemetry depends on what else has run —
    // but an error panel or a stuck skeleton is not.
    await expect(
      page
        .getByText('Zero-result rate', { exact: true })
        .first()
        .or(page.getByText('No AI retrieval requests in this window', { exact: true }).first()),
    ).toBeVisible({ timeout: 15_000 });
    await retrieval.expectNoErrorPanel();
  });

  /**
   * The figures are internal-only, and the page says which are shares of traffic rather than of
   * users — the reading note is content, not decoration, so it is asserted like content.
   */
  test('analytics states what its figures mean, or that there is nothing to show', async ({
    page,
  }) => {
    const retrieval = new AiRetrievalPage(page);
    await retrieval.expectRenders(AiRetrievalPage.analytics);

    const populated = page.getByText('Reading these figures', { exact: true });
    const empty = page.getByText('No AI retrieval requests in this window', { exact: true });

    if ((await empty.count()) > 0) {
      // The empty branch must still say why it is empty and what to try.
      await expect(page.getByText(/check that the AI feature flags are on/i)).toBeVisible();
      // And a truncation banner on an empty window would be a contradiction.
      await expect(retrieval.truncationNotice).toHaveCount(0);
      return;
    }

    await expect(populated).toBeVisible();
    await expect(page.getByText(/shares of the requests in this window/i)).toBeVisible();
  });
});
