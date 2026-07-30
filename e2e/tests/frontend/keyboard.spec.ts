import { freshLogin } from '../../fixtures/auth';
import { test, expect } from '../../fixtures/test';
import { AppNav } from '../../pages/frontend/app-nav';
import { expectTabReachable } from '../../pages/shared/keyboard';
import { LoginPage } from '../../pages/shared/login-page';

/**
 * Keyboard-only walkthrough of the two highest-value flows — auth and publish (docs/e2e/06
 * Phase 5, [10 §4.2]). Complementary to axe (which does NOT test tab order): this proves every
 * control on the path is reachable by Tab, activatable by Enter/Space, and free of keyboard
 * traps. A mouse is never used to operate a control here.
 */

const EMAIL = process.env.E2E_WRITER_EMAIL ?? 'writer@qalam.local';
const PASSWORD = process.env.E2E_WRITER_PASSWORD ?? 'ChangeMe!Writer1';

test.describe('@phase5 @a11y frontend keyboard: auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a writer can log in using only the keyboard', async ({ page }) => {
    const config = { loginPath: '/auth/login', rememberLabel: 'Remember me' } as const;
    await new LoginPage(page, config).goto();

    const email = page.getByLabel('Email');
    const password = page.getByLabel('Password', { exact: true });
    const submit = page.getByRole('button', { name: 'Sign in' });

    // Tab from the top of the document → the email field is reachable (nothing before it
    // swallows Tab), then type; Tab forward reaches password (correct order, no trap); type.
    await expectTabReachable(page, email, 'Email field');
    await page.keyboard.type(EMAIL);
    await expectTabReachable(page, password, 'Password field');
    await page.keyboard.type(PASSWORD);

    // The submit button is reachable by continued forward-tabbing and activates via Enter.
    await expectTabReachable(page, submit, 'Sign in button');
    await page.keyboard.press('Enter');

    await page.waitForURL('**/feed');
    await new AppNav(page).expectAuthenticated();
  });
});

test.describe('@phase5 @a11y frontend keyboard: publish', () => {
  test.beforeEach(async ({ page }) => {
    await freshLogin(page, 'writer');
  });

  test('the publish drawer is fully operable by keyboard', async ({ page, api, data }) => {
    // Arrange a ready-to-publish draft via the API, then open it in the editor — the keyboard
    // claim under test is the PUBLISH interaction (a modal drawer, the focus-trap-sensitive
    // surface), not TipTap text entry (contenteditable Tab semantics are a separate concern).
    const draft = await api.createPiece({ title: data.pieceTitle() });
    await page.goto(`/write/${draft.id}`);
    await expect(page.getByLabel('Title')).toHaveValue(draft.title ?? '', { timeout: 30_000 });

    // Reach the Publish button by keyboard and open the drawer with Enter.
    const publish = page.getByRole('button', { name: 'Publish' });
    await expectTabReachable(page, publish, 'Publish button');
    await page.keyboard.press('Enter');

    const drawer = page.getByRole('dialog', { name: 'Ready to publish' });
    await expect(drawer).toBeVisible();

    // Inside the drawer: the Genre select is keyboard-reachable and keyboard-selectable
    // (focus → ArrowDown opens + highlights → Enter commits any seeded genre).
    const genre = drawer.getByRole('combobox', { name: 'Genre' });
    await expectTabReachable(page, genre, 'Genre select');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // The "Publish now" primary is reachable and activates via keyboard, completing the publish.
    const publishNow = drawer.getByRole('button', { name: 'Publish now' });
    await expectTabReachable(page, publishNow, 'Publish now button');
    await page.keyboard.press('Enter');

    await page.waitForURL(/\/me\/drafts\?.*status=published/);
  });
});
