import { test, expect } from '@playwright/test';
import { PAGES } from './_shared';

// USER STORY: every one of the 7 public routes loads cleanly — returns 200,
// has exactly one <h1>, and has a non-empty <title>.
test.describe('pages-load', () => {
  for (const page of PAGES) {
    test(`${page.path} returns 200, exactly one <h1>, and a non-empty <title>`, async ({
      page: pw,
    }) => {
      const response = await pw.goto(page.path);
      expect(response, `no response for ${page.path}`).not.toBeNull();
      expect(response!.status(), `bad status for ${page.path}`).toBe(200);

      const h1Count = await pw.locator('h1').count();
      expect(h1Count, `${page.path} should have exactly one <h1>`).toBe(1);

      const title = (await pw.title()).trim();
      expect(title.length, `${page.path} should have a non-empty <title>`).toBeGreaterThan(0);
    });
  }
});
