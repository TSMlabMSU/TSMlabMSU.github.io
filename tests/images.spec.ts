import { test, expect } from '@playwright/test';

// USER STORY: images are real and accessible. Key portraits/figures actually load
// (naturalWidth > 0), and every <img> on a page carries a non-empty alt attribute.
test.describe('images', () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 760,
    'image loading is viewport-independent; run once on desktop'
  );

  async function expectAllImagesLoadedWithAlt(page: import('@playwright/test').Page, route: string) {
    await page.goto(route);
    const imgs = page.locator('img');
    const n = await imgs.count();
    expect(n, `${route} should render at least one <img>`).toBeGreaterThan(0);

    for (let i = 0; i < n; i++) {
      const img = imgs.nth(i);
      await img.scrollIntoViewIfNeeded(); // trigger lazy-loaded figures
    }
    // Wait for the network to settle so lazy images resolve.
    await page.waitForLoadState('networkidle');

    for (let i = 0; i < n; i++) {
      const img = imgs.nth(i);
      const alt = await img.getAttribute('alt');
      expect(alt, `img #${i} on ${route} should have a non-empty alt`).toBeTruthy();
      expect((alt ?? '').trim().length).toBeGreaterThan(0);

      const naturalWidth = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
      expect(naturalWidth, `img #${i} (alt="${alt}") on ${route} should be loaded`).toBeGreaterThan(0);
    }
  }

  test('home: PI portrait + research figures load and all imgs have alt', async ({ page }) => {
    await expectAllImagesLoadedWithAlt(page, '/');
    // Explicitly assert the PI portrait is loaded.
    const portrait = page.locator('img[alt*="Junlin Yuan"]').first();
    await expect(portrait).toHaveCount(1);
    const w = await portrait.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    expect(w).toBeGreaterThan(0);
  });

  test('team: PI portrait loads and all imgs have alt', async ({ page }) => {
    await expectAllImagesLoadedWithAlt(page, '/team');
    const portrait = page.locator('img[alt*="Junlin Yuan"]').first();
    await expect(portrait).toHaveCount(1);
    const w = await portrait.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    expect(w).toBeGreaterThan(0);
  });

  test('research: figures load and all imgs have alt', async ({ page }) => {
    await expectAllImagesLoadedWithAlt(page, '/research');
  });
});

test.describe('hero resolution', () => {
  test('home hero has enough source pixels for its cover box', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('img.heroimg');
    await expect(hero).toHaveCount(1);

    const metrics = await hero.evaluate(async (el) => {
      const img = el as HTMLImageElement;
      await img.decode();
      const response = await fetch(img.currentSrc);
      const bitmap = await createImageBitmap(await response.blob());
      const rect = img.getBoundingClientRect();
      const coverScale = Math.max(rect.width / bitmap.width, rect.height / bitmap.height);

      return {
        source: `${bitmap.width}x${bitmap.height}`,
        rendered: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        devicePixelRatio: window.devicePixelRatio,
        effectiveUpscale: coverScale * window.devicePixelRatio,
      };
    });

    expect(
      metrics.effectiveUpscale,
      `hero ${metrics.source} is too small for ${metrics.rendered} at ${metrics.devicePixelRatio}x DPR`
    ).toBeLessThanOrEqual(1);
  });
});
