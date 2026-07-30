import { test as base, expect } from '@playwright/test';

import { ApiHelper } from './api';
import { DataFactory } from './data';

/**
 * The project-wide test harness (docs/e2e/02 §3). ALL specs import `test`/`expect`
 * from here — never from `@playwright/test` directly — so every test gets the
 * `api` and `data` fixtures.
 */
export const test = base.extend<{ api: ApiHelper; data: DataFactory }>({
  api: async ({ request }, use) => {
    await use(new ApiHelper(request));
  },
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the fixtures destructure arg.
  data: async ({}, use, testInfo) => {
    await use(new DataFactory(testInfo));
  },
});

export { expect };
