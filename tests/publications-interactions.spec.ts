import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test.describe('publication interactions', () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 760,
    'publication interaction checks run once on the desktop project'
  );

  test('every publication provides its metadata fragment target', async ({ page }) => {
    const source = await page.request.get('/publications.csl.json');
    const publications = (await source.json()) as Array<{ id: string }>;
    await page.goto('/publications');
    for (const { id } of publications) {
      await expect(page.locator(`li[id="${id}"]`), id).toHaveCount(1);
    }
  });

  test('copying BibTeX announces success', async ({ page }) => {
    await page.addInitScript(() => {
      const scope = window as Window & { copiedBibtex?: string };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (value: string) => {
          scope.copiedBibtex = value;
          return Promise.resolve();
        } },
      });
    });
    await page.goto('/publications');
    const copy = page.locator('button.bibcopy').first();
    await copy.click();
    await expect(copy).toHaveText('Copied ✓');
    expect(await page.evaluate(() => (window as Window & { copiedBibtex?: string }).copiedBibtex))
      .toBe(await copy.getAttribute('data-bibtex'));
    await expect(page.locator('#bibtex-copy-status')).toHaveText('BibTeX copied to clipboard.');
  });

  test('clipboard rejection provides a recovery message', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('Denied')) },
      });
    });
    await page.goto('/publications');
    const copy = page.locator('button.bibcopy').first();
    await copy.click();
    await expect(copy).toHaveText('Copy failed');
    await expect(page.locator('#bibtex-copy-status')).toHaveText(
      'Could not copy BibTeX. Download publications.bib to copy it manually.'
    );
  });

  test('BibTeX preserves literal and given-only author names', async () => {
    const vite = await createServer({
      appType: 'custom',
      logLevel: 'error',
      root: process.cwd(),
      server: { middlewareMode: true },
    });
    try {
      const { toBibtex } = await vite.ssrLoadModule('/src/lib/pubs.ts');
      const base = { id: 'example', type: 'article', title: 'Example', issued: { 'date-parts': [[2026]] } };
      expect(toBibtex({ ...base, author: [{ literal: 'Research and Development' }, { family: 'Smith', given: 'Ada' }] }))
        .toContain('author = {{Research and Development} and Smith, Ada},');
      expect(toBibtex({ ...base, author: [{ literal: 'Research and Development' }] }))
        .toContain('author = {{Research and Development}},');
      expect(toBibtex({ ...base, author: [{ given: 'Ada' }] })).toContain('author = {Ada},');
    } finally {
      await vite.close();
    }
  });
});
