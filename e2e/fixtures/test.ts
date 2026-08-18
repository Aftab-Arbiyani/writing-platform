import fs from 'node:fs';
import path from 'node:path';

import { test as base, expect } from '@playwright/test';

import { ApiHelper } from './api';
import { DataFactory } from './data';
import { ACTION_MENU_DIAG } from './diag-action-menu';

/**
 * The project-wide test harness (docs/e2e/02 §3). ALL specs import `test`/`expect`
 * from here — never from `@playwright/test` directly — so every test gets the
 * `api` and `data` fixtures.
 */

/**
 * TEMPORARY (docs/48 §3.18b) — the `page` override installs the action-menu diagnostic and
 * drains its records to `e2e/.diag/`, which Playwright does NOT wipe (unlike `test-results/`).
 * Removed with the fix; see `diag-action-menu.ts`.
 */
const DIAG_DIR = path.join(import.meta.dirname, '..', '.diag');

export const test = base.extend<{ api: ApiHelper; data: DataFactory }>({
  api: async ({ request }, use) => {
    await use(new ApiHelper(request));
  },
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the fixtures destructure arg.
  data: async ({}, use, testInfo) => {
    await use(new DataFactory(testInfo));
  },
  page: async ({ page }, use, testInfo) => {
    // Opt-in, so the BASELINE rate is measured on an unperturbed page: the race being
    // investigated is sub-frame, and capture listeners on every pointer event are not free.
    if (process.env.E2E_DIAG !== '1') {
      await use(page);
      return;
    }
    await page.addInitScript(ACTION_MENU_DIAG);
    const lines: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('AMDIAG ')) lines.push(text.slice('AMDIAG '.length));
    });

    await use(page);

    if (lines.length) {
      const slug = `${testInfo.titlePath.join('-')}-${testInfo.project.name}`
        .replace(/[^a-z0-9]+/gi, '-')
        .slice(0, 120);
      fs.mkdirSync(DIAG_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(DIAG_DIR, `${testInfo.status}--${slug}.log`),
        `# ${testInfo.titlePath.join(' > ')} [${testInfo.project.name}] status=${testInfo.status}\n` +
          lines.join('\n') +
          '\n',
      );
    }
  },
});

export { expect };
