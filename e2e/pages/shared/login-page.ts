import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Login page object — shared by both apps (docs/e2e/05). Frontend and admin
 * render the same `@qalam/ui` inputs (labels "Email"/"Password", submit "Sign in"),
 * differing only in route and the "Remember me" label.
 */
export interface LoginPageConfig {
  readonly loginPath: string; // '/auth/login' (frontend) | '/login' (admin)
  readonly rememberLabel: string | RegExp; // 'Remember me' | 'Remember me on this device'
}

export class LoginPage {
  constructor(
    private readonly page: Page,
    private readonly config: LoginPageConfig,
  ) {}

  private get email(): Locator {
    return this.page.getByLabel('Email');
  }
  private get password(): Locator {
    return this.page.getByLabel('Password', { exact: true });
  }
  private get rememberMe(): Locator {
    return this.page.getByRole('checkbox', { name: this.config.rememberLabel });
  }
  private get submit(): Locator {
    return this.page.getByRole('button', { name: 'Sign in' });
  }

  async goto(): Promise<void> {
    await this.page.goto(this.config.loginPath);
    // Generous first-render wait: the Vite dev server compiles the login route
    // lazily on first hit (cold start can exceed the default expect timeout).
    // CI serves a prebuilt bundle, so this only ever matters locally.
    await expect(this.email).toBeVisible({ timeout: 30_000 });
  }

  async fill(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
  }

  /** Ensure the "Remember me" box is checked (persists the refresh cookie). */
  async ensureRememberMe(): Promise<void> {
    if (!(await this.rememberMe.isChecked())) {
      await this.rememberMe.check();
    }
  }

  async submitForm(): Promise<void> {
    await this.submit.click();
  }

  /** Full login: fill, remember, submit. Does not assert the outcome. */
  async loginAs(email: string, password: string, remember = true): Promise<void> {
    await this.fill(email, password);
    if (remember) {
      await this.ensureRememberMe();
    }
    await this.submitForm();
  }
}
