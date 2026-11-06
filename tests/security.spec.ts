import { test, expect } from '@playwright/test';
import { scriptJson, escapeHtml, isWebUrl, isProfileUrl } from '../src/lib/safety.mjs';
import { PAGES } from './_shared';

test.describe('content security', () => {
  test.skip(({ isMobile }) => isMobile, 'content security checks run once');

  test('JSON-LD preserves data without executing closing-script payloads', async ({ page }) => {
    const payload = { title: '</ScRiPt><script>globalThis.injected = true</script><!--', text: 'A & B < C' };
    await page.setContent(`<script type="application/ld+json">${scriptJson(payload)}</script><main>Safe</main>`);
    expect(await page.evaluate(() => (globalThis as any).injected)).toBeUndefined();
    await expect(page.locator('script')).toHaveCount(1);
    expect(JSON.parse(await page.locator('script').textContent() ?? '')).toEqual(payload);
    await expect(page.getByRole('main')).toHaveText('Safe');
  });

  test('email label and attribute escaping cannot add markup or event handlers', async ({ page }) => {
    const label = '<img src=x onerror="globalThis.injected=true"> & Email';
    const attr = '" onmouseover="globalThis.injected=true';
    await page.setContent(`<a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;a@example.org" class="${escapeHtml(attr)}">${escapeHtml(label)}</a>`);
    const link = page.getByRole('link');
    await expect(link).toHaveText(label);
    await expect(link).toHaveAttribute('href', 'mailto:a@example.org');
    await expect(page.locator('img, [onmouseover], [onerror]')).toHaveCount(0);
  });

  test('content URL validation rejects executable and ambiguous schemes', () => {
    for (const value of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'data:text/html,test', '//evil.example', '/\\evil.example', 'https://trusted.example@evil.example', '', null]) {
      expect(isWebUrl(value), String(value)).toBe(false);
      expect(isProfileUrl(value), String(value)).toBe(false);
    }
    for (const value of ['https://example.org/paper?q=a%20b', 'http://example.org/paper']) {
      expect(isWebUrl(value)).toBe(true);
      expect(isProfileUrl(value)).toBe(true);
    }
    for (const value of ['/cv.pdf', 'mailto:pi@example.org']) {
      expect(isWebUrl(value)).toBe(false);
      expect(isProfileUrl(value)).toBe(true);
    }
  });

  test('published pages contain parseable JSON-LD and safe link schemes', async ({ page }) => {
    for (const route of PAGES) {
      await page.goto(route.path);
      for (const text of await page.locator('script[type="application/ld+json"]').allTextContents()) {
        expect(() => JSON.parse(text)).not.toThrow();
      }
      const unsafe = await page.locator('a[href]').evaluateAll((links) => links
        .map((link) => (link as HTMLAnchorElement).href)
        .filter((href) => !['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(href).protocol)));
      expect(unsafe, route.path).toEqual([]);
    }
  });
});
