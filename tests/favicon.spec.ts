import { test, expect } from '@playwright/test';

// USER STORY: the site has its own icon — the browser tab, bookmarks, and an installed
// PWA show the TSM vortex mark, not a blank default.
test.describe('favicon', () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 760,
    'icon asset check runs once on the desktop project'
  );

  test('home declares icons + manifest and all icon assets resolve', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="icon"][href="/favicon.ico"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    for (const u of [
      '/favicon.ico',
      '/icon-192.png',
      '/icon-512.png',
      '/icon-dark.png',
      '/apple-touch-icon.png',
      '/manifest.webmanifest',
    ]) {
      const res = await request.get(u);
      expect(res.status(), `icon asset missing: ${u}`).toBe(200);
    }
  });
});
