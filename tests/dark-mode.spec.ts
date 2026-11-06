import { test, expect } from '@playwright/test';

// USER STORY: dark-mode toggle works and persists across reloads / navigation.
// The toggle is any [data-theme-toggle] button; dark sets html[data-theme="dark"];
// the choice is stored under localStorage key 'tsm-theme-v2' and re-applied no-flash on load.

// Desktop: the toggle lives in the always-visible desktop nav.
test.describe('dark-mode (desktop)', () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 760,
    'desktop toggle path; mobile path is in the mobile describe block'
  );

  test('clicking the toggle sets html[data-theme="dark"]', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
    await page.locator('nav.nav-desktop [data-theme-toggle]').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('dark choice persists across reload and navigation (localStorage tsm-theme-v2)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('nav.nav-desktop [data-theme-toggle]').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const stored = await page.evaluate(() => localStorage.getItem('tsm-theme-v2'));
    expect(stored).toBe('dark');

    // Reload — still dark (no-flash init re-applies).
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Navigate to another page — still dark.
    await page.goto('/team');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

// Mobile: the toggle is inside the <details> hamburger menu — open it first.
test.describe('dark-mode (mobile)', () => {
  test.skip(
    ({ viewport }) => !viewport || viewport.width >= 760,
    'mobile menu path only runs on the mobile project'
  );

  test('opening the mobile menu and toggling sets + persists dark mode', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');

    // Open the <details class="nav-mobile"> menu, then click its theme toggle.
    await page.locator('details.nav-mobile > summary').click();
    await page.locator('details.nav-mobile [data-theme-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const stored = await page.evaluate(() => localStorage.getItem('tsm-theme-v2'));
    expect(stored).toBe('dark');

    await page.goto('/news');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
