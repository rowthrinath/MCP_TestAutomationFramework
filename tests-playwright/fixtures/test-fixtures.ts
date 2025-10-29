import { test as base } from '@playwright/test';
import { PageManager } from '../utils/page-manager';

export interface TestFixtures {
  pages: PageManager;
}

export const test = base.extend<TestFixtures>({
  pages: async ({ page }, use) => {
    const pageManager = new PageManager(page);
    await use(pageManager);
  },
});

export { expect } from '@playwright/test';
