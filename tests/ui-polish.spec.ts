import { test, expect } from '@playwright/test';

// USER STORIES for the round of UX fixes: branded header logo, minimal/itemized news
// (no inline video player), datasets link straight to the paper, email not plaintext.
test.describe('ui polish', () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 760,
    'these structural checks run once on the desktop project'
  );

  test('header shows the TSM vortex mark (inline svg), not a placeholder glyph', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header svg').first()).toBeVisible();
    expect(await page.locator('header').innerText()).not.toContain('≈');
  });

  test('news is itemized text — no inline video player embedded', async ({ page }) => {
    await page.goto('/news');
    // The Mace defense item is present as a text row with a link...
    await expect(page.getByText('successful MS thesis defense')).toBeVisible();
    // ...but no inline video facade/iframe is rendered on the page.
    expect(await page.locator('iframe').count()).toBe(0);
    expect(await page.locator('body').innerText()).not.toContain('MEDIASPACE');
  });

  test('a dataset links its related paper directly to the DOI', async ({ page }) => {
    await page.goto('/data');
    const link = page.locator('a[href*="doi.org/"]');
    expect(await link.count(), 'dataset should link to a DOI, not /publications').toBeGreaterThanOrEqual(1);
  });

  test('email is obfuscated site-wide (no plaintext address in rendered text)', async ({ page }) => {
    for (const path of ['/contact-us', '/team', '/']) {
      await page.goto(path);
      expect(await page.locator('body').innerText(), `plaintext email leaked on ${path}`)
        .not.toContain('junlin@msu.edu');
    }
  });
});
