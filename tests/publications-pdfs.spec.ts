import { test, expect } from '@playwright/test';
import { EXTERNAL_PDF_PROBES, HOSTED_PDF_RECORDS, PUBLICATION_RECORDS } from './_shared';

// USER STORY: on the Publications page a visitor can identify every hosted author PDF,
// see its rights/version, and follow the source-configured DOI links.
test.describe('publications wiring', () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 760,
    'publications wiring checks run once on the desktop project'
  );

  test('renders every configured author PDF at its publication entry', async ({ page }) => {
    await page.goto('/publications');
    await expect(page.locator('a.publink[href$=".pdf"]')).toHaveCount(HOSTED_PDF_RECORDS.length);

    for (const record of HOSTED_PDF_RECORDS) {
      const entry = page.locator(`li#${record.id}`);
      await expect(entry.locator(`a[href="${record.pdfUrl}"]`)).toHaveCount(1);
    }
  });

  test('every configured author PDF has a publisher-terms rights line', async ({ page }) => {
    await page.goto('/publications');

    for (const record of HOSTED_PDF_RECORDS) {
      const rights = page.locator(`li#${record.id} .pubrights`);
      await expect(rights).toHaveCount(1);
      await expect(rights).toContainText('publisher terms');
    }
  });

  test('every source DOI is rendered at its publication entry', async ({ page }) => {
    await page.goto('/publications');

    for (const record of PUBLICATION_RECORDS.filter(
      (publication): publication is typeof publication & { doi: string } => Boolean(publication.doi)
    )) {
      await expect(page.locator(`li#${record.id} a[href="https://doi.org/${record.doi}"]`)).toHaveCount(1);
    }
  });

  test('source-derived hosted PDF sample resolves when external link checks are enabled', async ({ request }) => {
    test.skip(process.env.CHECK_EXTERNAL_LINKS !== '1', 'set CHECK_EXTERNAL_LINKS=1 to probe hosted files');

    for (const record of EXTERNAL_PDF_PROBES) {
      const res = await request.get(record.pdfUrl);
      // R2 public URLs support Range requests, so 200 or 206 are both successful responses.
      expect([200, 206], `PDF URL did not resolve: ${record.pdfUrl}`).toContain(res.status());
      expect((res.headers()['content-type'] ?? '').toLowerCase()).toContain('pdf');
    }
  });

  test('per-paper JSON-LD carries rights signals, not the site CC-BY', async ({ page }) => {
    await page.goto('/publications');
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const joined = blocks.join('\n');
    expect(joined).toContain('usageInfo');
    expect(joined).toContain('creativeWorkStatus');
  });
});
