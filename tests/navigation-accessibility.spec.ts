import { test, expect } from '@playwright/test';
import { PAGES } from './_shared';

test.describe('mobile navigation accessibility', () => {
  test.skip(
    ({ viewport }) => !viewport || viewport.width > 760,
    'mobile menu behavior is covered by the mobile project'
  );

  for (const sitePage of PAGES) {
    test(`${sitePage.path} identifies the current page in the mobile menu`, async ({ page }) => {
      await page.goto(sitePage.path);
      const menu = page.locator('details.nav-mobile');
      await menu.locator('summary').click();

      const current = menu.locator('a[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveAttribute('href', sitePage.path);
    });
  }

  test('Escape closes the menu and returns focus to its toggle', async ({ page }) => {
    await page.goto('/team');
    const menu = page.locator('details.nav-mobile');
    const toggle = menu.locator('summary');
    await toggle.click();
    await expect(menu).toHaveAttribute('open', '');
    const theme = menu.locator('[data-theme-toggle]');
    await theme.focus();
    await expect(theme).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveAttribute('open');
    await expect(toggle).toBeFocused();
  });
});

test('the header uses its disclosure menu before desktop links can crowd the brand', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/');

  await expect(page.locator('details.nav-mobile')).toBeVisible();
  await expect(page.locator('nav.nav-desktop')).toBeHidden();
});
